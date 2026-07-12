// Heads-up display: readouts, docking-style landing indicator, hints.

import { game, fuelCapacity, safeVY, safeAngle, cheat } from './state.js';
import { ctx } from './canvas.js';
import { SAFE_VX, START_BOMBS } from './config.js';
import { padAt } from './terrain.js';
import { gamepad } from './input/gamepad.js';
import { touch } from './input/touch.js';

// Shuttle-docking-inspired "keep the ball in the box" indicator.
// Ball x = tilt vs the safe angle. Ball y = landing speed: the worst of
// the two velocity limits (descent and horizontal drift), so the ball is
// inside the box exactly when a touchdown would survive. Dead center =
// perfectly upright at optimal speed. Chevrons show drift direction.
function drawLandingIndicator(x, y) {
  const lander = game.lander;
  const half = 42;           // box half-size (the safe envelope)
  const cx = x + half, cy = y + half;

  let dev = lander.angle % (Math.PI * 2);
  if (dev > Math.PI) dev -= Math.PI * 2;
  if (dev < -Math.PI) dev += Math.PI * 2;
  // gear-adjusted tolerances: better landing gear widens the box
  const fx = dev / safeAngle();
  const fdrift = lander.vx / SAFE_VX;
  const fy = Math.max(lander.vy / safeVY(), Math.abs(fdrift));
  const angleOk = Math.abs(fx) < 1;
  const speedOk = fy < 1;
  const close = Math.abs(fx) > 0.75 || fy > 0.75;
  const pad = padAt(lander.x); // is a landing pad directly below right now?

  let color, status;
  if (!speedOk) { color = '#ff5252'; status = 'TOO FAST'; }
  else if (!angleOk) { color = '#ff5252'; status = 'BAD ANGLE'; }
  else if (!pad) { color = '#ffb300'; status = 'NO PAD'; }
  else if (close) { color = '#ffb300'; status = 'CAUTION'; }
  else { color = '#4caf50'; status = 'LAND OK'; }

  ctx.save();

  // docking box: corner brackets
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  const b = half, k = 15; // bracket arm length
  ctx.beginPath();
  ctx.moveTo(cx - b, cy - b + k); ctx.lineTo(cx - b, cy - b); ctx.lineTo(cx - b + k, cy - b);
  ctx.moveTo(cx + b - k, cy - b); ctx.lineTo(cx + b, cy - b); ctx.lineTo(cx + b, cy - b + k);
  ctx.moveTo(cx + b, cy + b - k); ctx.lineTo(cx + b, cy + b); ctx.lineTo(cx + b - k, cy + b);
  ctx.moveTo(cx - b + k, cy + b); ctx.lineTo(cx - b, cy + b); ctx.lineTo(cx - b, cy + b - k);
  ctx.stroke();

  // center crosshair
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
  ctx.stroke();

  // the ball — clamped a bit past the box so "outside" is visible
  const clamp = v => Math.max(-1.55, Math.min(1.55, v));
  const bx = cx + clamp(fx) * (half - 8);
  const by = cy + clamp(fy) * (half - 8);
  ctx.beginPath();
  ctx.arc(bx, by, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (!speedOk || !angleOk) {
    // X through the ball: unmistakably not OK
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by - 5); ctx.lineTo(bx + 5, by + 5);
    ctx.moveTo(bx + 5, by - 5); ctx.lineTo(bx - 5, by + 5);
    ctx.stroke();
  }

  // sideways drift chevrons on the box edge, pointing with the drift
  if (Math.abs(fdrift) > 0.75) {
    const dir = Math.sign(fdrift);
    const ex = cx + dir * (half + 10);
    ctx.strokeStyle = Math.abs(fdrift) < 1 ? '#ffb300' : '#ff5252';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const off of [0, 8]) {
      ctx.moveTo(ex + dir * off, cy - 7);
      ctx.lineTo(ex + dir * (off + 7), cy);
      ctx.lineTo(ex + dir * off, cy + 7);
    }
    ctx.stroke();
  }

  // pad-below lamp: lights up when a landing pad is directly under the ship
  ctx.strokeStyle = pad ? '#4caf50' : '#444';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 17, cy + half + 9);
  ctx.lineTo(cx + 17, cy + half + 9);
  ctx.stroke();
  if (pad) {
    // which pad: its multiplier, in the pad's difficulty color
    ctx.fillStyle = pad.color;
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('x' + pad.mult, cx + 26, cy + half + 14);
  }

  ctx.fillStyle = color;
  ctx.font = 'bold 15px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(status, cx, cy + half + 30);

  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawHUD() {
  const { W, H, lander, unlocks } = game;
  ctx.font = '19px Courier New';
  ctx.textAlign = 'left';

  let y = 38;
  const line = (text, color = '#e0e0e0') => {
    ctx.fillStyle = color;
    ctx.fillText(text, 24, y);
    y += 27;
  };

  line('CREDITS ' + game.credits);
  line('LEVEL   ' + game.level);
  // fuel readout + bar
  const cap = fuelCapacity();
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText('FUEL    ' + Math.max(0, Math.floor(lander.fuel)), 24, y);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(172, y - 14, 130, 14);
  ctx.fillStyle = lander.fuel > cap * 0.2 ? '#4caf50' : '#ff5252';
  ctx.fillRect(172, y - 14, Math.max(0, lander.fuel / cap) * 130, 14);
  y += 27;
  if (unlocks.weapon >= 1) {
    const label = unlocks.weapon >= 3 ? 'S.BOMBS ' : 'BOMBS   ';
    line(label + '●'.repeat(lander.bombs) + '○'.repeat(START_BOMBS - lander.bombs),
      lander.bombs > 0 ? '#e0e0e0' : '#666');
  }
  if (unlocks.shield >= 1) {
    line('SHIELD  ' + '◆'.repeat(lander.shield) + '◇'.repeat(unlocks.shield - lander.shield),
      lander.shield > 0 ? '#4dd0e1' : '#666');
  }
  const shownLives = Math.max(0, game.lives);
  line('LIVES   ' + (shownLives > 6 ? '♥ x ' + shownLives : '♥'.repeat(shownLives)),
    game.lives > 1 ? '#ff5252' : '#ff8a80');

  // docking-style landing safety indicator
  drawLandingIndicator(24, y + 10);

  // right column
  ctx.font = '17px Courier New';
  ctx.textAlign = 'right';
  if (gamepad.connected) {
    ctx.fillStyle = '#4caf50';
    ctx.fillText('\u{1F3AE} CONTROLLER', W - 24, 38);
  }
  if (unlocks.assist >= 1) {
    ctx.fillStyle = game.assistActive ? '#4caf50' : '#666';
    ctx.fillText((unlocks.assist >= 2 ? 'RETRO' : 'LEVEL') + ' ASSIST ' + (game.assistActive ? '●' : '○'), W - 24, 64);
  }
  if (cheat.max) {
    ctx.fillStyle = '#ff4081';
    ctx.fillText(cheat.god ? 'GOD MODE' : 'CHEATS ON', W - 24, 90);
  }

  ctx.textAlign = 'center';
  const restartHint = gamepad.connected ? 'Press SPACE or A' : (touch.enabled ? 'Tap screen' : 'Press SPACE');
  if (game.state === 'landed') {
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 42px Courier New';
    ctx.fillText('THE EAGLE HAS LANDED', W / 2, H / 2 - 60);
    if (game.lifeAwarded) {
      ctx.font = 'bold 19px Courier New';
      ctx.fillText('+1 BONUS LIFE', W / 2, H / 2 - 28);
    }
  } else if (game.state === 'crashed') {
    const over = game.lives <= 0;
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 42px Courier New';
    ctx.fillText(over ? 'GAME OVER' : 'CRASHED', W / 2, H / 2 - 26);
    ctx.font = '20px Courier New';
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(restartHint + (over ? ' to start over' : ' to retry'), W / 2, H / 2 + 14);
    if (over) {
      ctx.fillStyle = '#888';
      ctx.fillText('REACHED LEVEL ' + game.level, W / 2, H / 2 + 48);
    }
  } else if (!touch.enabled) {
    ctx.fillStyle = '#666';
    ctx.font = '16px Courier New';
    const parts = gamepad.connected
      ? ['Stick/D-pad rotate', 'A / RT thrust']
      : ['← → rotate', '↑ / SPACE thrust'];
    if (unlocks.weapon >= 1) parts.push(gamepad.connected ? 'B / LB bomb' : 'B / ↓ bomb');
    if (unlocks.assist >= 1) parts.push(gamepad.connected ? 'X assist' : 'F assist');
    parts.push(gamepad.connected ? 'BACK settings' : 'ESC settings');
    ctx.fillText(parts.join('   '), W / 2, H - 20);
  }
}
