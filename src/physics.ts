import { TILE, World } from './world';

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface MoveResult {
  hitX: boolean;
  hitY: boolean;
  landed: boolean;
}

export function moveBody(b: Body, world: World, dt: number): MoveResult {
  b.x += b.vx * dt;
  const hitX = resolveX(b, world);
  b.y += b.vy * dt;
  const wasFalling = b.vy > 0;
  const hitY = resolveY(b, world);
  b.onGround = hitY && wasFalling;
  return { hitX, hitY, landed: b.onGround };
}

function resolveX(b: Body, world: World): boolean {
  if (b.vx === 0) return false;
  const y0 = Math.floor(b.y / TILE);
  const y1 = Math.floor((b.y + b.h - 0.01) / TILE);
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!world.isSolid(tx, ty)) continue;
      b.x = b.vx > 0 ? tx * TILE - b.w : (tx + 1) * TILE;
      b.vx = 0;
      return true;
    }
  }
  return false;
}

function resolveY(b: Body, world: World): boolean {
  if (b.vy === 0) return false;
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  const y0 = Math.floor(b.y / TILE);
  const y1 = Math.floor((b.y + b.h - 0.01) / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      if (!world.isSolid(tx, ty)) continue;
      b.y = b.vy > 0 ? ty * TILE - b.h : (ty + 1) * TILE;
      b.vy = 0;
      return true;
    }
  }
  return false;
}

export function overlaps(a: Body, b: Body): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectOverlapsBody(x: number, y: number, w: number, h: number, b: Body): boolean {
  return x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y;
}

/** Terraria-style automatic 1-tile step up when walking into a ledge. */
export function tryStepUp(b: Body, world: World, dir: number): boolean {
  if (dir === 0) return false;
  const probeX = dir > 0 ? b.x + b.w + 1 : b.x - 1;
  const tx = Math.floor(probeX / TILE);
  const footTy = Math.floor((b.y + b.h - 1) / TILE);
  const headTy = Math.floor(b.y / TILE);
  if (!world.isSolid(tx, footTy)) return false;
  if (world.isSolid(tx, footTy - 1) || world.isSolid(tx, footTy - 2)) return false;
  if (world.isSolid(Math.floor((b.x + b.w / 2) / TILE), headTy - 1)) return false;
  b.y -= TILE;
  return true;
}
