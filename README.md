# 🎮 games.andersen.im

Small browser games — vanilla HTML/CSS/JS, no dependencies, no build step. The site root (`index.html`) is a card index of the games; each game lives in its own subdirectory.

Live at **https://games.andersen.im** via GitHub Pages.

## 🌙 Moon Lander — v1.37

A classic lunar lander arcade game — with sci-fi defense cannons, laser turrets, droppable bombs, asteroids, an upgrade economy, sound, touch controls, and full Xbox controller support.

Play it at **https://games.andersen.im/mooncraft/**

## Run locally

The games use ES modules, which browsers refuse to load from `file://` URLs — serve the repo over HTTP instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 for the index, or http://localhost:8000/mooncraft/ for the game directly (any static file server works, e.g. `npx serve`).

For debugging, pick your starting level with a query param: `http://localhost:8000/mooncraft/?level=4`.

Cheats, combinable with `level`: `?cheat=max` starts with every unlock bought and 99 lives; `?cheat=god` adds invulnerability (the ship bounces off terrain and shrugs off slugs, lasers, asteroids, and blasts). Cheated runs never touch your saved progress.

Press **P** to toggle a performance overlay (fps, sim step rate, cpu time, entity counts).

## Tests

Headless smoke tests boot the real game against a stubbed DOM and drive it frame by frame — no dependencies, plain node:

```
node tests/smoke.mjs
node tests/restore-check.mjs
node tests/cheat-check.mjs
npx -y -p typescript@5 tsc --noEmit   # typecheck (JSDoc + checkJs — no build step)
```

The runs are deterministic (the harness seeds `Math.random`; set `TEST_SEED=n` to explore). Type-checking is JSDoc-based against `mooncraft/js/types.d.ts` — the shipped `.js` files are exactly what you edit. Everything also runs automatically on every push via GitHub Actions.

## Project structure

```
index.html          game index with cards (the site root)
CNAME               games.andersen.im
tests/              headless test suite (run with plain node)
mooncraft/
  index.html        the Moon Lander entry page
  css/style.css     page + canvas styles
  js/
    main.js         entry point: input aggregation, update/draw loop
    config.js       gameplay tuning constants + VERSION
    state.js        shared game state (leaf module)
    canvas.js       canvas element + fixed-viewport scaling
    game.js         lifecycle: reset, advance, retry, game over
    terrain.js      stars, terrain, landing pads, craters
    lander.js       ship physics, assists, shields, touchdown/crash
    cannons.js      gun + laser cannons, slugs, beams
    bombs.js        bombs, detonations, blast rings
    asteroids.js    asteroid waves
    particles.js    exhaust/explosion particles
    audio.js        music + thruster loops, one-shot SFX (Web Audio)
    hud.js          readouts, docking indicator, banners
    hiscores.js     local top-10 board + three-letter name entry
    shop.js         supply depot (credits → unlocks)
    menu.js         settings + how-to-play overlay
    settings.js     persisted settings (localStorage)
    perf.js         P-key performance overlay
    input/
      keyboard.js   key state + one-shot actions
      gamepad.js    polling + edge detection
      touch.js      slide pads + tap buttons for mobile
  sounds/           music + thruster loops, laser one-shots (MP3)
```

## How to play

Land gently on a pad. A safe landing needs low speed and a nearly upright ship — the landing computer upgrade adds a docking indicator: keep the ball inside the brackets and land when it reads LAND OK. Pads come in three difficulties: wide green ×1, medium amber ×2, and narrow red ×3 — the multiplier scales your landing credits, leftover fuel pays a bonus, and landing quickly pays a speed bonus (up to 150 credits, shrinking every second). A full 360° mid-air loop pays a 50-credit stunt bonus. The easy pad disappears from level 10 and the medium from level 20 — after that, only the narrow ×3 pad remains. From level 25, three identical narrow pads spawn but only one is real: all three sit gray with a `?` until a scan cooldown ends (5 s at level 25, growing to 20 s — the landing computer counts it down), then the real pad lights up red and the dead decoys go dark. Touching a decoy is a crash like any terrain, the real pad is re-rolled on every attempt, and the speed-bonus clock only starts at the reveal — so no more diving blind at a known pad. If you fly off the top of the screen, an amber marker on the top border tracks your position and height.

Landings earn **credits**, spent in the supply depot (shown after every landing):

- **Weapons**: bombs ×1 → bombs ×3 → super bombs ×3 (bigger blast that craters the terrain — craters heal if you die) → super bombs ×6. Always dropped one per press; upgrades grow the rack. Destroyed cannons pay 75 credits, blasted asteroids 25.
- **Fly assist** (toggled with the assist button): level assist eases the ship upright; retro assist tilts it against your horizontal travel so thrusting brakes you; landing assist aims the rocket so thrusting steers you onto the nearest pad — you still fly the throttle.
- **Landing computer**: adds the docking-style landing indicator to the HUD — ball-in-brackets safety readout, pad-below lamp, and LAND OK / TOO FAST / BAD ANGLE status.
- **Shields**: three expensive tiers — each charge blocks exactly one projectile (a slug, a laser beam, an asteroid, or a blast; not bad landings). No immunity between hits: sustained fire will chew through the charges. A consumed charge recharges after ~4 quiet seconds; taking a hit restarts the timer.
- **Landing gear**: three tiers — each raises how much descent speed and landing angle a touchdown tolerates; the docking indicator's box widens to match.
- **Thrusters**: two tiers of stronger engines (+15% / +31% thrust) — snappier burns and easier saves, with a visibly longer exhaust flame.
- **Fuel tanks**: three capacity upgrades. Running the tank dry isn't instant death: the lines hold a whiff of vapor — about a second of half-power thrust per attempt (the fuel bar turns into an orange RESERVE gauge). That's enough Δv to flare one landing, but nowhere near enough to fly on.
- **Extra lives**: you start with 3 and earn a free one for landing on even-numbered levels; buy more at prices that climb with each purchase.

From level 2, cannons appear — one more every other level, up to 12. Past the cap the firepower keeps growing at the same cadence as cannon shields, sprinkled randomly across the placed cannons (clusters happen — a faint cyan bubble and a tiny ×N tag show a cannon's charges). Each shield absorbs one bomb blast, super or not, so a shielded cannon takes one extra bomb per charge to destroy. Guns fire slugs that get faster as the cannon count grows, every cannon fires more often and leads your motion more accurately at higher levels, and every second cannon is a laser that telegraphs its shot with a thin red line before firing; the telegraph gets shorter as you climb. From level 6, asteroid waves fall from the sky — growing to five consecutive rocks per wave by level 25 and arriving faster at higher levels; bomb blasts destroy them for 25 credits each. Game over resets credits and unlocks — the run is the progression.

Alongside spendable credits, every earning also feeds a **score** that never goes down. Dying for good ranks the run on a local top-10 board (by level reached, then score); making the board opens arcade-style three-letter name entry — arrows/ENTER on keyboard (or just type), d-pad/A on a controller, tap the ▲▼ arrows and OK on touch. ESC or B skips the entry.

Progress (level, credits, score, lives, unlocks) is saved in your browser, so a refresh resumes the run at the start of the current level. A game over wipes it, or use RESET PROGRESS in the settings menu (ESC, gamepad BACK, or the ⚙ button on touch screens). The high-score board survives both.

Music loops in the background and the thruster rumble follows your actual burn — full for a key press, proportionally quieter on a half-pulled trigger, touch slider, or reserve sputter. The defenses are audible too: gun cannons crack off their slugs (each shot slightly detuned so volleys don't sound machine-stamped), a laser's charge-up whine spans the telegraph (re-pitched to fit, so it climbs faster when the warning is short), and the beam fires with a zap. Bombs clunk off the rack as they release and every blast booms — supers hit harder than regular bombs; a shield charge eating a hit pings; losing the ship — to terrain, a decoy pad, or anything the defenses throw — goes out with a proper boom. Music and sound-effect volumes have their own sliders in the settings menu. Browsers only allow audio after you interact with the page, so the music starts on your first input.

### Keyboard

| Key | Action |
|---|---|
| ← / → (or A / D) | Rotate |
| ↑ / Space (or W) | Thrust |
| B / S / ↓ | Drop bomb (once unlocked) |
| F | Toggle fly assist (once unlocked) |
| ESC | Settings menu · leave shop |
| ↑↓ / Enter | Select / buy in the shop |
| Space | Launch next level / retry |

### Xbox controller

| Input | Action |
|---|---|
| Left stick / D-pad | Rotate (analog) · navigate menus |
| Right trigger | Thrust (analog throttle) |
| A | Full thrust · confirm selected (shop & menus) · retry |
| B / LB | Drop bomb (once unlocked) · close menu · leave shop |
| X | Toggle fly assist |
| Start | Launch next level / retry |
| Back | Settings menu |

The settings menu has adjustable music and sound-effect volumes, rotation sensitivity, stick deadzone, and trigger threshold — saved in your browser.

### Touch (iOS / Android)

| Control | Action |
|---|---|
| Left pad (bottom-left) | Rotate — linear: left of center turns left, right turns right, further = faster |
| Right slider (bottom-right) | Thrust — rests OFF in the bottom deadzone; curved response puts the hover band under your thumb |
| Round buttons | Fly assist (left) · drop bomb (right), once unlocked |
| Shop | Tap a row to select it, tap the selected row again to buy — LAUNCH starts selected |
| ⚙ (top-right) | Settings menu |

## Publishing on GitHub Pages

1. Go to **Settings → Pages**. Under *Build and deployment*, set **Source** to *Deploy from a branch*, pick your default branch and folder **/ (root)**, and click **Save**.
2. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/` — your game is live.
