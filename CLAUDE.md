# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a lightweight static mini-game site deployed at `https://games.tangletang.top`. The entire site consists of plain HTML files with no build system, no framework, and no bundler — each game is a single self-contained `.html` file.

### Routes

| Path | Game | Description |
|------|------|-------------|
| `/` | Landing page | Hub linking to all games |
| `/game` | Jelly Tetris | Soft-body physics Tetris with classic, melt, fluid, and 2.5D iso modes |
| `/game/3d` | Jelly Tetris 3D | True 3D version with physical refraction and reflections (Three.js) |
| `/idiom` (also `/成语`) | Idiom Defender | Card-based tower defense using Chinese idiom antonyms |
| `/lego` | Lego War | Placement/automation game with buildings, unit training, and auto-battles |

### Deployment

Deployed to Vercel. Configuration is in `vercel.json` — all route paths without extensions rewrite to `index.html` for SPA-style serving. No server-side logic; entirely client-side static assets.

## Per-Game Architecture

### Jelly Tetris (`game/index.html`, ~1800 lines)

- **Single HTML file** with embedded CSS and vanilla JS.
- **Soft-body physics engine**: Each tetromino is a `SoftBody` composed of point-mass chains (subdivided contour loops) driven by shape-keeping springs, surface tension springs, volume pressure, and velocity damping. Physics runs at 1/180s substeps.
- **Rendering**: Canvas 2D with custom jelly shading — specular highlights, subsurface scattering, caustics, refraction (background mesh sampled through the jelly), and edge Beer-Lambert darkening.
- **Modes**:
  - `classic`: Traditional Tetris with soft-body jelly pieces.
  - `melt`: Pieces slump into amorphous blobs on land; same-color 4-connected regions that span left-to-right dissolve.
  - `fluid`: Pieces disintegrate into wet-sand grains on a sub-cell grid; connected same-color regions spanning the board clear.
  - `iso`: 2.5D extruded jelly with thickness walls and dome highlights.
- **Input**: Keyboard (arrows, space, Z/X) + touch controls with pointer capture for sustained holds.
- **Bag randomizer**: Standard 7-bag system for piece spawning.

#### Building `game/3d` (Three.js version)

Requires Node.js. Edit `game/3d/src/main.js` for logic changes, then bundle:
```bash
npm pack three@0.185.1 && tar xzf three-*.tgz
npx esbuild src/main.js --bundle --minify --format=iife \
  --alias:three=./package/build/three.module.min.js --outfile=bundle.js
```
Then inject `bundle.js` into `src/template.html` at the `<!--BUNDLE-->` placeholder, outputting `game/3d/index.html`.

### Idiom Defender (`idiom/index.html`, ~970 lines)

- **Single HTML file**, vanilla JS + DOM manipulation (no canvas).
- **Antonym database**: 47 pairs of Chinese idioms stored as a flat array, with O(1) lookup via `wordMap` hash.
- **Gameplay loop**: `requestAnimationFrame` game loop moves soldier DOM elements across a battlefield. Player selects cards from a hand (6 cards, refreshable on cooldown). Attack cards spawn offensive soldiers; defense cards spawn counter-soldiers that target the antonym enemy.
- **AI**: Enemy spawns soldiers at intervals that decrease per wave (4.0s → 2.0s minimum). AI occasionally plays defense cards (15% → 50% chance per wave).
- **Wave system**: 10 waves, enemy spawn frequency increases per wave. Win by surviving all 10 waves.
- **Persistent best wave** stored in `localStorage` as `idiomBestWave`.

### Lego War (`lego/index.html`, ~1040 lines)

- **Single HTML file**, vanilla JS + DOM manipulation.
- **Four tabs**: Base (buildings), Forge (construct/train), Battle (fight enemies), Shop (buy resources).
- **Building system**: 7 building types (HQ, Workshop, Barracks, Tower, Market, Mine, Temple), each with levels and production rates. Temple provides global output multiplier (+20%/level).
- **Unit system**: 6 unit types with ATK/HP stats, unlocked progressively (lab unlocks advanced units).
- **Auto-production**: Resources generated every second based on building levels. Offline gains calculated on return (capped at 8 hours), stored in `localStorage` as `legoWar2`.
- **Battle**: Turn-based simulation with random damage (40-60% of total power). Soldier losses on both sides.
- **Persistence**: Auto-saves every 15 seconds + on page hide.

## Key Patterns Across All Games

1. **No dependencies** — all games are pure vanilla JS with inline CSS. No npm packages, no frameworks.
2. **`localStorage` for persistence** — each game uses its own key (`legoWar2`, `idiomBestWave`).
3. **Mobile-first** — all games support touch input, use `user-scalable=no` viewport meta, and have responsive layouts.
4. **Single-file architecture** — each game is one `.html` file. This makes deployment trivial (static hosting) but means code sharing between games is manual.
5. **Chinese-language UI** — all game text is in Simplified Chinese.
6. **No test infrastructure** — games are tested manually in-browser.

## Common Development Tasks

- **Adding a new game**: Create a new directory under the root with an `index.html` file. Add a route rewrite in `vercel.json` and a card link in `index.html`.
- **Editing a game**: Each game is edited in its single `index.html` file. The CSS is in a `<style>` block at the top, JS in a `<script>` block at the bottom.
- **Hot reload locally**: Since these are static files, serve with any static server (e.g., `npx serve .` or Python's `python -m http.server`).
