import { Arrow, Enemy, FloatingText, ItemDrop, Particle } from './entities';
import { ITEMS } from './items';
import { Player } from './player';
import { mulberry32 } from './rng';
import { AIR, CHEST, FURNACE, LEAVES, TILES, TORCH, TREE, WORKBENCH } from './tiles';
import { TILE, World } from './world';

export const ZOOM = 3;
export const ATLAS_VARIANTS = 4;

export interface Camera {
  x: number;
  y: number;
}

export interface View {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export function buildAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * ATLAS_VARIANTS;
  canvas.height = TILE * TILES.length;
  const ctx = canvas.getContext('2d')!;

  for (let t = 0; t < TILES.length; t++) {
    const def = TILES[t];
    if (t === AIR) continue;
    for (let v = 0; v < ATLAS_VARIANTS; v++) {
      ctx.save();
      ctx.translate(v * TILE, t * TILE);
      const rand = mulberry32(t * 131 + v * 977 + 7);
      drawTileArt(ctx, t, def.color, def.accent, rand);
      ctx.restore();
    }
  }
  return canvas;
}

function drawTileArt(
  ctx: CanvasRenderingContext2D,
  t: number,
  color: string,
  accent: string,
  rand: () => number,
): void {
  if (t === TREE) {
    ctx.fillStyle = color;
    ctx.fillRect(4, 0, 8, TILE);
    ctx.fillStyle = accent;
    for (let i = 0; i < 3; i++) ctx.fillRect(4 + Math.floor(rand() * 6), Math.floor(rand() * TILE), 2, 3);
    return;
  }
  if (t === TORCH) {
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(7, 6, 2, 9);
    ctx.fillStyle = color;
    ctx.fillRect(6, 2, 4, 6);
    ctx.fillStyle = accent;
    ctx.fillRect(7, 3, 2, 3);
    return;
  }
  if (t === WORKBENCH) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 4, TILE, 4);
    ctx.fillStyle = color;
    ctx.fillRect(2, 8, 3, 8);
    ctx.fillRect(11, 8, 3, 8);
    ctx.fillRect(5, 9, 6, 2);
    return;
  }
  if (t === FURNACE) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#33333a';
    ctx.fillRect(1, 1, TILE - 2, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(4, 8, 8, 6);
    ctx.fillStyle = '#ffd08a';
    ctx.fillRect(6, 10, 4, 3);
    return;
  }
  if (t === CHEST) {
    ctx.fillStyle = color;
    ctx.fillRect(1, 5, 14, 10);
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(1, 3, 14, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(7, 7, 2, 4);
    ctx.fillRect(1, 9, 14, 1);
    return;
  }
  if (t === LEAVES) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    for (let i = 0; i < 5; i++) ctx.fillRect(2 + Math.floor(rand() * 12), 2 + Math.floor(rand() * 12), 2, 2);
    return;
  }

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = accent;
  for (let i = 0; i < 7; i++) {
    const s = 1 + Math.floor(rand() * 3);
    ctx.fillRect(Math.floor(rand() * (TILE - s)), Math.floor(rand() * (TILE - s)), s, s);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, 0, TILE, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, TILE - 2, TILE, 2);
}

export function drawSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  daylight: number,
  dayPhase: number,
  cam: Camera,
  surfaceY: number,
): void {
  const depth = Math.max(0, Math.min(1, (cam.y - surfaceY * TILE) / (140 * TILE)));
  const top = mix3([10, 16, 34], [96, 176, 255], daylight);
  const bottom = mix3([18, 26, 48], [186, 226, 255], daylight);
  const cave: [number, number, number] = [12, 11, 16];
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, rgb(mixArr(top, cave, depth)));
  g.addColorStop(1, rgb(mixArr(bottom, cave, depth)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  if (depth > 0.85) return;
  ctx.globalAlpha = 1 - depth / 0.85;
  const isDay = dayPhase < 0.62;
  const t = isDay ? dayPhase / 0.62 : (dayPhase - 0.62) / 0.38;
  const cx = width * (0.08 + 0.84 * t);
  const cy = height * 0.78 - Math.sin(t * Math.PI) * height * 0.62;
  ctx.fillStyle = isDay ? '#fff3c4' : '#e8ecf5';
  ctx.beginPath();
  ctx.arc(cx, cy, isDay ? 26 : 20, 0, Math.PI * 2);
  ctx.fill();
  if (!isDay) {
    ctx.fillStyle = 'rgba(150,160,185,0.5)';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 4, 5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy + 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawTiles(ctx: CanvasRenderingContext2D, world: World, view: View, atlas: HTMLCanvasElement): void {
  ctx.imageSmoothingEnabled = false;
  for (let j = 0; j < view.h; j++) {
    const ty = view.y0 + j;
    if (ty < 0 || ty >= world.h) continue;
    for (let i = 0; i < view.w; i++) {
      const tx = view.x0 + i;
      if (tx < 0 || tx >= world.w) continue;
      const t = world.tiles[world.idx(tx, ty)];
      if (t === AIR) continue;
      const variant = (tx * 7 + ty * 13) & (ATLAS_VARIANTS - 1);
      ctx.drawImage(atlas, variant * TILE, t * TILE, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
    }
  }
}

export function drawMining(ctx: CanvasRenderingContext2D, tx: number, ty: number, progress: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.4 * progress})`;
  ctx.fillRect(x, y, TILE, TILE);
  const stage = Math.min(3, Math.floor(progress * 4));
  ctx.strokeStyle = 'rgba(20,20,26,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= stage; i++) {
    ctx.moveTo(x + 2 + i * 4, y + 1);
    ctx.lineTo(x + 5 + i * 4, y + TILE - 1);
  }
  ctx.stroke();
}

export function drawCursor(ctx: CanvasRenderingContext2D, tx: number, ty: number, ok: boolean): void {
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,90,90,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
}

export function drawDrops(ctx: CanvasRenderingContext2D, drops: ItemDrop[], time: number): void {
  for (const d of drops) {
    const bob = Math.sin(time * 4 + d.body.x) * 1.5;
    drawItemIcon(ctx, d.itemId, d.body.x, d.body.y + bob, 8);
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[]): void {
  for (const e of enemies) {
    const b = e.body;
    if (e.kind === 'zombie') drawZombie(ctx, e);
    else if (e.kind === 'bat') drawBat(ctx, e);
    else drawBlob(ctx, e);

    if (e.hp < e.maxHp && e.kind !== 'king') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(b.x, b.y - 6, b.w, 3);
      ctx.fillStyle = '#68d95c';
      ctx.fillRect(b.x, b.y - 6, (b.w * Math.max(0, e.hp)) / e.maxHp, 3);
    }
  }
}

function drawBlob(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const b = e.body;
  const king = e.kind === 'king';
  const squash = Math.max(-0.25, Math.min(0.25, b.vy / 1600));
  const w = b.w * (1 - squash);
  const h = b.h * (1 + squash * 1.6);
  const x = b.x + (b.w - w) / 2;
  const y = b.y + b.h - h;
  ctx.fillStyle = e.hurtFlash > 0 ? '#ffd7d7' : king ? '#3f7fc4' : e.maxHp > 40 ? '#4f9ad8' : '#63b7e8';
  roundRect(ctx, x, y, w, h, king ? 12 : 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRect(ctx, x + 2, y + 2, w - 4, h * 0.35, 3);
  ctx.fill();
  ctx.fillStyle = '#14202c';
  const eyeY = y + h * 0.5;
  const eyeW = king ? 5 : 2;
  ctx.fillRect(x + w * 0.28, eyeY, eyeW, eyeW + 1);
  ctx.fillRect(x + w * 0.62, eyeY, eyeW, eyeW + 1);
  if (king) {
    ctx.fillStyle = '#e8c455';
    ctx.fillRect(x + w * 0.3, y - 7, w * 0.4, 5);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.3 + i * (w * 0.17), y - 11, 4, 5);
  }
}

function drawZombie(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const b = e.body;
  const zombie = e as Enemy & { facing: number; walkPhase: number };
  const swing = Math.sin(zombie.walkPhase) * 2;
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  ctx.fillStyle = e.hurtFlash > 0 ? '#ffd7d7' : '#3f5a3a';
  ctx.fillRect(x + 1, y + 18, 4, 10 + swing);
  ctx.fillRect(x + 7, y + 18, 4, 10 - swing);
  ctx.fillStyle = e.hurtFlash > 0 ? '#ffe2e2' : '#4f7a45';
  ctx.fillRect(x, y + 9, b.w, 10);
  ctx.fillStyle = e.hurtFlash > 0 ? '#fff' : '#7ba368';
  ctx.fillRect(x + 1, y, 10, 9);
  ctx.fillStyle = '#1a1f18';
  ctx.fillRect(zombie.facing > 0 ? x + 7 : x + 3, y + 3, 2, 2);
  // outstretched arms
  ctx.fillStyle = e.hurtFlash > 0 ? '#ffe2e2' : '#7ba368';
  ctx.fillRect(zombie.facing > 0 ? x + b.w : x - 8, y + 11, 8, 3);
}

function drawBat(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const b = e.body;
  const bat = e as Enemy & { wingPhase: number };
  const flap = Math.sin(bat.wingPhase) * 5;
  ctx.fillStyle = e.hurtFlash > 0 ? '#ffd7d7' : '#4b3a55';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + 5 - flap);
  ctx.lineTo(b.x + b.w / 2, b.y + 4);
  ctx.lineTo(b.x + b.w, b.y + 5 + flap);
  ctx.lineTo(b.x + b.w / 2, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff6a6a';
  ctx.fillRect(b.x + b.w / 2 - 2, b.y + 4, 1, 2);
  ctx.fillRect(b.x + b.w / 2 + 1, b.y + 4, 1, 2);
}

export function drawArrows(ctx: CanvasRenderingContext2D, arrows: Arrow[]): void {
  for (const a of arrows) {
    ctx.save();
    ctx.translate(a.body.x + a.body.w / 2, a.body.y + a.body.h / 2);
    ctx.rotate(a.angle);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-6, -1, 10, 2);
    ctx.fillStyle = '#d8d8e0';
    ctx.fillRect(4, -1.5, 4, 3);
    ctx.restore();
  }
}

export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]): void {
  ctx.font = 'bold 8px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  for (const t of texts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 1.6));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(t.text, t.x + 0.6, t.y + 0.6);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, time: number): void {
  const b = player.body;
  if (player.dead) return;
  if (player.invuln > 0 && Math.floor(time * 14) % 2 === 0) return;

  const walk = b.onGround && Math.abs(b.vx) > 8 ? Math.sin(time * 14) : 0;
  const x = Math.round(b.x);
  const y = Math.round(b.y);

  ctx.fillStyle = '#3b3b52';
  ctx.fillRect(x + 1, y + 18, 4, 10 + walk * 1.5);
  ctx.fillRect(x + 6, y + 18, 4, 10 - walk * 1.5);

  ctx.fillStyle = '#4c6fa8';
  ctx.fillRect(x, y + 9, b.w, 10);

  ctx.fillStyle = '#e8b892';
  ctx.fillRect(x + 1, y, 9, 9);
  ctx.fillStyle = '#6b3f22';
  ctx.fillRect(x, y - 1, 11, 4);
  ctx.fillRect(player.facing > 0 ? x : x + 9, y, 2, 5);
  ctx.fillStyle = '#22222c';
  ctx.fillRect(player.facing > 0 ? x + 6 : x + 3, y + 4, 2, 2);

  const slot = player.held();
  const def = slot ? ITEMS[slot.id] : null;
  const shoulderX = x + (player.facing > 0 ? b.w - 1 : 1);
  const shoulderY = y + 12;

  if (player.swinging && def?.damage !== undefined) {
    const p = player.swingProgress;
    const angle = (-2.1 + p * 2.7) * player.facing;
    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(angle);
    ctx.fillStyle = '#e8b892';
    ctx.fillRect(-2, -2, 4 * player.facing, 4);
    ctx.fillStyle = def.color;
    ctx.fillRect(0, -2, 4 * player.facing, 3);
    ctx.fillStyle = def.accent;
    ctx.fillRect(4 * player.facing, -2, 14 * player.facing, 3);
    ctx.restore();
  } else {
    ctx.fillStyle = '#e8b892';
    ctx.fillRect(shoulderX - (player.facing > 0 ? 0 : 3), shoulderY - 2, 3, 8);
    if (def) drawItemIcon(ctx, slot!.id, shoulderX + (player.facing > 0 ? 1 : -9), shoulderY - 2, 8);
  }
}

export function drawSwingArc(ctx: CanvasRenderingContext2D, player: Player): void {
  if (!player.swinging) return;
  const slot = player.held();
  if (!slot || ITEMS[slot.id].damage === undefined) return;
  const b = player.body;
  const cx = b.x + b.w / 2;
  const cy = b.y + 12;
  const p = player.swingProgress;
  ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - p)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const start = (-2.1 + p * 2.7) * player.facing;
  ctx.arc(cx, cy, 22, start - 0.7 * player.facing, start, player.facing < 0);
  ctx.stroke();
}

const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d')!;
let lightImage: ImageData | null = null;

export function drawLight(ctx: CanvasRenderingContext2D, world: World, view: View): void {
  if (lightCanvas.width !== view.w || lightCanvas.height !== view.h) {
    lightCanvas.width = view.w;
    lightCanvas.height = view.h;
    lightImage = lightCtx.createImageData(view.w, view.h);
  }
  const img = lightImage!;
  const data = img.data;
  for (let j = 0; j < view.h; j++) {
    for (let i = 0; i < view.w; i++) {
      const l = world.lightAt(i, j) / 15;
      const k = (j * view.w + i) * 4;
      data[k] = 4;
      data[k + 1] = 5;
      data[k + 2] = 10;
      data[k + 3] = Math.min(252, Math.round(Math.pow(1 - l, 1.15) * 255));
    }
  }
  lightCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, view.x0 * TILE, view.y0 * TILE, view.w * TILE, view.h * TILE);
  ctx.imageSmoothingEnabled = false;
}

export function drawItemIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number): void {
  const def = ITEMS[id];
  const s = size;
  switch (def.icon) {
    case 'block':
      ctx.fillStyle = def.color;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = def.accent;
      ctx.fillRect(x, y, s, s * 0.28);
      ctx.fillRect(x + s * 0.55, y + s * 0.5, s * 0.25, s * 0.25);
      break;
    case 'blob':
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.accent;
      ctx.beginPath();
      ctx.arc(x + s * 0.38, y + s * 0.36, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bar':
      ctx.fillStyle = def.color;
      ctx.fillRect(x, y + s * 0.3, s, s * 0.42);
      ctx.fillStyle = def.accent;
      ctx.fillRect(x + s * 0.1, y + s * 0.34, s * 0.8, s * 0.14);
      break;
    case 'pick':
      ctx.strokeStyle = def.color;
      ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.25, y + s * 0.85);
      ctx.lineTo(x + s * 0.7, y + s * 0.25);
      ctx.stroke();
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = Math.max(1, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.42, y + s * 0.12);
      ctx.quadraticCurveTo(x + s * 0.72, y + s * 0.3, x + s * 0.92, y + s * 0.5);
      ctx.stroke();
      break;
    case 'sword':
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = Math.max(1, s * 0.18);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.28, y + s * 0.78);
      ctx.lineTo(x + s * 0.85, y + s * 0.12);
      ctx.stroke();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = Math.max(1, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.12, y + s * 0.92);
      ctx.lineTo(x + s * 0.38, y + s * 0.62);
      ctx.stroke();
      break;
    case 'potion':
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s * 0.6, s * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8d8e4';
      ctx.fillRect(x + s * 0.38, y + s * 0.06, s * 0.24, s * 0.24);
      break;
    case 'torch':
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(x + s * 0.42, y + s * 0.4, s * 0.16, s * 0.55);
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s * 0.3, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.accent;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s * 0.3, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bow':
      ctx.strokeStyle = def.color;
      ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath();
      ctx.arc(x + s * 0.3, y + s * 0.5, s * 0.42, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.68, y + s * 0.12);
      ctx.lineTo(x + s * 0.68, y + s * 0.88);
      ctx.stroke();
      break;
    case 'arrow':
      ctx.strokeStyle = def.color;
      ctx.lineWidth = Math.max(1, s * 0.13);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y + s * 0.85);
      ctx.lineTo(x + s * 0.8, y + s * 0.2);
      ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.95, y + s * 0.05);
      ctx.lineTo(x + s * 0.62, y + s * 0.18);
      ctx.lineTo(x + s * 0.82, y + s * 0.38);
      ctx.closePath();
      ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = def.color;
      ctx.fillRect(x + s * 0.12, y + s * 0.5, s * 0.76, s * 0.28);
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + s * (0.14 + i * 0.3), y + s * 0.24, s * 0.16, s * 0.3);
      }
      ctx.fillStyle = def.accent;
      ctx.fillRect(x + s * 0.44, y + s * 0.58, s * 0.14, s * 0.12);
      break;
    case 'cloud':
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + s * 0.38, y + s * 0.5, s * 0.26, 0, Math.PI * 2);
      ctx.arc(x + s * 0.62, y + s * 0.44, s * 0.22, 0, Math.PI * 2);
      ctx.arc(x + s * 0.55, y + s * 0.66, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.7);
      break;
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function mix3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function mixArr(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return mix3(a, b, t);
}

function rgb(c: [number, number, number]): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

// ------------------------------------------------------------------ minimap

export const MINIMAP_W = 168;
export const MINIMAP_H = 112;

const miniCanvas = document.createElement('canvas');
miniCanvas.width = MINIMAP_W;
miniCanvas.height = MINIMAP_H;
const miniCtx = miniCanvas.getContext('2d')!;
let miniImage: ImageData | null = null;
const tileRgb = TILES.map((def) => {
  const n = parseInt(def.color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});

export function refreshMinimap(world: World, centerTx: number, centerTy: number): void {
  if (!miniImage) miniImage = miniCtx.createImageData(MINIMAP_W, MINIMAP_H);
  const data = miniImage.data;
  const x0 = centerTx - (MINIMAP_W >> 1);
  const y0 = centerTy - (MINIMAP_H >> 1);
  for (let j = 0; j < MINIMAP_H; j++) {
    for (let i = 0; i < MINIMAP_W; i++) {
      const t = world.get(x0 + i, y0 + j);
      const k = (j * MINIMAP_W + i) * 4;
      const sky = world.exposedToSky(x0 + i, y0 + j);
      if (t === AIR) {
        data[k] = sky ? 60 : 26;
        data[k + 1] = sky ? 92 : 28;
        data[k + 2] = sky ? 130 : 36;
      } else {
        const c = tileRgb[t];
        data[k] = c[0];
        data[k + 1] = c[1];
        data[k + 2] = c[2];
      }
      data[k + 3] = 255;
    }
  }
  miniCtx.putImageData(miniImage, 0, 0);
}

export function drawMinimap(ctx: CanvasRenderingContext2D, x: number, y: number, enemies: Enemy[], centerTx: number, centerTy: number): void {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(miniCanvas, x, y);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(140,152,180,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, MINIMAP_W - 1, MINIMAP_H - 1);

  for (const e of enemies) {
    const ex = x + MINIMAP_W / 2 + (e.body.x / TILE - centerTx);
    const ey = y + MINIMAP_H / 2 + (e.body.y / TILE - centerTy);
    if (ex < x || ex > x + MINIMAP_W || ey < y || ey > y + MINIMAP_H) continue;
    ctx.fillStyle = e.kind === 'king' ? '#ffd479' : '#ff6a6a';
    ctx.fillRect(ex - 1, ey - 1, e.kind === 'king' ? 4 : 2, e.kind === 'king' ? 4 : 2);
  }

  ctx.fillStyle = '#fff';
  ctx.fillRect(x + MINIMAP_W / 2 - 1, y + MINIMAP_H / 2 - 1, 3, 3);
  ctx.restore();
}
