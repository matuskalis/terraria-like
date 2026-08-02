export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;
export const LEAVES = 5;
export const COAL = 6;
export const IRON = 7;
export const GOLD = 8;
export const PLANK = 9;
export const WORKBENCH = 10;
export const TORCH = 11;
export const BRICK = 12;
export const SAND = 13;
export const FURNACE = 14;
export const BEDROCK = 15;
export const TREE = 16;
export const CHEST = 17;

export interface TileDef {
  name: string;
  color: string;
  accent: string;
  solid: boolean;
  hardness: number;
  minTier: number;
  opacity: number;
  emit: number;
  drop: string | null;
}

export const TILES: TileDef[] = [
  { name: 'air', color: '#000000', accent: '#000000', solid: false, hardness: 0, minTier: 0, opacity: 0, emit: 0, drop: null },
  { name: 'Grass', color: '#4e8b36', accent: '#69ad48', solid: true, hardness: 0.4, minTier: 0, opacity: 4, emit: 0, drop: 'dirt' },
  { name: 'Dirt', color: '#7a4f2a', accent: '#91603a', solid: true, hardness: 0.4, minTier: 0, opacity: 4, emit: 0, drop: 'dirt' },
  { name: 'Stone', color: '#6b6b73', accent: '#83838c', solid: true, hardness: 1.2, minTier: 0, opacity: 4, emit: 0, drop: 'stone' },
  { name: 'Wood', color: '#6b4423', accent: '#82552f', solid: true, hardness: 0.8, minTier: 0, opacity: 3, emit: 0, drop: 'wood' },
  { name: 'Leaves', color: '#2f7d34', accent: '#3f9c45', solid: false, hardness: 0.15, minTier: 0, opacity: 2, emit: 0, drop: null },
  { name: 'Coal Ore', color: '#6b6b73', accent: '#24242c', solid: true, hardness: 1.6, minTier: 0, opacity: 4, emit: 0, drop: 'coal' },
  { name: 'Iron Ore', color: '#6b6b73', accent: '#b98a63', solid: true, hardness: 2.0, minTier: 1, opacity: 4, emit: 0, drop: 'iron_ore' },
  { name: 'Gold Ore', color: '#6b6b73', accent: '#e0b74a', solid: true, hardness: 2.6, minTier: 2, opacity: 4, emit: 0, drop: 'gold_ore' },
  { name: 'Plank', color: '#a9763f', accent: '#c08c50', solid: true, hardness: 0.7, minTier: 0, opacity: 3, emit: 0, drop: 'plank' },
  { name: 'Workbench', color: '#8a5a2b', accent: '#c9a06a', solid: false, hardness: 0.6, minTier: 0, opacity: 1, emit: 0, drop: 'workbench' },
  { name: 'Torch', color: '#e8a33d', accent: '#fff2a8', solid: false, hardness: 0.05, minTier: 0, opacity: 0, emit: 13, drop: 'torch' },
  { name: 'Stone Brick', color: '#5a5a63', accent: '#767680', solid: true, hardness: 1.4, minTier: 0, opacity: 4, emit: 0, drop: 'brick' },
  { name: 'Sand', color: '#d9c37d', accent: '#e8d69a', solid: true, hardness: 0.35, minTier: 0, opacity: 4, emit: 0, drop: 'sand' },
  { name: 'Furnace', color: '#4a4a52', accent: '#ff8a3d', solid: true, hardness: 1.5, minTier: 0, opacity: 2, emit: 7, drop: 'furnace' },
  { name: 'Bedrock', color: '#26262c', accent: '#3a3a44', solid: true, hardness: 999, minTier: 99, opacity: 6, emit: 0, drop: null },
  { name: 'Tree', color: '#6b4423', accent: '#4e3119', solid: false, hardness: 0.5, minTier: 0, opacity: 1, emit: 0, drop: 'wood' },
  { name: 'Chest', color: '#8a5a2b', accent: '#e0b74a', solid: false, hardness: 0.9, minTier: 0, opacity: 1, emit: 0, drop: 'chest' },
];

export function isSolidTile(t: number): boolean {
  return TILES[t].solid;
}
