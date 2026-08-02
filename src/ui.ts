import { ITEMS, Slot } from './items';
import { HOTBAR_SIZE, Player } from './player';
import { RECIPES } from './recipes';
import { drawItemIcon, roundRect } from './render';
import { TILES } from './tiles';

const SLOT = 46;
const GAP = 4;
const ROW_PITCH = SLOT + GAP;
const CHEST_COLS = 5;
const CHEST_ROWS = 4;

export interface HudState {
  player: Player;
  craftOpen: boolean;
  /** Contents of the chest the player has open, or null. */
  chest: (Slot | null)[] | null;
  /** Recipe indices currently unlocked by nearby stations. */
  visibleRecipes: number[];
  day: number;
  clock: string;
  showHints: boolean;
  message: string | null;
  boss: { name: string; hp: number; maxHp: number } | null;
  paused: boolean;
}

export type UiAction =
  | { kind: 'slot'; index: number }
  | { kind: 'craft'; recipe: number }
  | { kind: 'chest'; index: number };

function chestPanelRect(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const w = CHEST_COLS * ROW_PITCH - GAP + 24;
  const h = CHEST_ROWS * ROW_PITCH - GAP + 44;
  return { x: Math.round((width - w) / 2), y: Math.round(height * 0.5 - h - 40), w, h };
}

function hotbarOrigin(width: number, height: number): { x: number; y: number } {
  return { x: Math.round((width - (HOTBAR_SIZE * ROW_PITCH - GAP)) / 2), y: height - SLOT - 16 };
}

function craftPanelRect(height: number): { x: number; y: number; w: number; rowH: number } {
  return { x: 18, y: Math.max(96, height * 0.18), w: 306, rowH: 30 };
}

export function hitTest(mx: number, my: number, width: number, height: number, state: HudState): UiAction | null {
  const origin = hotbarOrigin(width, height);
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const x = origin.x + i * ROW_PITCH;
    if (mx >= x && mx <= x + SLOT && my >= origin.y && my <= origin.y + SLOT) return { kind: 'slot', index: i };
  }
  if (state.chest) {
    const panel = chestPanelRect(width, height);
    for (let i = 0; i < CHEST_COLS * CHEST_ROWS; i++) {
      const x = panel.x + 12 + (i % CHEST_COLS) * ROW_PITCH;
      const y = panel.y + 32 + Math.floor(i / CHEST_COLS) * ROW_PITCH;
      if (mx >= x && mx <= x + SLOT && my >= y && my <= y + SLOT) return { kind: 'chest', index: i };
    }
  }
  if (!state.craftOpen && !state.chest) return null;

  for (let r = 0; r < 3; r++) {
    const y = origin.y - (r + 1) * ROW_PITCH;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = origin.x + i * ROW_PITCH;
      if (mx >= x && mx <= x + SLOT && my >= y && my <= y + SLOT) {
        return { kind: 'slot', index: HOTBAR_SIZE + (2 - r) * HOTBAR_SIZE + i };
      }
    }
  }

  if (!state.craftOpen) return null;
  const panel = craftPanelRect(height);
  for (let i = 0; i < state.visibleRecipes.length; i++) {
    const y = panel.y + 34 + i * panel.rowH;
    if (mx >= panel.x && mx <= panel.x + panel.w && my >= y && my <= y + panel.rowH - 2) {
      return { kind: 'craft', recipe: state.visibleRecipes[i] };
    }
  }
  return null;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: HudState,
  mouse: { x: number; y: number },
): void {
  const { player } = state;
  const origin = hotbarOrigin(width, height);
  let hovered: string | null = null;

  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const x = origin.x + i * ROW_PITCH;
    if (drawSlot(ctx, x, origin.y, player.inv[i], i === player.selected, mouse)) hovered = player.inv[i]!.id;
    ctx.fillStyle = 'rgba(220,228,245,0.5)';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText(String((i + 1) % 10), x + 4, origin.y + 12);
  }

  if (state.craftOpen || state.chest) {
    for (let r = 0; r < 3; r++) {
      const y = origin.y - (r + 1) * ROW_PITCH;
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const index = HOTBAR_SIZE + (2 - r) * HOTBAR_SIZE + i;
        const x = origin.x + i * ROW_PITCH;
        if (drawSlot(ctx, x, y, player.inv[index], false, mouse)) hovered = player.inv[index]!.id;
      }
    }
  }
  if (state.craftOpen) drawCrafting(ctx, height, state, mouse);
  if (state.chest) {
    const panel = chestPanelRect(width, height);
    ctx.fillStyle = 'rgba(16,19,28,0.9)';
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,152,180,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#cfd8ee';
    ctx.fillText('Chest   (click to move items)', panel.x + 12, panel.y + 22);
    for (let i = 0; i < CHEST_COLS * CHEST_ROWS; i++) {
      const x = panel.x + 12 + (i % CHEST_COLS) * ROW_PITCH;
      const y = panel.y + 32 + Math.floor(i / CHEST_COLS) * ROW_PITCH;
      if (drawSlot(ctx, x, y, state.chest[i] ?? null, false, mouse)) hovered = state.chest[i]!.id;
    }
  }

  if (state.boss) drawBossBar(ctx, width, state.boss);
  drawLowHealthVignette(ctx, width, height, player);
  drawHealth(ctx, player);

  ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(220,228,245,0.85)';
  ctx.fillText(`Day ${state.day}   ${state.clock}`, width - 16, 28);
  ctx.textAlign = 'left';

  if (state.showHints) {
    const lines = [
      'A / D move   SPACE jump',
      'LEFT CLICK mine, swing or shoot   RIGHT CLICK place, drink, open chest',
      '1-0 select   WHEEL scroll   C crafting + inventory   M minimap   N new world',
    ];
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(210,220,240,0.6)';
    lines.forEach((line, i) => ctx.fillText(line, 16, height - SLOT - 46 + i * 15));
  }

  if (state.message) {
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,220,150,0.95)';
    ctx.fillText(state.message, width / 2, origin.y - 14);
    ctx.textAlign = 'left';
  }

  if (state.paused && !player.dead) {
    ctx.fillStyle = 'rgba(8,10,16,0.45)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(226,234,250,0.9)';
    ctx.font = '30px ui-monospace, Menlo, monospace';
    ctx.fillText('paused', width / 2, height / 2);
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(190,200,222,0.75)';
    ctx.fillText('click the window to resume', width / 2, height / 2 + 26);
    ctx.textAlign = 'left';
  }

  if (player.dead) {
    ctx.fillStyle = 'rgba(20,4,8,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff9a9a';
    ctx.font = '38px ui-monospace, Menlo, monospace';
    ctx.fillText('You died', width / 2, height / 2 - 10);
    ctx.font = '15px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(240,230,230,0.8)';
    ctx.fillText('respawning...', width / 2, height / 2 + 20);
    ctx.textAlign = 'left';
  }

  if (hovered) drawTooltip(ctx, hovered, mouse, width);
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  slot: { id: string; count: number } | null,
  selected: boolean,
  mouse: { x: number; y: number },
): boolean {
  const hover = mouse.x >= x && mouse.x <= x + SLOT && mouse.y >= y && mouse.y <= y + SLOT;
  ctx.fillStyle = selected ? 'rgba(58,68,92,0.92)' : hover ? 'rgba(38,45,62,0.9)' : 'rgba(22,26,36,0.82)';
  roundRect(ctx, x, y, SLOT, SLOT, 6);
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffd479' : 'rgba(120,134,163,0.5)';
  ctx.lineWidth = selected ? 2 : 1;
  roundRect(ctx, x + 0.5, y + 0.5, SLOT - 1, SLOT - 1, 6);
  ctx.stroke();

  if (!slot) return false;
  drawItemIcon(ctx, slot.id, x + 11, y + 11, 24);
  if (slot.count > 1) {
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8eefc';
    ctx.fillText(String(slot.count), x + SLOT - 4, y + SLOT - 5);
    ctx.textAlign = 'left';
  }
  return hover;
}

function drawBossBar(ctx: CanvasRenderingContext2D, width: number, boss: { name: string; hp: number; maxHp: number }): void {
  const w = Math.min(560, width - 120);
  const x = (width - w) / 2;
  const y = 58;
  ctx.fillStyle = 'rgba(12,14,22,0.85)';
  roundRect(ctx, x, y, w, 22, 6);
  ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#7a3fd0');
  g.addColorStop(1, '#4f9ad8');
  ctx.fillStyle = g;
  roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * (boss.hp / boss.maxHp)), 18, 4);
  ctx.fill();
  ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${boss.name}   ${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`, width / 2, y + 16);
  ctx.textAlign = 'left';
}

function drawLowHealthVignette(ctx: CanvasRenderingContext2D, width: number, height: number, player: Player): void {
  const ratio = player.hp / player.maxHp;
  if (ratio > 0.35 || player.dead) return;
  const strength = (0.35 - ratio) / 0.35;
  const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.62);
  g.addColorStop(0, 'rgba(180,20,40,0)');
  g.addColorStop(1, `rgba(180,20,40,${(0.5 * strength).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawHealth(ctx: CanvasRenderingContext2D, player: Player): void {
  const w = 210;
  ctx.fillStyle = 'rgba(16,18,26,0.8)';
  roundRect(ctx, 16, 16, w, 20, 5);
  ctx.fill();
  const ratio = player.hp / player.maxHp;
  const g = ctx.createLinearGradient(16, 0, 16 + w, 0);
  g.addColorStop(0, '#e04a5e');
  g.addColorStop(1, '#ff8f7a');
  ctx.fillStyle = g;
  roundRect(ctx, 18, 18, Math.max(0, (w - 4) * ratio), 16, 4);
  ctx.fill();
  ctx.font = '12px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 16 + w / 2, 30);
  ctx.textAlign = 'left';
}

function drawCrafting(
  ctx: CanvasRenderingContext2D,
  height: number,
  state: HudState,
  mouse: { x: number; y: number },
): void {
  const panel = craftPanelRect(height);
  const rows = state.visibleRecipes.length;
  const h = 34 + rows * panel.rowH + 8;
  ctx.fillStyle = 'rgba(16,19,28,0.88)';
  roundRect(ctx, panel.x, panel.y, panel.w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,134,163,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#cfd8ee';
  ctx.fillText('Crafting', panel.x + 12, panel.y + 22);

  for (let i = 0; i < rows; i++) {
    const recipe = RECIPES[state.visibleRecipes[i]];
    const y = panel.y + 34 + i * panel.rowH;
    const can = recipe.inputs.every((ing) => state.player.countOf(ing.id) >= ing.count);
    const hover = mouse.x >= panel.x && mouse.x <= panel.x + panel.w && mouse.y >= y && mouse.y <= y + panel.rowH - 2;
    if (hover) {
      ctx.fillStyle = 'rgba(80,96,132,0.35)';
      roundRect(ctx, panel.x + 4, y, panel.w - 8, panel.rowH - 2, 5);
      ctx.fill();
    }
    ctx.globalAlpha = can ? 1 : 0.4;
    drawItemIcon(ctx, recipe.out.id, panel.x + 12, y + 5, 18);
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillStyle = can ? '#e8eefc' : '#8b94ab';
    const label = recipe.out.count > 1 ? `${ITEMS[recipe.out.id].name} x${recipe.out.count}` : ITEMS[recipe.out.id].name;
    ctx.fillText(label, panel.x + 38, y + 14);
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillStyle = can ? 'rgba(190,200,220,0.75)' : 'rgba(150,158,178,0.6)';
    const cost = recipe.inputs
      .map((ing) => `${ITEMS[ing.id].name} ${state.player.countOf(ing.id)}/${ing.count}`)
      .join('  ');
    ctx.fillText(cost, panel.x + 38, y + 25);
    ctx.globalAlpha = 1;
  }
}

function drawTooltip(ctx: CanvasRenderingContext2D, id: string, mouse: { x: number; y: number }, width: number): void {
  const def = ITEMS[id];
  const lines = [def.name];
  if (def.damage !== undefined) lines.push(`${def.damage} damage`);
  if (def.tier !== undefined) lines.push(`pickaxe tier ${def.tier}`);
  if (def.heal !== undefined) lines.push(`restores ${def.heal} health`);
  if (def.tile !== undefined) lines.push(`places ${TILES[def.tile].name}`);

  ctx.font = '12px ui-monospace, Menlo, monospace';
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
  const h = lines.length * 15 + 10;
  const x = Math.min(mouse.x + 14, width - w - 8);
  const y = mouse.y - h - 10;
  ctx.fillStyle = 'rgba(12,14,22,0.92)';
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,152,180,0.4)';
  ctx.stroke();
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#fff' : 'rgba(190,200,222,0.8)';
    ctx.fillText(line, x + 8, y + 17 + i * 15);
  });
}
