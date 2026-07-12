// Entry point: input aggregation, fixed update order, draw order, main loop.

import { ctx, resize } from './canvas.js';
import { game } from './state.js';
import { genStars, genTerrain, drawStars, drawTerrain } from './terrain.js';
import { reset, advance } from './game.js';
import { updateLander, drawLander } from './lander.js';
import { updateCannons, drawCannons, drawLasers, drawSlugs } from './cannons.js';
import { updateBombs, drawBombs, dropBomb } from './bombs.js';
import { updateAsteroids, drawAsteroids } from './asteroids.js';
import { updateParticles, drawParticles } from './particles.js';
import { drawHUD } from './hud.js';
import { drawShop, shopMove, shopActivate, shopSelectLaunch } from './shop.js';
import { menu, menuMove, menuAdjust, menuActivate, drawMenu } from './menu.js';
import { settings } from './settings.js';
import { keys } from './input/keyboard.js';
import { readGamepad } from './input/gamepad.js';
import { touch, drawTouchControls, drawTouchGear } from './input/touch.js';
import { perfFrame, drawPerf } from './perf.js';

function update() {
  const { pad, edge } = readGamepad();

  if (pad && edge.back) menu.open = !menu.open;

  if (menu.open) { // game paused while menu is open
    if (pad) {
      if (edge.navUp) menuMove(-1);
      if (edge.navDown) menuMove(1);
      if (edge.navLeft) menuAdjust(-1);
      if (edge.navRight) menuAdjust(1);
      if (edge.a) menuActivate();
      if (edge.bBtn) menu.open = false;
    }
    return;
  }

  if (game.state === 'landed') {
    // shop is open — console conventions: A confirms the selected row
    // (buy, or launch when LAUNCH is selected), START skips straight to launch
    if (pad) {
      if (edge.navUp) shopMove(-1);
      if (edge.navDown) shopMove(1);
      if (edge.a) shopActivate();
      if (edge.start) advance();
    }
    return;
  }

  if (game.state === 'crashed') {
    if (pad && (edge.a || edge.start)) advance();
    return;
  }

  if (pad && (edge.bBtn || edge.lb)) dropBomb();

  // aggregate rotation and thrust across keyboard, touch, and gamepad;
  // rotation sensitivity applies to every input source
  let rot = 0;
  if (keys['ArrowLeft'] || keys['a']) rot -= 1;
  if (keys['ArrowRight'] || keys['d']) rot += 1;
  rot += touch.rot;
  rot *= settings.rotSens;
  if (pad) {
    if (Math.abs(pad.stickX) > settings.deadzone) rot += pad.stickX * settings.rotSens; // analog
    else if (pad.dpadLeft) rot -= settings.rotSens;
    else if (pad.dpadRight) rot += settings.rotSens;
  }

  let thrustAmt = 0;
  if (keys['ArrowUp'] || keys['w'] || keys[' '] || touch.thrust) thrustAmt = 1;
  if (pad) thrustAmt = Math.max(thrustAmt, pad.thrustAmt);

  // fly assist is a toggle: F key (in keyboard.js), X on gamepad, A on touch
  if (pad && edge.xBtn && game.unlocks.assist >= 1) game.assistOn = !game.assistOn;
  game.assistActive = game.assistOn && game.unlocks.assist >= 1;

  updateLander(rot, thrustAmt, game.assistOn);
}

// Physics constants are tuned per-frame at 60 Hz, so the simulation runs on
// a fixed 60 Hz timestep decoupled from the display refresh: 120 Hz phones
// and 144 Hz monitors no longer run the game faster, and slow devices catch
// up instead of playing in slow motion.
const STEP_MS = 1000 / 60;
const MAX_CATCHUP = 5 * STEP_MS; // don't fast-forward after a background tab returns
let lastTime = null;
let acc = 0;
let prevState = '';

function step() {
  update();
  if (game.state === 'landed' && prevState !== 'landed') shopSelectLaunch();
  prevState = game.state;
  if (!menu.open) {
    updateCannons();
    updateBombs();
    updateAsteroids();
    updateParticles();
  }
}

function loop(now) {
  const frameDt = lastTime === null ? 0 : now - lastTime;
  if (lastTime !== null) acc = Math.min(acc + frameDt, MAX_CATCHUP);
  lastTime = now;
  let steps = 0;
  const t0 = performance.now();
  while (acc >= STEP_MS) {
    step();
    acc -= STEP_MS;
    steps++;
  }
  const t1 = performance.now();
  ctx.clearRect(0, 0, game.W, game.H);
  drawStars();
  drawTerrain();
  drawCannons();
  drawLasers();
  drawSlugs();
  drawBombs();
  drawAsteroids();
  drawParticles();
  drawLander();
  drawHUD();
  if (game.state === 'landed') drawShop();
  drawTouchControls();
  if (menu.open) drawMenu();
  drawTouchGear();
  if (frameDt > 0) perfFrame(frameDt, steps, t1 - t0, performance.now() - t1);
  drawPerf();
  requestAnimationFrame(loop);
}

// the logical play area is fixed, so resizing only rescales the canvas —
// the world and the current attempt survive window resizes and rotations
window.addEventListener('resize', resize);

resize();
genStars();
genTerrain();
reset();
requestAnimationFrame(loop);
