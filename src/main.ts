import { initAudio, playSound, SoundName } from './audio';
import {
  Arrow,
  Bat,
  Enemy,
  EnemyContext,
  enemyLoot,
  FloatingText,
  ItemDrop,
  KingSlime,
  Particle,
  Slime,
  spawnTileParticles,
  Zombie,
} from './entities';
import { ITEMS, Slot } from './items';
import { rectOverlapsBody } from './physics';
import { HOTBAR_SIZE, Player } from './player';
import { RECIPES } from './recipes';
import {
  buildAtlas,
  Camera,
  drawArrows,
  drawCursor,
  drawDrops,
  drawEnemies,
  drawFloatingTexts,
  drawLight,
  drawMining,
  drawMinimap,
  drawParticles,
  drawPlayer,
  drawSky,
  drawSwingArc,
  drawTiles,
  MINIMAP_W,
  refreshMinimap,
  View,
  ZOOM,
} from './render';
import { applySave, clearSave, loadSave, saveGame } from './save';
import { AIR, CHEST, FURNACE, TILES, WORKBENCH } from './tiles';
import { drawHud, hitTest, HudState } from './ui';
import { CHEST_SLOTS, TILE, World } from './world';

const WORLD_W = 900;
const WORLD_H = 320;
const DAY_LENGTH = 300;
const REACH = 5.5 * TILE;
const MAX_ENEMIES = 12;
const PLACE_COOLDOWN = 0.14;
const AUTOSAVE_INTERVAL = 20;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const atlas = buildAtlas();

/** `?seed=123` generates that exact world and leaves the stored save untouched. */
function readSeedParam(): number | null {
  const raw = new URLSearchParams(location.search).get('seed');
  if (raw === null) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

const forcedSeed = readSeedParam();
const savingEnabled = forcedSeed === null;
let seed = forcedSeed ?? Math.floor(Math.random() * 1e9);
let world: World;
let player: Player;

const cam: Camera = { x: 0, y: 0 };
const enemies: Enemy[] = [];
const arrows: Arrow[] = [];
const drops: ItemDrop[] = [];
const particles: Particle[] = [];
const texts: FloatingText[] = [];

const keys = new Set<string>();
let jumpPressed = false;
let mouseLeft = false;
let mouseRight = false;
const mouse = { x: 0, y: 0 };

let craftOpen = false;
let openChest: (Slot | null)[] | null = null;
let openChestTile = { x: 0, y: 0 };
let stations = new Set<number>();
const START_TIME = DAY_LENGTH * 0.08;
let elapsed = START_TIME;
let mineX = -1;
let mineY = -1;
let mineProgress = 0;
let placeCooldown = 0;
let message: string | null = null;
let messageTimer = 0;
let spawnTimer = 2;
let dpr = 1;
let ready = false;
let boss: KingSlime | null = null;
let shake = 0;
let minimapOn = true;
let minimapTimer = 0;
let autosaveTimer = AUTOSAVE_INTERVAL;
let hintTimer = 25;

function resize(): void {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function viewSize(): { w: number; h: number } {
  return { w: window.innerWidth / ZOOM, h: window.innerHeight / ZOOM };
}

function say(text: string): void {
  message = text;
  messageTimer = 2.4;
}

function addText(x: number, y: number, value: number, color: string): void {
  texts.push(new FloatingText(x, y, String(value), color));
}

const enemyCtx: EnemyContext = {
  spawn: (e) => enemies.push(e),
  shake: (amount) => (shake = Math.max(shake, amount)),
  sound: (name: SoundName) => playSound(name),
  text: addText,
};

function daylightAt(phase: number): number {
  if (phase < 0.05) return phase / 0.05;
  if (phase < 0.55) return 1;
  if (phase < 0.65) return 1 - (phase - 0.55) / 0.1;
  return 0;
}

function clockText(phase: number): string {
  const hours = (phase * 24 + 6) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ------------------------------------------------------------------- input

window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  initAudio();
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (ready && !keys.has(e.code)) {
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') jumpPressed = true;
    if (e.code === 'KeyC' || e.code === 'KeyE' || e.code === 'Tab') {
      craftOpen = !craftOpen;
      openChest = null;
    }
    if (e.code === 'Escape') {
      craftOpen = false;
      openChest = null;
    }
    if (e.code === 'KeyM') minimapOn = !minimapOn;
    if (e.code === 'KeyN') newWorld();
    const digit = e.code.match(/^Digit(\d)$/);
    if (digit) player.selected = (Number(digit[1]) + 9) % 10;
  }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('beforeunload', () => {
  if (ready && savingEnabled) saveGame(world, player, seed, elapsed);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', (e) => {
  initAudio();
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  if (!ready) return;
  const action = hitTest(mouse.x, mouse.y, window.innerWidth, window.innerHeight, hudState());
  if (action) {
    if (action.kind === 'craft') craft(action.recipe);
    else if (action.kind === 'chest') takeFromChest(action.index);
    else if (openChest) putIntoChest(action.index);
    else if (action.index < HOTBAR_SIZE) player.selected = action.index;
    else player.swapSlots(action.index, player.selected);
    return;
  }
  if (e.button === 0) mouseLeft = true;
  if (e.button === 2) mouseRight = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseLeft = false;
  if (e.button === 2) mouseRight = false;
});
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (!ready) return;
    player.selected = (player.selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE;
  },
  { passive: false },
);

// ------------------------------------------------------------------ actions

function craft(index: number): void {
  const recipe = RECIPES[index];
  if (!recipe.inputs.every((ing) => player.countOf(ing.id) >= ing.count)) {
    say('missing materials');
    return;
  }
  if (recipe.station !== 0 && !stations.has(recipe.station)) return;
  for (const ing of recipe.inputs) player.removeItem(ing.id, ing.count);
  const left = player.addItem(recipe.out.id, recipe.out.count);
  if (left > 0) drops.push(new ItemDrop(player.body.x, player.body.y, recipe.out.id, left));
  playSound('craft');
  say(`crafted ${ITEMS[recipe.out.id].name}`);
}

function addToChest(chest: (Slot | null)[], id: string, count: number): number {
  const max = ITEMS[id].stack;
  let left = count;
  for (let i = 0; i < chest.length && left > 0; i++) {
    const slot = chest[i];
    if (!slot || slot.id !== id || slot.count >= max) continue;
    const take = Math.min(max - slot.count, left);
    slot.count += take;
    left -= take;
  }
  for (let i = 0; i < chest.length && left > 0; i++) {
    if (chest[i]) continue;
    const take = Math.min(max, left);
    chest[i] = { id, count: take };
    left -= take;
  }
  return left;
}

function takeFromChest(index: number): void {
  if (!openChest) return;
  const slot = openChest[index];
  if (!slot) return;
  const left = player.addItem(slot.id, slot.count);
  openChest[index] = left > 0 ? { id: slot.id, count: left } : null;
  playSound('pickup');
}

function putIntoChest(index: number): void {
  if (!openChest) return;
  const slot = player.inv[index];
  if (!slot) return;
  const left = addToChest(openChest, slot.id, slot.count);
  player.inv[index] = left > 0 ? { id: slot.id, count: left } : null;
  playSound('place');
}

function updateStations(): void {
  stations = new Set<number>();
  const px = Math.floor((player.body.x + player.body.w / 2) / TILE);
  const py = Math.floor((player.body.y + player.body.h / 2) / TILE);
  for (let y = py - 5; y <= py + 5; y++) {
    for (let x = px - 6; x <= px + 6; x++) {
      const t = world.get(x, y);
      if (t === WORKBENCH || t === FURNACE) stations.add(t);
    }
  }
}

function cursorTile(): { tx: number; ty: number; wx: number; wy: number; inReach: boolean } {
  const wx = cam.x + mouse.x / ZOOM;
  const wy = cam.y + mouse.y / ZOOM;
  const cx = player.body.x + player.body.w / 2;
  const cy = player.body.y + player.body.h / 2;
  return {
    tx: Math.floor(wx / TILE),
    ty: Math.floor(wy / TILE),
    wx,
    wy,
    inReach: Math.hypot(wx - cx, wy - cy) <= REACH,
  };
}

function breakTile(tx: number, ty: number): void {
  const t = world.get(tx, ty);
  const def = TILES[t];
  if (t === CHEST) {
    const contents = world.chestAt(tx, ty);
    if (contents) {
      for (const slot of contents) {
        if (slot) drops.push(new ItemDrop(tx * TILE + 4, ty * TILE + 4, slot.id, slot.count));
      }
      world.chests.delete(world.idx(tx, ty));
    }
    if (openChest && openChestTile.x === tx && openChestTile.y === ty) openChest = null;
  }
  world.setTile(tx, ty, AIR);
  spawnTileParticles(particles, tx, ty, def.color);
  playSound('break');
  if (def.drop) drops.push(new ItemDrop(tx * TILE + 4, ty * TILE + 4, def.drop, 1));
  if (def.name === 'Tree') {
    for (let y = ty - 1; y > ty - 14; y--) {
      if (TILES[world.get(tx, y)].name !== 'Tree') break;
      world.setTile(tx, y, AIR);
      drops.push(new ItemDrop(tx * TILE + 4, y * TILE + 4, 'wood', 1));
    }
  }
}

function tryMine(dt: number): void {
  const { tx, ty, inReach } = cursorTile();
  const t = world.get(tx, ty);
  if (!inReach || t === AIR || !world.inBounds(tx, ty)) {
    mineProgress = 0;
    mineX = -1;
    return;
  }
  const def = TILES[t];
  const tool = player.pickaxe();
  if (def.minTier > tool.tier) {
    mineProgress = 0;
    mineX = -1;
    say(`${def.name} needs a stronger pickaxe`);
    return;
  }
  if (tx !== mineX || ty !== mineY) {
    mineX = tx;
    mineY = ty;
    mineProgress = 0;
  }
  mineProgress += (tool.speed * dt) / def.hardness;
  playSound('dig');
  if (mineProgress >= 1) {
    breakTile(tx, ty);
    mineProgress = 0;
    mineX = -1;
  }
}

function tryUse(): void {
  const { tx, ty, inReach } = cursorTile();

  if (inReach && world.get(tx, ty) === CHEST) {
    if (openChest && openChestTile.x === tx && openChestTile.y === ty) {
      openChest = null;
    } else {
      openChest = world.chestAt(tx, ty);
      openChestTile = { x: tx, y: ty };
      craftOpen = false;
      playSound('chest');
    }
    placeCooldown = 0.3;
    return;
  }

  const slot = player.held();
  if (!slot) return;
  const def = ITEMS[slot.id];

  if (def.heal !== undefined) {
    if (player.hp >= player.maxHp) return;
    player.hp = Math.min(player.maxHp, player.hp + def.heal);
    addText(player.body.x + player.body.w / 2, player.body.y, def.heal, '#8affa0');
    player.consumeHeld();
    playSound('craft');
    placeCooldown = 0.6;
    return;
  }
  if (def.summon) {
    summonBoss();
    return;
  }
  if (def.tile === undefined) return;

  if (!inReach || !world.inBounds(tx, ty) || world.get(tx, ty) !== AIR) return;
  if (TILES[def.tile].solid && rectOverlapsBody(tx * TILE, ty * TILE, TILE, TILE, player.body)) return;
  if (TILES[def.tile].solid && enemies.some((e) => rectOverlapsBody(tx * TILE, ty * TILE, TILE, TILE, e.body))) return;
  const supported =
    world.get(tx - 1, ty) !== AIR ||
    world.get(tx + 1, ty) !== AIR ||
    world.get(tx, ty - 1) !== AIR ||
    world.get(tx, ty + 1) !== AIR;
  if (!supported) return;

  world.setTile(tx, ty, def.tile);
  if (def.tile === CHEST) world.chests.set(world.idx(tx, ty), new Array(CHEST_SLOTS).fill(null));
  player.consumeHeld();
  playSound('place');
  placeCooldown = PLACE_COOLDOWN;
}

function summonBoss(): void {
  if (boss) {
    say('King Slime is already here');
    return;
  }
  const px = Math.floor((player.body.x + player.body.w / 2) / TILE) + 6;
  const ty = world.height[Math.max(0, Math.min(world.w - 1, px))] - 4;
  boss = new KingSlime(px * TILE, ty * TILE);
  enemies.push(boss);
  player.consumeHeld();
  playSound('boss');
  shake = 12;
  say('King Slime awakens');
  placeCooldown = 0.6;
}

function trySwing(): void {
  if (!player.swinging) {
    player.startSwing();
    playSound('hit');
  }
}

function tryShoot(): void {
  const slot = player.held();
  if (!slot || player.useCooldown > 0) return;
  const def = ITEMS[slot.id];
  if (def.ranged === undefined) return;
  if (!player.removeItem('arrow', 1)) {
    say('out of arrows');
    player.useCooldown = 0.5;
    return;
  }
  const { wx, wy } = cursorTile();
  const cx = player.body.x + player.body.w / 2;
  const cy = player.body.y + 12;
  const dist = Math.max(1, Math.hypot(wx - cx, wy - cy));
  const speed = 470;
  arrows.push(new Arrow(cx, cy, ((wx - cx) / dist) * speed, ((wy - cy) / dist) * speed, def.ranged + 8));
  player.facing = wx > cx ? 1 : -1;
  player.useCooldown = 0.42;
  playSound('shoot');
}

function damageEnemy(enemy: Enemy, amount: number, knockX: number): void {
  enemy.hurt(amount, knockX);
  addText(enemy.body.x + enemy.body.w / 2, enemy.body.y, amount, '#ffe08a');
  playSound('hit');
}

function applySwingDamage(): void {
  if (!player.swinging) return;
  const b = player.body;
  const w = 26;
  const x = player.facing > 0 ? b.x + b.w - 2 : b.x - w + 2;
  const damage = player.weaponDamage();
  for (const e of enemies) {
    if (player.swingHits.has(e.id)) continue;
    if (!rectOverlapsBody(x, b.y + 2, w, 26, e.body)) continue;
    player.swingHits.add(e.id);
    damageEnemy(e, damage, player.facing * 190);
  }
}

// ------------------------------------------------------------------ spawning

function trySpawnEnemy(daylight: number): void {
  if (enemies.length >= MAX_ENEMIES) return;
  const px = Math.floor((player.body.x + player.body.w / 2) / TILE);
  const py = Math.floor((player.body.y + player.body.h / 2) / TILE);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const tx = px + dir * (26 + Math.floor(Math.random() * 20));
  if (tx < 2 || tx >= world.w - 2) return;

  const underground = py > world.height[Math.max(0, Math.min(world.w - 1, px))] + 10;
  let ty: number;
  if (underground) {
    ty = py + Math.floor(Math.random() * 24) - 12;
    if (ty <= world.height[tx] + 6) return;
  } else {
    if (daylight > 0.25) return;
    ty = world.height[tx] - 1;
  }
  if (ty < 2 || ty >= world.h - 4) return;
  if (world.isSolid(tx, ty) || world.isSolid(tx, ty - 1)) return;

  const x = tx * TILE;
  const y = (ty - 1) * TILE;
  if (underground) {
    if (Math.random() < 0.45) enemies.push(new Bat(x, y));
    else if (world.isSolid(tx, ty + 1)) enemies.push(new Slime(x, y, Math.random() < 0.35));
    return;
  }
  if (!world.isSolid(tx, ty + 1)) return;
  if (Math.random() < 0.4) enemies.push(new Zombie(x, y - TILE));
  else enemies.push(new Slime(x, y, Math.random() < 0.2));
}

function killEnemy(enemy: Enemy): void {
  for (const loot of enemyLoot(enemy)) {
    drops.push(new ItemDrop(enemy.body.x, enemy.body.y, loot.id, loot.count));
  }
  const color = enemy.kind === 'zombie' ? '#7ba368' : enemy.kind === 'bat' ? '#6b5478' : '#63b7e8';
  for (let i = 0; i < 8; i++) {
    particles.push(new Particle(enemy.body.x + enemy.body.w / 2, enemy.body.y + enemy.body.h / 2, color, 3));
  }
  playSound('kill');
  if (enemy === boss) {
    boss = null;
    shake = 14;
    say('King Slime defeated');
  }
}

function newWorld(): void {
  if (!confirm('Delete this world and generate a new one?')) return;
  clearSave();
  location.reload();
}

// ---------------------------------------------------------------- game loop

function hudState(): HudState {
  const phase = (elapsed % DAY_LENGTH) / DAY_LENGTH;
  const visible: number[] = [];
  for (let i = 0; i < RECIPES.length; i++) {
    const r = RECIPES[i];
    if (r.station === 0 || stations.has(r.station)) visible.push(i);
  }
  return {
    player,
    craftOpen,
    chest: openChest,
    visibleRecipes: visible,
    day: Math.floor(elapsed / DAY_LENGTH) + 1,
    clock: clockText(phase),
    showHints: hintTimer > 0,
    message,
    boss: boss ? { name: 'King Slime', hp: boss.hp, maxHp: boss.maxHp } : null,
  };
}

function update(dt: number): void {
  elapsed += dt;
  hintTimer -= dt;
  placeCooldown = Math.max(0, placeCooldown - dt);
  shake = Math.max(0, shake - dt * 26);
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) message = null;
  }

  autosaveTimer -= dt;
  if (autosaveTimer <= 0) {
    autosaveTimer = AUTOSAVE_INTERVAL;
    if (savingEnabled && saveGame(world, player, seed, elapsed)) say('game saved');
  }

  const phase = (elapsed % DAY_LENGTH) / DAY_LENGTH;
  const daylight = daylightAt(phase);

  player.canDoubleJump = player.countOf('cloud_bottle') > 0;

  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) player.respawn(world);
  } else {
    const input = {
      left: keys.has('KeyA') || keys.has('ArrowLeft'),
      right: keys.has('KeyD') || keys.has('ArrowRight'),
      jumpHeld: keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp'),
      jumpPressed,
    };
    const res = player.update(dt, world, input);
    if (res.jumped) playSound('jump');
    if (res.doubleJumped) {
      for (let i = 0; i < 6; i++) {
        particles.push(new Particle(player.body.x + player.body.w / 2, player.body.y + player.body.h, '#dfe8f5', 3));
      }
    }
    if (res.fallDamage > 0 && player.hurt(res.fallDamage, 0)) {
      addText(player.body.x + player.body.w / 2, player.body.y, res.fallDamage, '#ff8a8a');
      playSound('hurt');
      shake = 5;
    }
  }
  jumpPressed = false;

  if (player.dead && player.hp <= 0 && player.respawnTimer > 2.4) playSound('die');

  updateStations();

  if (openChest) {
    const dx = Math.abs(player.body.x / TILE - openChestTile.x);
    const dy = Math.abs(player.body.y / TILE - openChestTile.y);
    if (dx > 8 || dy > 8) openChest = null;
  }

  if (!player.dead) {
    if (mouseLeft) {
      const slot = player.held();
      const def = slot ? ITEMS[slot.id] : null;
      if (def?.damage !== undefined) trySwing();
      else if (def?.ranged !== undefined) tryShoot();
      else tryMine(dt);
    } else {
      mineProgress = 0;
      mineX = -1;
    }
    if (mouseRight && placeCooldown <= 0) tryUse();
  }
  applySwingDamage();

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 1.4;
    trySpawnEnemy(daylight);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.update(dt, world, player, enemyCtx);
    const far = Math.abs(e.body.x - player.body.x) > 95 * TILE;
    if (e.hp <= 0) {
      killEnemy(e);
      enemies.splice(i, 1);
    } else if (far && e !== boss) {
      enemies.splice(i, 1);
    }
  }

  for (let i = arrows.length - 1; i >= 0; i--) {
    if (arrows[i].update(dt, world, enemies, enemyCtx)) arrows.splice(i, 1);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    if (drops[i].update(dt, world, player)) {
      drops.splice(i, 1);
      playSound('pickup');
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].update(dt)) particles.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    if (texts[i].update(dt)) texts.splice(i, 1);
  }

  const view = viewSize();
  const targetX = player.body.x + player.body.w / 2 - view.w / 2;
  const targetY = player.body.y + player.body.h / 2 - view.h / 2;
  const k = 1 - Math.pow(0.0015, dt);
  cam.x += (targetX - cam.x) * k;
  cam.y += (targetY - cam.y) * k;
  cam.x = Math.max(0, Math.min(world.w * TILE - view.w, cam.x));
  cam.y = Math.max(0, Math.min(world.h * TILE - view.h, cam.y));

  minimapTimer -= dt;
  if (minimapOn && minimapTimer <= 0) {
    minimapTimer = 0.4;
    refreshMinimap(world, Math.floor(player.body.x / TILE), Math.floor(player.body.y / TILE));
  }
}

function render(): void {
  const view = viewSize();
  const phase = (elapsed % DAY_LENGTH) / DAY_LENGTH;
  const daylight = daylightAt(phase);
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawSky(ctx, window.innerWidth, window.innerHeight, daylight, phase, cam, world.height[Math.floor(world.w / 2)]);

  const camX = cam.x + shakeX;
  const camY = cam.y + shakeY;
  ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, -camX * dpr * ZOOM, -camY * dpr * ZOOM);

  const tileView: View = {
    x0: Math.floor(camX / TILE) - 1,
    y0: Math.floor(camY / TILE) - 1,
    w: Math.ceil(view.w / TILE) + 3,
    h: Math.ceil(view.h / TILE) + 3,
  };
  const lightView: View = { x0: tileView.x0 - 8, y0: tileView.y0 - 8, w: tileView.w + 16, h: tileView.h + 16 };

  drawTiles(ctx, world, tileView, atlas);
  if (mineX >= 0) drawMining(ctx, mineX, mineY, mineProgress);

  const cursor = cursorTile();
  if (!craftOpen && !openChest) drawCursor(ctx, cursor.tx, cursor.ty, cursor.inReach);

  drawDrops(ctx, drops, elapsed);
  drawEnemies(ctx, enemies);
  drawArrows(ctx, arrows);
  drawSwingArc(ctx, player);
  drawPlayer(ctx, player, elapsed);
  drawParticles(ctx, particles);
  drawFloatingTexts(ctx, texts);

  world.computeLight(lightView.x0, lightView.y0, lightView.w, lightView.h, Math.round(4 + 11 * daylight));
  drawLight(ctx, world, lightView);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (minimapOn) {
    drawMinimap(
      ctx,
      window.innerWidth - MINIMAP_W - 16,
      52,
      enemies,
      Math.floor(player.body.x / TILE),
      Math.floor(player.body.y / TILE),
    );
  }
  drawHud(ctx, window.innerWidth, window.innerHeight, hudState(), mouse);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function start(): void {
  const save = savingEnabled ? loadSave() : null;
  if (save) seed = save.seed;
  world = new World(save ? save.w : WORLD_W, save ? save.h : WORLD_H, seed);
  player = new Player(world.spawnX, world.spawnY);
  if (save) {
    applySave(save, world, player);
    elapsed = save.time;
    say('world loaded');
  } else {
    player.addItem('wood_pick', 1);
    player.addItem('wood_sword', 1);
    player.addItem('torch', 15);
    if (!savingEnabled) say(`seed ${seed} - this world is not saved`);
  }
  resize();
  cam.x = player.body.x - viewSize().w / 2;
  cam.y = player.body.y - viewSize().h / 2;
  refreshMinimap(world, Math.floor(player.body.x / TILE), Math.floor(player.body.y / TILE));
  document.getElementById('loading')?.remove();
  ready = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

setTimeout(start, 30);
