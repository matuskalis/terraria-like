import { Slot } from './items';
import { Player } from './player';
import { World } from './world';

const KEY = 'terraria-like/save/v1';
const VERSION = 1;

export interface SaveData {
  v: number;
  seed: number;
  w: number;
  h: number;
  time: number;
  player: { x: number; y: number; hp: number; selected: number; inv: (Slot | null)[] };
  /** Flat pairs of [tile index, tile id] changed since generation. */
  edits: number[];
  chests: [number, (Slot | null)[]][];
}

export function saveGame(world: World, player: Player, seed: number, time: number): boolean {
  const edits: number[] = [];
  for (const [index, tile] of world.edits) edits.push(index, tile);
  const data: SaveData = {
    v: VERSION,
    seed,
    w: world.w,
    h: world.h,
    time,
    player: {
      x: player.body.x,
      y: player.body.y,
      hp: player.hp,
      selected: player.selected,
      inv: player.inv,
    },
    edits,
    chests: [...world.chests.entries()],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== VERSION || !data.player || !Array.isArray(data.edits)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

/** Replays a save onto a freshly generated world of the same seed. */
export function applySave(data: SaveData, world: World, player: Player): void {
  for (let i = 0; i < data.edits.length; i += 2) {
    const index = data.edits[i];
    world.setTile(index % world.w, Math.floor(index / world.w), data.edits[i + 1]);
  }
  for (const [index, slots] of data.chests) world.chests.set(index, slots);

  player.body.x = data.player.x;
  player.body.y = data.player.y;
  player.hp = data.player.hp;
  player.selected = data.player.selected;
  player.inv = data.player.inv;
}
