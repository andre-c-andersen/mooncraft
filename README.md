# 🌙 Moon Lander

A classic lunar lander arcade game for the browser — with sci-fi defense cannons, laser turrets, droppable bombs, touch controls, and full Xbox controller support. Vanilla HTML/CSS/JS with ES modules, no dependencies, no build step.

## Play

Once published with GitHub Pages, the game runs at:

```
https://<your-username>.github.io/<repo-name>/
```

## Run locally

The game uses ES modules, which browsers refuse to load from `file://` URLs — serve the folder over HTTP instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 (any static file server works, e.g. `npx serve`).

For debugging, pick your starting level with a query param: `http://localhost:8000/?level=4`.

## Project structure

```
index.html          entry page
css/style.css       page + canvas styles
js/
  main.js           entry point: input aggregation, update/draw loop
  config.js         gameplay tuning constants
  state.js          shared game state (leaf module)
  canvas.js         canvas element + Retina-aware resize
  game.js           lifecycle: reset, advance, retry, game over
  terrain.js        stars, terrain, landing pads
  lander.js         ship physics, touchdown/crash, drawing
  cannons.js        gun + laser cannons, slugs, beams
  bombs.js          bombs, detonations, blast rings
  particles.js      exhaust/explosion particles
  hud.js            score/fuel/lives readouts, status messages
  menu.js           controller settings menu
  settings.js       persisted settings (localStorage)
  input/
    keyboard.js     key state + one-shot actions
    gamepad.js      polling + edge detection
    touch.js        on-screen buttons for mobile
```

## How to play

Land gently on a pad. A safe landing needs low speed and a nearly upright ship — watch the docking indicator: keep the ball inside the brackets and land when it reads LAND OK. Pads come in three difficulties: wide green ×1, medium amber ×3, and narrow red ×6 — the multiplier scales your landing credits, and leftover fuel pays a bonus.

Landings earn **credits**, spent in the supply depot (shown after every landing):

- **Weapons**: bombs ×3 → triple bomb (whole rack in one volley) → super bombs (bigger blast) → triple super bomb. Destroyed cannons pay 75 credits.
- **Fly assist** (hold the assist button): level assist eases the ship upright; retro assist tilts it against your horizontal travel so thrusting brakes you.
- **Fuel tanks**: three capacity upgrades.
- **Extra lives**: you start with 3 and no longer gain any per level — buy them, at prices that climb with each purchase.

From level 2, cannons appear (one more every other level, up to 10): guns fire slugs you can dodge, and every second cannon is a laser that telegraphs its shot with a thin red line before firing. Game over resets credits and unlocks — the run is the progression.

### Keyboard

| Key | Action |
|---|---|
| ← / → (or A / D) | Rotate |
| ↑ / Space (or W) | Thrust |
| B / S / ↓ | Drop bomb (once unlocked) |
| F | Fly assist — tap to toggle, hold to engage (once unlocked) |
| ESC | Settings menu |
| ↑↓ / Enter | Select / buy in the shop |
| Space | Launch next level / retry |

### Xbox controller

| Input | Action |
|---|---|
| Left stick / D-pad | Rotate (analog) · navigate shop |
| Right trigger | Thrust (analog throttle) |
| A | Full thrust / launch / retry |
| B / LB | Drop bomb (once unlocked) |
| X | Fly assist (tap to toggle, hold to engage) · buy in shop |
| Back | Settings menu |

The settings menu has adjustable rotation sensitivity, stick deadzone, and trigger threshold — saved in your browser.

## Publishing on GitHub Pages

1. Go to **Settings → Pages**. Under *Build and deployment*, set **Source** to *Deploy from a branch*, pick your default branch and folder **/ (root)**, and click **Save**.
2. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/` — your game is live.
