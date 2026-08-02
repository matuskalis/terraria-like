import { FURNACE, WORKBENCH } from './tiles';

export interface Ingredient {
  id: string;
  count: number;
}

export interface Recipe {
  out: Ingredient;
  inputs: Ingredient[];
  /** 0 = craftable by hand, otherwise a tile id that must be nearby. */
  station: number;
}

export const RECIPES: Recipe[] = [
  { out: { id: 'plank', count: 4 }, inputs: [{ id: 'wood', count: 1 }], station: 0 },
  { out: { id: 'workbench', count: 1 }, inputs: [{ id: 'wood', count: 8 }], station: 0 },
  { out: { id: 'torch', count: 4 }, inputs: [{ id: 'wood', count: 1 }, { id: 'coal', count: 1 }], station: 0 },
  { out: { id: 'arrow', count: 5 }, inputs: [{ id: 'wood', count: 1 }, { id: 'stone', count: 1 }], station: 0 },

  { out: { id: 'furnace', count: 1 }, inputs: [{ id: 'stone', count: 20 }], station: WORKBENCH },
  { out: { id: 'wood_pick', count: 1 }, inputs: [{ id: 'plank', count: 8 }], station: WORKBENCH },
  { out: { id: 'wood_sword', count: 1 }, inputs: [{ id: 'plank', count: 6 }], station: WORKBENCH },
  { out: { id: 'brick', count: 4 }, inputs: [{ id: 'stone', count: 4 }], station: WORKBENCH },
  { out: { id: 'chest', count: 1 }, inputs: [{ id: 'plank', count: 8 }], station: WORKBENCH },
  { out: { id: 'bow', count: 1 }, inputs: [{ id: 'wood', count: 10 }], station: WORKBENCH },
  { out: { id: 'slime_crown', count: 1 }, inputs: [{ id: 'gel', count: 30 }, { id: 'gold_bar', count: 1 }], station: WORKBENCH },
  { out: { id: 'potion', count: 1 }, inputs: [{ id: 'gel', count: 5 }], station: WORKBENCH },
  { out: { id: 'iron_pick', count: 1 }, inputs: [{ id: 'iron_bar', count: 8 }, { id: 'plank', count: 3 }], station: WORKBENCH },
  { out: { id: 'iron_sword', count: 1 }, inputs: [{ id: 'iron_bar', count: 6 }, { id: 'plank', count: 2 }], station: WORKBENCH },
  { out: { id: 'gold_pick', count: 1 }, inputs: [{ id: 'gold_bar', count: 8 }, { id: 'plank', count: 3 }], station: WORKBENCH },
  { out: { id: 'gold_sword', count: 1 }, inputs: [{ id: 'gold_bar', count: 6 }, { id: 'plank', count: 2 }], station: WORKBENCH },

  { out: { id: 'iron_bar', count: 1 }, inputs: [{ id: 'iron_ore', count: 3 }], station: FURNACE },
  { out: { id: 'gold_bar', count: 1 }, inputs: [{ id: 'gold_ore', count: 3 }], station: FURNACE },
];
