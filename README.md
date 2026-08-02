# Terraria-like

A 2D survival sandbox in TypeScript + HTML5 canvas. Procedural world, block mining and
building, smooth tile lighting, day/night cycle, four enemy types, a boss, chests,
crafting, procedural sound, and localStorage saves. No engine, no runtime dependencies.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle into dist/
```

## Controls

| Input | Action |
| --- | --- |
| `A` / `D` (or arrows) | move (auto-steps up 1-tile ledges) |
| `Space` / `W` | jump (hold longer = higher; double jump with a Cloud in a Bottle) |
| Left click | mine, swing a sword, or fire a bow |
| Right click | place a block, drink a potion, open a chest, summon the boss |
| `1`–`0`, mouse wheel | select hotbar slot |
| `C` / `E` / `Tab` | crafting panel + full inventory |
| `M` | toggle minimap |
| `N` | delete the world and generate a new one (asks first) |
| `Esc` | close panels |
| click an inventory slot | swap it into the selected hotbar slot (or move it to an open chest) |

Reach is 5.5 tiles. Blocks only stick where they touch an existing tile.

## Progression

Chop trees → `wood` → `plank` → workbench → wooden pickaxe/sword/bow → stone → furnace →
`iron_bar` → iron gear → gold gear. Iron ore needs a tier-1 pickaxe, gold ore tier-2.
Arrows are 1 wood + 1 stone for 5. Slimes drop gel: 5 gel makes a healing potion, 30 gel
plus a gold bar makes the Slime Crown that summons the boss.

Underground chests (about 32 per world) hold torches, arrows, potions, bars and sometimes
an iron pickaxe, iron sword or bow — they are the main reason to explore caves early.

## Enemies

| Enemy | Where | Notes |
| --- | --- | --- |
| Slime | night surface, caves | hops toward you; big variant hits harder |
| Zombie | night surface | walks you down and jumps ledges |
| Bat | caves | flies, weaves, ignores terrain height |
| King Slime | summoned with a Slime Crown | 900 HP, spawns minions, enrages under 40% |

Health regenerates 2.5/s after 5 seconds without taking damage. Falling more than about
10 tiles hurts. Death respawns you at the world spawn after 2.5s with no item loss.

## Saving

The game autosaves to `localStorage` every 20 seconds and on page unload, and loads that
save on boot. A save stores the world seed plus only the tiles you changed, so it stays
around 5–10 KB instead of megabytes. Press `N` for a fresh world.

Two browser tabs share one save slot and will overwrite each other — play in one tab.

The simulation pauses while the window is unfocused, so nothing eats you in a background
tab.

## Sharing a world

`?seed=12345` generates that exact world. A forced seed runs as a throwaway session: it
never loads or overwrites your stored save, so you can hand someone a link to an
interesting world without losing your own.

## Code map

| File | Responsibility |
| --- | --- |
| `src/main.ts` | game loop, input, mining/placing/combat, spawning, camera, autosave |
| `src/world.ts` | tile array, generation, height map, lighting solver, chests |
| `src/tiles.ts` | tile table: colour, hardness, pickaxe tier, light opacity/emission, drop |
| `src/items.ts` | item table: icons, stack sizes, tools, damage, placed tile, passives |
| `src/recipes.ts` | crafting recipes and their required station |
| `src/player.ts` | player physics, inventory, regeneration, swing state |
| `src/entities.ts` | enemies, arrows, item drops, particles, floating text |
| `src/physics.ts` | AABB vs tile-grid collision, step-up helper |
| `src/render.ts` | tile atlas, sky, sprites, smooth light overlay, minimap |
| `src/ui.ts` | hotbar, health, crafting, chest panel, boss bar, tooltips, hit testing |
| `src/audio.ts` | WebAudio synthesis — every sound is generated, no audio files |
| `src/save.ts` | localStorage serialisation of seed, tile edits, chests and player |

Lighting is a 15-level flood over the visible tile rectangle (padded by 8 tiles), relaxed
with four directional sweeps twice per frame, then uploaded as a 1px-per-tile image and
bilinearly upscaled over the scene — that upscale is what makes the falloff look smooth.

## Adding content

- **A new block**: append to `TILES` in `src/tiles.ts` (index = tile id), add a matching
  item in `ITEMS` with `tile: <id>`, and a recipe in `RECIPES` if it should be craftable.
  `src/render.ts:drawTileArt` gets a special case only if it needs a non-block shape.
- **A new enemy**: extend `Enemy` in `src/entities.ts`, add a branch to `drawEnemies`, a
  loot row in `enemyLoot`, and spawn it from `trySpawnEnemy` in `src/main.ts`.
- **World size / seed**: `WORLD_W`, `WORLD_H` in `src/main.ts`; the seed is randomised on
  the first run and then kept in the save.

## Not implemented yet

Liquids, biomes, NPCs, armour, and multiplayer.
