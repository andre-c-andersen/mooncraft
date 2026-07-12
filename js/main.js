// Entry point: input aggregation, fixed update order, draw order, main loop.

import { ctx, resize } from './canvas.js';
import { game } from './state.js';
import { genStars, genTerrain, drawStars, drawTerrain } from './terrain.js';
import { reset, advance } from './game.js';
import { updateLander, drawLander } from './lander.js';
import { updateCannons, drawCannons, drawLasers, drawSlugs } from './cannons.js';
import { updateBombs, drawBombs, dropBomb } from './bombs.js';
import { updateParticles, drawParticles } from './particles.js';
import { drawHUD } from './hud.js';
import { drawShop, shopMove, shopActivate } from './shop.js';
import { menu, menuMove, menuAdjust, menuActivate, drawMenu } from './menu.js';
import { settings } from './settings.js';
import { keys } from './input/keyboard.js';
import { readGamepad } from './input/gamepad.js';
import { touch, drawTouchControls } from './input/touch.js';
import { ASSIST_TAP_FRAMES } from './config.js';

// fly assist: tap toggles it on/off, a long press works as hold-to-engage
let assistLatch = false;
let assistPressFrames = -1; // -1 = button not currently pressed

function assistInput(pressed) {
  if (pressed) {
    if (assistPressFrames === -1) assistPressFrames = 0;
    assistPressFrames++;
  } else if (assistPressFrames !== -1) {
    if (assistPressFrames <= ASSIST_TAP_FRAMES) assistLatch = !assistLatch; // tap → toggle
    else assistLatch = false;                                              // long hold → off on release
    assistPressFrames = -1;
  }
  return pressed || assistLatch;
}

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
    // shop is open: navigate, buy, or launch
    if (pad) {
      if (edge.navUp) shopMove(-1);
      if (edge.navDown) shopMove(1);
      if (edge.xBtn) shopActivate();
      if (edge.a || edge.start) advance();
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

  // fly assist: F key, X on gamepad, A on touch — tap to toggle, hold to engage
  const assistOn = assistInput(!!(keys['f'] || (pad && pad.xBtn) || touch.assist));
  game.assistActive = assistOn && game.unlocks.assist >= 1;

  updateLander(rot, thrustAmt, assistOn);
}

function loop() {
  update();
  if (!menu.open) {
    updateCannons();
    updateBombs();
    updateParticles();
  }
  ctx.clearRect(0, 0, game.W, game.H);
  drawStars();
  drawTerrain();
  drawCannons();
  drawLasers();
  drawSlugs();
  drawBombs();
  drawParticles();
  drawLander();
  drawHUD();
  if (game.state === 'landed') drawShop();
  drawTouchControls();
  if (menu.open) drawMenu();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => { resize(); genTerrain(); reset(); });

resize();
genStars();
genTerrain();
reset();
loop();
