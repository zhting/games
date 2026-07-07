# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A lightweight **static site of small browser games**, deployed to Vercel at `https://games.tangletang.top`. No framework, no server, no package.json at the repo root — each game is a single self-contained `.html` file with inlined CSS and JS (Canvas 2D / raw DOM). Repo name: `zhting/games`.

## Two parallel layouts

There are two copies of the site in this repo. Understand which one you are editing:

- **Repo root (the live, deployed site).** Tracked in git. `index.html` is the hub; `/game` → `game/index.html` (果冻俄罗斯方块 / Jelly Tetris), `/成语` → `成语/index.html` (成语守卫战). The `lego/` and `果冻俄罗斯方块/` directories are git-ignored scratch/legacy copies — do not edit them expecting changes to deploy.
- **`games-optimized/` (untracked WIP restructure).** A flatter reorganization where everything lives under `games-optimized/games/`: `game/` (2D jelly), `game/3d/` (new three.js 3D version), `idiom/`, `lego/`. It has its own `vercel.json` with more rewrites (`/game/3d`, `/idiom`, `/lego`, plus `/成语` aliased to `/idiom`). `games-optimized.zip` is a packed snapshot of it. Changes here are **not** what's live — they need to be promoted to root (or the deployment swapped) to take effect.

When asked to "fix the game" or "update the site", confirm which layout the user means before editing.

## Vercel deployment

`vercel.json` uses `rewrites` (not filesystem routing) to map clean URLs to each game's `index.html`, plus `cleanUrls: true` and `trailingSlash: false`. Adding a new game means: drop an `index.html` somewhere, add a rewrite entry, and (if it should be reachable) link it from the hub. Headers only set `X-Content-Type-Options: nosniff`.

## Builds & tooling

- **No build step for 2D games** — edit the HTML directly and reload.
- **3D Jelly Tetris** (`games-optimized/games/game/3d/`) is the only thing with a build: source is `src/main.js` (uses three.js as an ES module), bundled+minified via esbuild and inlined into `index.html` (three.js is vendored, supports `file://` open). Full steps in `games-optimized/games/game/3d/src/BUILD.md`. The published artifact is the self-contained `index.html`; vendor copy lives in `src/vendor/` (e.g. `RoomEnvironment.js`).
- **No tests, no linter, no package manager at root.** Don't invent test commands.

## Jelly Tetris physics architecture (the largest/most complex game)

`game/index.html` (and the 2D version under `games-optimized/games/game/`) implements a **soft-body contour-mass-point simulation**, not rigid tetrominoes. Key concepts (names may differ slightly between the two layouts):

- Each block's outline is subdivided into mass points (`SUB = 3` segments per grid edge); only boundary vertices are simulated.
- Forces per substep (`PHYS_H = 1/180`): shape-keeping spring (`K_SHAPE`), surface tension on curvature deviation (`K_SURF`), area/volume pressure along outward normal (`K_PRESS`), global exponential damping (`DAMP`), and neighbor relative damping. End of each substep applies rigid-translation suppression to pin the body back onto the grid, plus a 0.75-cell deformation clamp and velocity clamp (`VMAX`) for stability.
- Rendering: `drawJellyLoops` (2D) / `drawJellyLoops3D` draw the jelly outline loops with gradient highlights.

`games-优化方案.md` is a detailed Chinese-language audit + optimization plan for this physics model (tuning constants, size-dependent frequency, selective damping, bottom anchoring, internal particles / Shape Matching, XPBD migration). **Treat it as the design doc for any jelly-physics work** — it documents the constants, the rationale, and the intended direction. When tuning feel, the constants named above are the knobs.

## Other games

- **成语守卫战 (idiom defense)** — `成语/index.html` / `games-optimized/games/idiom/index.html`. Single-file, ~960 lines.
- **乐高战争 (Lego War)** — standalone HTML at `lego/designs/lego-war/Lego War.html` (gitignored; design-stage).

## Conventions

- All UI text is Chinese (`lang="zh-CN"`); match the existing tone in copy.
- Games are designed mobile-first with `touch-action: manipulation` and rounded "jelly" glass aesthetic (CSS custom properties like `--ink`, `--glass`, `--accent`). Follow the existing visual language when adding UI.
- `playlist.m3u` is a large (≈780KB) local media playlist, git-ignored — leave it alone.
