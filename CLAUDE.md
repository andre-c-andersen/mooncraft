# Moon Lander — project instructions

Browser lunar-lander arcade game. Vanilla HTML/CSS/JS with ES modules — no
build step, no dependencies. Deployed via GitHub Pages from master.

## Versioning — every change bumps

**Every pushed change bumps the version. No exceptions** — gameplay, fixes,
docs, tests, refactors, all of it. Players identify builds by the version in
the bottom-right HUD corner; two different builds must never share a label.

For each push:
1. Bump `VERSION` in `js/config.js`.
2. Update the version in the `README.md` title.
3. Tag it: `git tag vX.Y && git push origin vX.Y` (same commit as the change).

## Run locally

ES modules do not load from `file://` — serve over HTTP:

```
python3 -m http.server 8000    # then open http://localhost:8000
```

Debug query params (combinable): `?level=N` start level, `?cheat=max`
(all unlocks + 99 lives), `?cheat=god` (max + invulnerable). Cheated runs
never write saved progress.

## Tests — run before every push

```
node tests/smoke.mjs
node tests/restore-check.mjs
node tests/cheat-check.mjs
```

Headless, dependency-free: they stub the DOM, boot the real game, and drive
the loop frame by frame (see `tests/harness.mjs`). CI runs all three on every
push (`.github/workflows/tests.yml`). When changing gameplay, extend the
smoke test to cover it.

## Architecture

- `js/state.js` is the leaf module: the shared mutable `game` object plus
  derived helpers (`fuelCapacity`, `safeVY`, …) and localStorage persistence.
  Everything imports it; it imports only `config.js`.
- Entity modules own their update + draw: `terrain.js`, `lander.js`,
  `cannons.js`, `bombs.js`, `asteroids.js`, `particles.js`.
- `game.js` owns lifecycle (reset / advance / freshRun); `main.js` aggregates
  input and runs the loop; input lives in `js/input/` (keyboard, gamepad,
  touch — all three must be kept in feature parity).
- All tunable constants live in `js/config.js` — don't scatter magic numbers.

## Invariants — do not break

- **Fixed timestep**: physics constants are per-frame values tuned for 60 Hz.
  The simulation must step at a fixed 60 Hz decoupled from
  `requestAnimationFrame` (120 Hz+ displays used to run the game 2× fast).
  Never tie game speed to the render rate.
- **Fixed logical viewport**: the game world is `VIEW_W × VIEW_H` (1440×720),
  letterboxed to the screen. Draw in logical pixels; map input through
  `toLogical()`. Never derive gameplay from `window.innerWidth/Height`.
- **Damage routing**: shots/impacts go through `hitShip()` (shield-absorbable,
  one charge per projectile, no immunity window); terrain crashes call
  `crash()` directly. A multi-frame laser beam counts as ONE projectile.
- **Saved progress** (`moonLanderProgress` in localStorage) survives refresh;
  wiped only by game over or RESET PROGRESS. Touchdown saves `level + 1` so
  the shop screen can't be refresh-farmed.

## Conventions

- Commit and push only when André asks ("push").
- `gh` CLI is not available in this environment; check CI via the GitHub
  Actions tab instead.
