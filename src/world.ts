import { Slot } from './items';
import { fbm1, fbm2, mulberry32 } from './rng';
import { AIR, BEDROCK, CHEST, COAL, DIRT, GOLD, GRASS, IRON, LEAVES, SAND, STONE, TILES, TREE } from './tiles';

export const TILE = 16;
export const CHEST_SLOTS = 20;

export class World {
  readonly w: number;
  readonly h: number;
  readonly tiles: Uint8Array;
  /** y of the topmost light-blocking tile in each column (h if none). */
  readonly height: Int16Array;
  spawnX = 0;
  spawnY = 0;
  /** Contents of every chest, keyed by tile index. */
  readonly chests = new Map<number, (Slot | null)[]>();
  /** Tiles changed since generation, keyed by tile index. Only this needs saving. */
  readonly edits = new Map<number, number>();

  private tracking = false;
  private light = new Uint8Array(0);
  private decay = new Uint8Array(0);
  private lightW = 0;
  private lightH = 0;

  constructor(w: number, h: number, seed: number) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.height = new Int16Array(w).fill(h);
    this.generate(seed);
    this.computeHeights();
    this.placeSpawn();
    this.tracking = true;
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    if (y < 0) return AIR;
    if (x < 0 || x >= this.w || y >= this.h) return BEDROCK;
    return this.tiles[this.idx(x, y)];
  }

  isSolid(x: number, y: number): boolean {
    return TILES[this.get(x, y)].solid;
  }

  chestAt(x: number, y: number): (Slot | null)[] | null {
    if (!this.inBounds(x, y) || this.get(x, y) !== CHEST) return null;
    const key = this.idx(x, y);
    let slots = this.chests.get(key);
    if (!slots) {
      slots = new Array(CHEST_SLOTS).fill(null);
      this.chests.set(key, slots);
    }
    return slots;
  }

  setTile(x: number, y: number, t: number): void {
    if (!this.inBounds(x, y)) return;
    if (this.tracking) this.edits.set(this.idx(x, y), t);
    this.tiles[this.idx(x, y)] = t;
    if (TILES[t].opacity > 0) {
      if (y < this.height[x]) this.height[x] = y;
    } else if (y === this.height[x]) {
      let ny = y + 1;
      while (ny < this.h && TILES[this.tiles[this.idx(x, ny)]].opacity === 0) ny++;
      this.height[x] = ny;
    }
  }

  /** True when nothing blocks the sky above this tile. */
  exposedToSky(x: number, y: number): boolean {
    const cx = Math.max(0, Math.min(this.w - 1, x));
    return y < this.height[cx];
  }

  // ---------------------------------------------------------------- lighting

  computeLight(x0: number, y0: number, w: number, h: number, sky: number): void {
    if (this.lightW !== w || this.lightH !== h) {
      this.light = new Uint8Array(w * h);
      this.decay = new Uint8Array(w * h);
      this.lightW = w;
      this.lightH = h;
    }
    const light = this.light;
    const decay = this.decay;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tx = x0 + i;
        const ty = y0 + j;
        const def = TILES[this.get(tx, ty)];
        const k = j * w + i;
        decay[k] = def.opacity + 1;
        let v = def.emit;
        if (this.exposedToSky(tx, ty) && v < sky) v = sky;
        light[k] = v;
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < h; j++) {
        const row = j * w;
        for (let i = 1; i < w; i++) {
          const k = row + i;
          const v = light[k - 1] - decay[k];
          if (v > light[k]) light[k] = v;
        }
        for (let i = w - 2; i >= 0; i--) {
          const k = row + i;
          const v = light[k + 1] - decay[k];
          if (v > light[k]) light[k] = v;
        }
      }
      for (let i = 0; i < w; i++) {
        for (let j = 1; j < h; j++) {
          const k = j * w + i;
          const v = light[k - w] - decay[k];
          if (v > light[k]) light[k] = v;
        }
        for (let j = h - 2; j >= 0; j--) {
          const k = j * w + i;
          const v = light[k + w] - decay[k];
          if (v > light[k]) light[k] = v;
        }
      }
    }
  }

  lightAt(i: number, j: number): number {
    if (i < 0 || j < 0 || i >= this.lightW || j >= this.lightH) return 15;
    return this.light[j * this.lightW + i];
  }

  // ------------------------------------------------------------- generation

  private generate(seed: number): void {
    const rand = mulberry32(seed);
    const base = Math.floor(this.h * 0.3);
    const surf = new Int16Array(this.w);

    for (let x = 0; x < this.w; x++) {
      const broad = fbm1(x * 0.006, seed, 4) * 2 - 1;
      const detail = fbm1(x * 0.031, seed + 11, 3) * 2 - 1;
      const y = Math.floor(base + broad * 32 + detail * 6);
      surf[x] = Math.max(8, Math.min(this.h - 40, y));
    }

    for (let x = 0; x < this.w; x++) {
      const s = surf[x];
      const beach = s > base + 20;
      for (let y = s; y < this.h; y++) {
        const depth = y - s;
        let t: number;
        if (beach && depth < 5) t = SAND;
        else if (depth === 0) t = GRASS;
        else if (depth < 5 + Math.floor(fbm1(x * 0.05, seed + 5, 2) * 4)) t = DIRT;
        else t = STONE;
        this.tiles[this.idx(x, y)] = t;
      }
    }

    for (let x = 0; x < this.w; x++) {
      for (let y = surf[x] + 6; y < this.h - 4; y++) {
        const blob = fbm2(x * 0.045, y * 0.06, seed + 31, 3);
        const worm = Math.abs(fbm2(x * 0.021, y * 0.028, seed + 77, 2) - 0.5);
        if (blob > 0.63 || worm < 0.02) this.tiles[this.idx(x, y)] = AIR;
      }
    }

    const area = this.w * this.h;
    this.scatterOre(rand, COAL, Math.floor(area / 900), 6, this.h - 6, 10);
    this.scatterOre(rand, IRON, Math.floor(area / 1400), 24, this.h - 6, 8);
    this.scatterOre(rand, GOLD, Math.floor(area / 3200), 70, this.h - 6, 6);

    for (let x = 3; x < this.w - 3; x++) {
      if (rand() > 0.09) continue;
      const s = surf[x];
      if (this.tiles[this.idx(x, s)] !== GRASS) continue;
      this.growTree(x, s - 1, 4 + Math.floor(rand() * 5));
      x += 2;
    }

    for (let x = 0; x < this.w; x++) {
      for (let y = this.h - 3; y < this.h; y++) this.tiles[this.idx(x, y)] = BEDROCK;
    }

    this.placeCaveChests(rand, surf);
  }

  private placeCaveChests(rand: () => number, surf: Int16Array): void {
    const wanted = Math.floor((this.w * this.h) / 9000);
    let placed = 0;
    for (let attempt = 0; attempt < wanted * 40 && placed < wanted; attempt++) {
      const x = 2 + Math.floor(rand() * (this.w - 4));
      const y = surf[x] + 14 + Math.floor(rand() * (this.h - surf[x] - 22));
      if (y < 0 || y >= this.h - 4) continue;
      if (this.tiles[this.idx(x, y)] !== AIR || this.tiles[this.idx(x, y - 1)] !== AIR) continue;
      if (!TILES[this.tiles[this.idx(x, y + 1)]].solid) continue;
      this.tiles[this.idx(x, y)] = CHEST;
      this.chests.set(this.idx(x, y), this.rollLoot(rand, (y - surf[x]) / (this.h - surf[x])));
      placed++;
    }
  }

  private rollLoot(rand: () => number, depth: number): (Slot | null)[] {
    const slots: (Slot | null)[] = new Array(CHEST_SLOTS).fill(null);
    const staples: Slot[] = [
      { id: 'torch', count: 6 + Math.floor(rand() * 8) },
      { id: 'arrow', count: 10 + Math.floor(rand() * 15) },
      { id: 'potion', count: 1 + Math.floor(rand() * 2) },
    ];
    const shallow: Slot[] = [
      { id: 'coal', count: 4 + Math.floor(rand() * 8) },
      { id: 'plank', count: 8 + Math.floor(rand() * 12) },
      { id: 'gel', count: 4 + Math.floor(rand() * 8) },
      { id: 'bow', count: 1 },
    ];
    const deep: Slot[] = [
      { id: 'iron_bar', count: 2 + Math.floor(rand() * 4) },
      { id: 'gold_ore', count: 2 + Math.floor(rand() * 5) },
      { id: 'iron_pick', count: 1 },
      { id: 'iron_sword', count: 1 },
    ];
    const pool = depth > 0.45 ? deep : shallow;
    const picks = [staples[Math.floor(rand() * staples.length)], pool[Math.floor(rand() * pool.length)]];
    if (rand() < 0.5) picks.push(shallow[Math.floor(rand() * shallow.length)]);
    picks.forEach((item, i) => (slots[i] = item));
    return slots;
  }

  private scatterOre(rand: () => number, tile: number, count: number, minY: number, maxY: number, size: number): void {
    for (let n = 0; n < count; n++) {
      let x = Math.floor(rand() * this.w);
      let y = minY + Math.floor(rand() * Math.max(1, maxY - minY));
      const steps = 3 + Math.floor(rand() * size);
      for (let s = 0; s < steps; s++) {
        if (this.inBounds(x, y) && this.tiles[this.idx(x, y)] === STONE) this.tiles[this.idx(x, y)] = tile;
        x += Math.floor(rand() * 3) - 1;
        y += Math.floor(rand() * 3) - 1;
      }
    }
  }

  private growTree(x: number, y: number, trunk: number): void {
    for (let i = 0; i < trunk; i++) {
      const ty = y - i;
      if (ty < 1) return;
      if (this.tiles[this.idx(x, ty)] !== AIR) return;
      this.tiles[this.idx(x, ty)] = TREE;
    }
    const top = y - trunk;
    const r = 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const lx = x + dx;
        const ly = top + dy;
        if (!this.inBounds(lx, ly)) continue;
        if (this.tiles[this.idx(lx, ly)] === AIR) this.tiles[this.idx(lx, ly)] = LEAVES;
      }
    }
  }

  private computeHeights(): void {
    for (let x = 0; x < this.w; x++) {
      let y = 0;
      while (y < this.h && TILES[this.tiles[this.idx(x, y)]].opacity === 0) y++;
      this.height[x] = y;
    }
  }

  private placeSpawn(): void {
    const x = Math.floor(this.w / 2);
    let y = 0;
    while (y < this.h && !this.isSolid(x, y)) y++;
    for (let dx = -3; dx <= 3; dx++) {
      const tx = x + dx;
      if (tx < 0 || tx >= this.w) continue;
      let top = 0;
      while (top < this.h && !this.isSolid(tx, top)) top++;
      for (let ty = top - 4; ty < top; ty++) {
        if (ty >= 0 && this.tiles[this.idx(tx, ty)] !== AIR) this.setTile(tx, ty, AIR);
      }
    }
    this.spawnX = x * TILE;
    this.spawnY = (y - 3) * TILE;
  }
}
