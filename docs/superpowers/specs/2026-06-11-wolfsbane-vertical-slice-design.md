# Wolfsbane — Witcher 3–inspired browser RPG: vertical slice design

Approved by the user on 2026-06-11 (via Claude Code plan mode).

## Goal

A browser-playable, 3D third-person action RPG that captures the core Witcher 3 loop — take a monster contract, investigate with witcher senses, prepare with alchemy, fight with swords and signs, resolve through dialogue choices — at a scope one developer can ship.

## Decisions

| Decision | Choice |
|---|---|
| Form | 3D third-person |
| Scope | Vertical slice: one zone, one contract quest line |
| Engine | Babylon.js v9 |
| Art | Stylized low-poly CC0 packs (KayKit, Quaternius) + bundled animations |
| Must-have systems | Combat (melee + dodge + 3 signs), dialogue choices, inventory, alchemy & potions, witcher senses, day/night + weather, skill tree & leveling |
| Architecture | Feature modules + typed event bus; Svelte 5 overlay for all RPG UI |

## Tech stack (locked in stack interview)

- **pnpm** — package manager (user preference; never npm)
- **TypeScript (strict) + Vite**; Node LTS, single package
- **Babylon.js v9** (`@babylonjs/core`, `@babylonjs/loaders`); Babylon's built-in audio engine (v9 was current at scaffold time — plan originally said v8; APIs used are identical)
- **Havok physics** (`@babylonjs/havok` WASM) — character controller, collisions, melee shape casts
- **Svelte 5 (runes)** — RPG UI overlay around the Babylon canvas; game loop publishes to reactive stores
- **Vitest** — unit tests for pure logic; **svelte-check** for component type safety
- **Biome** — lint + format for TS (`.svelte` files: svelte-check + formatter defaults)
- **localStorage** saves; no backend
- **GitHub Pages** deploy via GitHub Actions (workflow also runs Vitest + Biome)

## Architecture

```
src/
  core/      game loop, typed event bus, input mapping, save/load
  world/     zone assembly, terrain, day/night cycle, weather
  actors/    player controller, third-person camera, NPCs, monster AI (FSMs)
  combat/    stats & damage, hitboxes, dodge i-frames, signs, lock-on
  systems/   quests (state machine), dialogue (data-driven trees),
             alchemy (recipes → timed buffs + toxicity), progression (XP/skills),
             senses (highlight mode)
  ui/        Svelte 5 overlay: HUD, dialogue box, inventory, alchemy, skill tree, journal, menus
  data/      items, recipes, dialogue trees, quest definitions, monster stats (TS/JSON)
public/assets/   GLB models, textures, audio
```

Rules:
- Systems communicate via the typed event bus (`enemy:killed`, `quest:advanced`, `time:nightfall`…), never by direct cross-imports.
- Game logic (damage math, recipe resolution, quest transitions) lives in pure functions/classes with **no Babylon imports** so it is unit-testable.
- Babylon scene graph is the entity layer — no ECS.
- The Svelte overlay never reaches into the engine: the game loop writes to reactive stores (HP, stamina, quest state, time of day) and UI actions go back through the event bus.

## Vertical slice content

- **Zone**: village of **Ravenbrook** + surrounding forest and a swampy lair (~500×500 m), low-poly terrain, day/night lighting, simple weather (clear/fog/rain).
- **Contract quest — "The Gravewight of Ravenbrook"**:
  1. Village elder offers a contract (dialogue with choices, negotiable reward).
  2. Investigate the attack site with witcher senses (desaturated post-process, glowing clues); follow a clue trail into the forest.
  3. Identify the monster; journal suggests brewing necrophage oil and a potion from local herbs.
  4. The Gravewight only appears at the lair at night (ties in day/night).
  5. Boss fight: melee combos, dodge, signs (Igni burn, Aard stagger, Quen shield).
  6. Resolution dialogue with a choice that changes the reward/epilogue.
- **Combat**: light/heavy attacks with combo chaining, stamina, dodge roll with i-frames, target lock-on, 3 signs on cooldowns; wolves as trash enemies; Gravewight boss.
- **Alchemy**: ~6 gatherable herbs + monster parts, 4 recipes (healing potion, necrophage oil, damage tonic, night-vision potion), timed buffs, toxicity cap.
- **Progression**: XP from kills/quest steps, levels, 3×3 skill tree (Combat / Signs / Alchemy).
- **Save/load**: player state, quest state, inventory, time of day → localStorage.

## Implementation phases

Each phase ends with a playable build and lives on its own feature branch (`feature/<phase>-<short-description>`). One implementation plan per phase in `docs/superpowers/plans/`.

1. **Scaffold & first render** — Vite + TS + Svelte 5 + Babylon + Havok; ground, sky, capsule player, WASD + third-person camera.
2. **Character & animation** — rigged GLB, animation state machine, camera collision + lock-on.
3. **Combat core** — stats/damage (tested), hitboxes, dodge i-frames, stamina, 3 signs, wolf AI, Svelte HUD.
4. **World** — Ravenbrook village + forest + lair, collisions, day/night, weather, ambient audio.
5. **Dialogue & quests** — interaction prompts, dialogue trees, quest state machine, journal UI, NPCs.
6. **Witcher senses & quest content** — senses mode, clue trail, night-gated boss, resolution branches.
7. **Inventory & alchemy** — items/loot, herb gathering, inventory + alchemy UI, buffs + toxicity.
8. **Progression** — XP, levels, skill tree UI + effects.
9. **Save/load, menus & polish** — main menu, localStorage saves, audio/performance pass, GitHub Pages deploy via Actions.

## Verification strategy

- **Per phase**: manual play check in the browser against the phase's criteria.
- **Continuous**: Vitest on all pure-logic modules; `pnpm check` = Biome + svelte-check; CI runs both on every push (workflow lands in phase 9).
- **End of slice**: full quest playthrough with both endings; ~60 fps desktop; initial load < 15 MB gzipped.

## Git workflow

Root commit on `main` is empty; **all** work happens on feature branches — `feature/<phase>-<short-description>` — never commit directly to `main`. (No PBI numbers exist for this hobby project; phase numbers stand in.)
