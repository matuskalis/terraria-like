import { BRICK, CHEST, DIRT, FURNACE, GOLD, IRON, PLANK, SAND, STONE, TORCH, WOOD, WORKBENCH } from './tiles';

export type IconKind = 'block' | 'pick' | 'sword' | 'bar' | 'blob' | 'potion' | 'torch' | 'bow' | 'arrow' | 'crown' | 'cloud';

export interface Slot {
  id: string;
  count: number;
}

export interface ItemDef {
  name: string;
  color: string;
  accent: string;
  icon: IconKind;
  stack: number;
  /** Tile id this item places when used with right click. */
  tile?: number;
  /** Pickaxe stats. */
  tier?: number;
  speed?: number;
  /** Melee damage. */
  damage?: number;
  /** Ranged weapon: damage added to the arrow. */
  ranged?: number;
  /** Health restored when consumed. */
  heal?: number;
  /** Summons the boss when used. */
  summon?: boolean;
  /** Passive effect while carried. */
  passive?: 'double_jump';
}

export const ITEMS: Record<string, ItemDef> = {
  dirt: { name: 'Dirt', color: '#7a4f2a', accent: '#91603a', icon: 'block', stack: 999, tile: DIRT },
  stone: { name: 'Stone', color: '#6b6b73', accent: '#83838c', icon: 'block', stack: 999, tile: STONE },
  sand: { name: 'Sand', color: '#d9c37d', accent: '#e8d69a', icon: 'block', stack: 999, tile: SAND },
  wood: { name: 'Wood', color: '#6b4423', accent: '#82552f', icon: 'block', stack: 999, tile: WOOD },
  plank: { name: 'Plank', color: '#a9763f', accent: '#c08c50', icon: 'block', stack: 999, tile: PLANK },
  brick: { name: 'Stone Brick', color: '#5a5a63', accent: '#767680', icon: 'block', stack: 999, tile: BRICK },
  coal: { name: 'Coal', color: '#24242c', accent: '#4a4a55', icon: 'blob', stack: 999 },
  iron_ore: { name: 'Iron Ore', color: '#b98a63', accent: '#d8ac86', icon: 'blob', stack: 999, tile: IRON },
  gold_ore: { name: 'Gold Ore', color: '#e0b74a', accent: '#f6d878', icon: 'blob', stack: 999, tile: GOLD },
  iron_bar: { name: 'Iron Bar', color: '#c8c8d0', accent: '#eaeaf2', icon: 'bar', stack: 999 },
  gold_bar: { name: 'Gold Bar', color: '#e8c455', accent: '#fbe58c', icon: 'bar', stack: 999 },
  gel: { name: 'Gel', color: '#63b7e8', accent: '#a5dcff', icon: 'blob', stack: 999 },
  torch: { name: 'Torch', color: '#e8a33d', accent: '#fff2a8', icon: 'torch', stack: 999, tile: TORCH },
  workbench: { name: 'Workbench', color: '#8a5a2b', accent: '#c9a06a', icon: 'block', stack: 99, tile: WORKBENCH },
  furnace: { name: 'Furnace', color: '#4a4a52', accent: '#ff8a3d', icon: 'block', stack: 99, tile: FURNACE },
  chest: { name: 'Chest', color: '#8a5a2b', accent: '#e0b74a', icon: 'block', stack: 99, tile: CHEST },
  wood_pick: { name: 'Wooden Pickaxe', color: '#a9763f', accent: '#d8d8e0', icon: 'pick', stack: 1, tier: 1, speed: 1.0 },
  iron_pick: { name: 'Iron Pickaxe', color: '#a9763f', accent: '#dfe4ef', icon: 'pick', stack: 1, tier: 2, speed: 1.9 },
  gold_pick: { name: 'Gold Pickaxe', color: '#a9763f', accent: '#f3d271', icon: 'pick', stack: 1, tier: 3, speed: 2.8 },
  wood_sword: { name: 'Wooden Sword', color: '#a9763f', accent: '#c9a06a', icon: 'sword', stack: 1, damage: 12 },
  iron_sword: { name: 'Iron Sword', color: '#a9763f', accent: '#dfe4ef', icon: 'sword', stack: 1, damage: 22 },
  gold_sword: { name: 'Gold Sword', color: '#a9763f', accent: '#f3d271', icon: 'sword', stack: 1, damage: 34 },
  bow: { name: 'Wooden Bow', color: '#a9763f', accent: '#e8e2cf', icon: 'bow', stack: 1, ranged: 9 },
  arrow: { name: 'Arrow', color: '#8a6a44', accent: '#d8d8e0', icon: 'arrow', stack: 999 },
  potion: { name: 'Healing Potion', color: '#e2426a', accent: '#ff8fa8', icon: 'potion', stack: 20, heal: 40 },
  slime_crown: { name: 'Slime Crown', color: '#e8c455', accent: '#63b7e8', icon: 'crown', stack: 1, summon: true },
  cloud_bottle: { name: 'Cloud in a Bottle', color: '#dfe8f5', accent: '#9fb8d8', icon: 'cloud', stack: 1, passive: 'double_jump' },
};

export const HAND_TIER = 0;
export const HAND_SPEED = 0.45;
export const HAND_DAMAGE = 4;
