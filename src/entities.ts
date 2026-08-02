import { SoundName } from './audio';
import { ITEMS } from './items';
import { Body, moveBody, overlaps, rectOverlapsBody } from './physics';
import { Player } from './player';
import { TILE, World } from './world';

const GRAVITY = 1150;
const MAX_FALL = 700;

let nextId = 1;

export interface EnemyContext {
  spawn(enemy: Enemy): void;
  shake(amount: number): void;
  sound(name: SoundName): void;
  text(x: number, y: number, value: number, color: string): void;
}

export type EnemyKind = 'slime' | 'king' | 'zombie' | 'bat';

export abstract class Enemy {
  id = nextId++;
  hurtFlash = 0;
  abstract kind: EnemyKind;
  abstract body: Body;
  abstract hp: number;
  abstract maxHp: number;
  abstract damage: number;

  abstract update(dt: number, world: World, player: Player, ctx: EnemyContext): void;

  hurt(amount: number, knockX: number): void {
    this.hp -= amount;
    this.hurtFlash = 0.18;
    this.body.vx = knockX;
    this.body.vy = -140;
  }

  protected touchPlayer(player: Player, ctx: EnemyContext): void {
    if (player.dead || !overlaps(this.body, player.body)) return;
    const knock = player.body.x < this.body.x ? -170 : 170;
    if (player.hurt(this.damage, knock)) {
      ctx.sound('hurt');
      ctx.shake(6);
      ctx.text(player.body.x + player.body.w / 2, player.body.y, this.damage, '#ff8a8a');
    }
  }
}

export class Slime extends Enemy {
  kind: EnemyKind = 'slime';
  body: Body;
  hp: number;
  maxHp: number;
  damage: number;
  private jumpCooldown = 0.5 + Math.random() * 0.8;

  constructor(x: number, y: number, big: boolean) {
    super();
    const scale = big ? 1.35 : 1;
    this.body = { x, y, w: 18 * scale, h: 14 * scale, vx: 0, vy: 0, onGround: false };
    this.maxHp = big ? 55 : 26;
    this.hp = this.maxHp;
    this.damage = big ? 16 : 9;
  }

  update(dt: number, world: World, player: Player, ctx: EnemyContext): void {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.jumpCooldown -= dt;

    if (this.body.onGround) {
      this.body.vx *= 1 - Math.min(1, 6 * dt);
      if (this.jumpCooldown <= 0) {
        const dir = player.body.x > this.body.x ? 1 : -1;
        this.body.vx = dir * (Math.abs(player.body.x - this.body.x) > 200 ? 110 : 78);
        this.body.vy = -270;
        this.jumpCooldown = 0.9 + Math.random() * 0.7;
      }
    }
    this.body.vy = Math.min(MAX_FALL, this.body.vy + GRAVITY * dt);
    moveBody(this.body, world, dt);
    this.touchPlayer(player, ctx);
  }
}

export class KingSlime extends Enemy {
  kind: EnemyKind = 'king';
  body: Body;
  hp = 900;
  maxHp = 900;
  damage = 26;
  private jumpCooldown = 1.2;
  private summonCooldown = 4;
  private minions = 0;

  constructor(x: number, y: number) {
    super();
    this.body = { x, y, w: 62, h: 46, vx: 0, vy: 0, onGround: false };
  }

  hurt(amount: number, knockX: number): void {
    this.hp -= amount;
    this.hurtFlash = 0.18;
    this.body.vx += knockX * 0.12;
  }

  update(dt: number, world: World, player: Player, ctx: EnemyContext): void {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.jumpCooldown -= dt;
    this.summonCooldown -= dt;

    if (this.body.onGround) {
      this.body.vx *= 1 - Math.min(1, 4 * dt);
      if (this.jumpCooldown <= 0) {
        const dir = player.body.x > this.body.x ? 1 : -1;
        const enraged = this.hp < this.maxHp * 0.4;
        this.body.vx = dir * (enraged ? 190 : 130);
        this.body.vy = enraged ? -400 : -340;
        this.jumpCooldown = enraged ? 0.8 : 1.3;
        ctx.shake(4);
      }
    }
    if (this.summonCooldown <= 0 && this.minions < 5) {
      this.summonCooldown = 5;
      this.minions++;
      ctx.spawn(new Slime(this.body.x + this.body.w / 2, this.body.y, false));
    }

    this.body.vy = Math.min(MAX_FALL, this.body.vy + GRAVITY * dt);
    moveBody(this.body, world, dt);
    this.touchPlayer(player, ctx);
  }
}

export class Zombie extends Enemy {
  kind: EnemyKind = 'zombie';
  body: Body;
  hp = 65;
  maxHp = 65;
  damage = 15;
  facing = 1;
  walkPhase = 0;

  constructor(x: number, y: number) {
    super();
    this.body = { x, y, w: 12, h: 28, vx: 0, vy: 0, onGround: false };
  }

  update(dt: number, world: World, player: Player, ctx: EnemyContext): void {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.facing = player.body.x > this.body.x ? 1 : -1;
    this.walkPhase += dt * 8;

    const target = this.facing * 62;
    this.body.vx += (target - this.body.vx) * Math.min(1, 5 * dt);
    this.body.vy = Math.min(MAX_FALL, this.body.vy + GRAVITY * dt);

    const res = moveBody(this.body, world, dt);
    if (res.hitX && this.body.onGround) this.body.vy = -330;
    this.touchPlayer(player, ctx);
  }
}

export class Bat extends Enemy {
  kind: EnemyKind = 'bat';
  body: Body;
  hp = 28;
  maxHp = 28;
  damage = 11;
  wingPhase = Math.random() * 6;
  private drift = Math.random() * Math.PI * 2;

  constructor(x: number, y: number) {
    super();
    this.body = { x, y, w: 14, h: 10, vx: 0, vy: 0, onGround: false };
  }

  hurt(amount: number, knockX: number): void {
    this.hp -= amount;
    this.hurtFlash = 0.18;
    this.body.vx = knockX * 0.6;
    this.body.vy = -60;
  }

  update(dt: number, world: World, player: Player, ctx: EnemyContext): void {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.wingPhase += dt * 18;
    this.drift += dt * 2.4;

    const dx = player.body.x - this.body.x;
    const dy = player.body.y - this.body.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = 95;
    this.body.vx += ((dx / dist) * speed - this.body.vx) * Math.min(1, 2.4 * dt);
    this.body.vy += ((dy / dist) * speed + Math.sin(this.drift) * 70 - this.body.vy) * Math.min(1, 2.4 * dt);

    const res = moveBody(this.body, world, dt);
    if (res.hitX) this.body.vx = -this.body.vx * 0.6;
    if (res.hitY) this.body.vy = -this.body.vy * 0.6;
    this.touchPlayer(player, ctx);
  }
}

export class Arrow {
  body: Body;
  life = 4;

  constructor(x: number, y: number, vx: number, vy: number, public damage: number) {
    this.body = { x, y, w: 5, h: 3, vx, vy, onGround: false };
  }

  get angle(): number {
    return Math.atan2(this.body.vy, this.body.vx);
  }

  /** Returns true when the arrow should be removed. */
  update(dt: number, world: World, enemies: Enemy[], ctx: EnemyContext): boolean {
    this.life -= dt;
    if (this.life <= 0) return true;
    this.body.vy += GRAVITY * 0.4 * dt;
    const res = moveBody(this.body, world, dt);
    if (res.hitX || res.hitY) return true;

    for (const e of enemies) {
      if (!rectOverlapsBody(this.body.x, this.body.y, this.body.w, this.body.h, e.body)) continue;
      e.hurt(this.damage, Math.sign(this.body.vx) * 120);
      ctx.sound('hit');
      ctx.text(e.body.x + e.body.w / 2, e.body.y, this.damage, '#ffe08a');
      return true;
    }
    return false;
  }
}

export class ItemDrop {
  body: Body;
  age = 0;

  constructor(x: number, y: number, public itemId: string, public count: number) {
    this.body = { x, y, w: 8, h: 8, vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 40, onGround: false };
  }

  update(dt: number, world: World, player: Player): boolean {
    this.age += dt;
    const dx = player.body.x + player.body.w / 2 - (this.body.x + this.body.w / 2);
    const dy = player.body.y + player.body.h / 2 - (this.body.y + this.body.h / 2);
    const dist = Math.hypot(dx, dy);

    if (this.age > 0.35 && dist < 52 && !player.dead) {
      const pull = 620 / Math.max(12, dist);
      this.body.vx += (dx / dist) * pull * dt * 30;
      this.body.vy += (dy / dist) * pull * dt * 30;
    } else {
      this.body.vy = Math.min(MAX_FALL, this.body.vy + GRAVITY * dt);
      if (this.body.onGround) this.body.vx *= 1 - Math.min(1, 8 * dt);
    }

    moveBody(this.body, world, dt);
    if (this.body.onGround && Math.abs(this.body.vy) < 1) this.body.vy = 0;

    if (this.age > 0.35 && dist < 14 && !player.dead) {
      const left = player.addItem(this.itemId, this.count);
      if (left === 0) return true;
      this.count = left;
    }
    return false;
  }
}

export class Particle {
  vx: number;
  vy: number;
  life: number;

  constructor(public x: number, public y: number, public color: string, public size: number) {
    this.vx = (Math.random() - 0.5) * 90;
    this.vy = -30 - Math.random() * 70;
    this.life = 0.4 + Math.random() * 0.4;
  }

  update(dt: number): boolean {
    this.life -= dt;
    this.vy += GRAVITY * 0.6 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return this.life <= 0;
  }
}

export class FloatingText {
  life = 0.9;

  constructor(public x: number, public y: number, public text: string, public color: string) {}

  update(dt: number): boolean {
    this.life -= dt;
    this.y -= 26 * dt;
    return this.life <= 0;
  }
}

export function spawnTileParticles(list: Particle[], tx: number, ty: number, color: string): void {
  for (let i = 0; i < 6; i++) {
    list.push(new Particle(tx * TILE + Math.random() * TILE, ty * TILE + Math.random() * TILE, color, 2 + Math.random() * 2));
  }
}

export function enemyLoot(enemy: Enemy): { id: string; count: number }[] {
  switch (enemy.kind) {
    case 'slime':
      return [{ id: 'gel', count: enemy.maxHp > 40 ? 2 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2) }];
    case 'zombie':
      return Math.random() < 0.5 ? [{ id: 'iron_ore', count: 1 }] : [];
    case 'bat':
      return Math.random() < 0.45 ? [{ id: 'coal', count: 1 }] : [];
    case 'king':
      return [
        { id: 'gel', count: 30 },
        { id: 'gold_bar', count: 12 },
        { id: 'potion', count: 5 },
        { id: 'cloud_bottle', count: 1 },
      ];
  }
}

export function itemName(id: string): string {
  return ITEMS[id].name;
}
