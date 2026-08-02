import { HAND_DAMAGE, HAND_SPEED, HAND_TIER, ITEMS, Slot } from './items';
import { Body, moveBody, tryStepUp } from './physics';
import { World } from './world';

export type { Slot };

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
}

export const HOTBAR_SIZE = 10;
export const INVENTORY_SIZE = 40;

const ACCEL = 1100;
const MAX_SPEED = 155;
const GROUND_FRICTION = 1500;
const AIR_FRICTION = 260;
const GRAVITY = 1150;
const MAX_FALL = 720;
const JUMP_VELOCITY = -370;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.12;
const SWING_DURATION = 0.28;
const REGEN_DELAY = 5;
const REGEN_RATE = 2.5;

export class Player {
  body: Body = { x: 0, y: 0, w: 11, h: 28, vx: 0, vy: 0, onGround: false };
  hp = 100;
  maxHp = 100;
  invuln = 0;
  facing = 1;
  swingTime = 0;
  swingHits = new Set<number>();
  dead = false;
  respawnTimer = 0;
  inv: (Slot | null)[] = new Array(INVENTORY_SIZE).fill(null);
  selected = 0;
  /** Seconds since the last hit taken, drives out-of-combat regeneration. */
  timeSinceHit = REGEN_DELAY;
  /** Enabled while a Cloud in a Bottle is carried. */
  canDoubleJump = false;
  useCooldown = 0;

  private coyote = 0;
  private jumpBuffer = 0;
  private airJumps = 0;

  constructor(x: number, y: number) {
    this.body.x = x;
    this.body.y = y;
  }

  update(dt: number, world: World, input: PlayerInput): { fallDamage: number; jumped: boolean; doubleJumped: boolean } {
    this.invuln = Math.max(0, this.invuln - dt);
    this.useCooldown = Math.max(0, this.useCooldown - dt);
    this.timeSinceHit += dt;
    if (this.timeSinceHit > REGEN_DELAY && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + REGEN_RATE * dt);
    }
    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - dt);
      if (this.swingTime === 0) this.swingHits.clear();
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      this.facing = dir;
      this.body.vx += dir * ACCEL * dt;
      this.body.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.body.vx));
    } else {
      const f = (this.body.onGround ? GROUND_FRICTION : AIR_FRICTION) * dt;
      if (Math.abs(this.body.vx) <= f) this.body.vx = 0;
      else this.body.vx -= Math.sign(this.body.vx) * f;
    }

    if (this.body.onGround) this.airJumps = this.canDoubleJump ? 1 : 0;
    this.coyote = this.body.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
    let jumped = false;
    let doubleJumped = false;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.body.vy = JUMP_VELOCITY;
      this.jumpBuffer = 0;
      this.coyote = 0;
      jumped = true;
    } else if (this.jumpBuffer > 0 && this.airJumps > 0) {
      this.body.vy = JUMP_VELOCITY;
      this.jumpBuffer = 0;
      this.airJumps--;
      jumped = true;
      doubleJumped = true;
    }
    if (!input.jumpHeld && this.body.vy < -110) this.body.vy = -110;

    this.body.vy = Math.min(MAX_FALL, this.body.vy + GRAVITY * dt);

    const speedBefore = this.body.vy;
    const wantedVx = this.body.vx;
    const res = moveBody(this.body, world, dt);
    if (res.hitX && this.body.onGround && tryStepUp(this.body, world, dir)) this.body.vx = wantedVx;

    let fallDamage = 0;
    if (res.landed && speedBefore > 620) fallDamage = Math.round((speedBefore - 620) / 6);
    return { fallDamage, jumped, doubleJumped };
  }

  hurt(amount: number, knockX: number): boolean {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= amount;
    this.invuln = 0.8;
    this.timeSinceHit = 0;
    this.body.vx = knockX;
    this.body.vy = -160;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnTimer = 2.5;
    }
    return true;
  }

  respawn(world: World): void {
    this.dead = false;
    this.hp = this.maxHp;
    this.invuln = 1.5;
    this.body.x = world.spawnX;
    this.body.y = world.spawnY;
    this.body.vx = 0;
    this.body.vy = 0;
  }

  startSwing(): void {
    this.swingTime = SWING_DURATION;
    this.swingHits.clear();
  }

  get swinging(): boolean {
    return this.swingTime > 0;
  }

  get swingProgress(): number {
    return 1 - this.swingTime / SWING_DURATION;
  }

  held(): Slot | null {
    return this.inv[this.selected];
  }

  /** Best pickaxe carried anywhere in the inventory decides mining tier. */
  pickaxe(): { tier: number; speed: number } {
    let tier = HAND_TIER;
    let speed = HAND_SPEED;
    const slot = this.held();
    if (slot) {
      const def = ITEMS[slot.id];
      if (def.tier !== undefined && def.speed !== undefined) {
        tier = def.tier;
        speed = def.speed;
      }
    }
    return { tier, speed };
  }

  weaponDamage(): number {
    const slot = this.held();
    if (!slot) return HAND_DAMAGE;
    return ITEMS[slot.id].damage ?? HAND_DAMAGE;
  }

  countOf(id: string): number {
    let n = 0;
    for (const slot of this.inv) if (slot && slot.id === id) n += slot.count;
    return n;
  }

  /** Returns the number of items that did not fit. */
  addItem(id: string, count: number): number {
    const max = ITEMS[id].stack;
    let left = count;
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      const slot = this.inv[i];
      if (!slot || slot.id !== id || slot.count >= max) continue;
      const room = max - slot.count;
      const take = Math.min(room, left);
      slot.count += take;
      left -= take;
    }
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      if (this.inv[i]) continue;
      const take = Math.min(max, left);
      this.inv[i] = { id, count: take };
      left -= take;
    }
    return left;
  }

  removeItem(id: string, count: number): boolean {
    if (this.countOf(id) < count) return false;
    let left = count;
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      const slot = this.inv[i];
      if (!slot || slot.id !== id) continue;
      const take = Math.min(slot.count, left);
      slot.count -= take;
      left -= take;
      if (slot.count === 0) this.inv[i] = null;
    }
    return true;
  }

  consumeHeld(): void {
    const slot = this.held();
    if (!slot) return;
    slot.count--;
    if (slot.count <= 0) this.inv[this.selected] = null;
  }

  swapSlots(a: number, b: number): void {
    const tmp = this.inv[a];
    this.inv[a] = this.inv[b];
    this.inv[b] = tmp;
  }
}
