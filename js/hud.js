// Heads-up display: readouts, docking-style landing indicator, hints.

import { game, fuelCapacity } from './state.js';
import { ctx } from './canvas.js';
import { SAFE_VX, SAFE_VY, SAFE_ANGLE, START_BOMBS } from './config.js';
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
  const half = 30;           // box half-size (the safe envelope)
  const cx = x + half, cy = y + half;

  let dev = lander.angle % (Math.PI * 2);
  if (dev > Math.PI) dev -= Math.PI * 2;
  if (dev < -Math.PI) dev += Math.PI * 2;
  const fx = dev / SAFE_ANGLE;
  const fdrift = lander.vx / SAFE_VX;
  const fy = Math.max(lander.vy / SAFE_VY, Math.abs(fdrift));
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
  ctx.lineWidth = 2;
  const b = half, k = 12; // bracket arm length
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
  ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
  ctx.stroke();

  // the ball — clamped a bit past the box so "outside" is visible
  const clamp = v => Math.max(-1.55, Math.min(1.55, v));
  const bx = cx + clamp(fx) * (half - 6);
  const by = cy + clamp(fy) * (half - 6);
  ctx.beginPath();
  ctx.arc(bx, by, 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (!speedOk || !angleOk) {
    // X through the ball: unmistakably not OK
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by - 4); ctx.lineTo(bx + 4, by + 4);
    ctx.moveTo(bx + 4, by - 4); ctx.lineTo(bx - 4, by + 4);
    ctx.stroke();
  }

  // sideways drift chevrons on the box edge, pointing with the drift
  if (Math.abs(fdrift) > 0.75) {
    const dir = Math.sign(fdrift);
    const ex = cx + dir * (half + 8);
    ctx.strokeStyle = Math.abs(fdrift) < 1 ? '#ffb300' : '#ff5252';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const off of [0, 6]) {
      ctx.moveTo(ex + dir * off, cy - 5);
      ctx.lineTo(ex + dir * (off + 5), cy);
      ctx.lineTo(ex + dir * off, cy + 5);
    }
    ctx.stroke();
  }

  // pad-below lamp: lights up when a landing pad is directly under the ship
  ctx.strokeStyle = pad ? '#4caf50' : '#444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy + half + 7);
  ctx.lineTo(cx + 13, cy + half + 7);
  ctx.stroke();
  if (pad) {
    // which pad: its multiplier, in the pad's difficulty color
    ctx.fillStyle = pad.color;
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('x' + pad.mult, cx + 20, cy + half + 11);
  }

  ctx.fillStyle = color;
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(status, cx, cy + half + 24);

  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawHUD() {
  const { W, H, lander, unlocks } = game;
  ctx.font = '14px Courier New';
  ctx.textAlign = 'left';

  let y = 28;
  const line = (text, color = '#e0e0e0') => {
    ctx.fillStyle = color;
    ctx.fillText(text, 20, y);
    y += 20;
  };

  line('CREDITS ' + game.credits);
  line('LEVEL   ' + game.level);
  // fuel readout + bar
  const cap = fuelCapacity();
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText('FUEL    ' + Math.max(0, Math.floor(lander.fuel)), 20, y);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(130, y - 10, 100, 10);
  ctx.fillStyle = lander.fuel > cap * 0.2 ? '#4caf50' : '#ff5252';
  ctx.fillRect(130, y - 10, Math.max(0, lander.fuel / cap) * 100, 10);
  y += 20;
  if (unlocks.weapon >= 1) {
    const label = unlocks.weapon >= 3 ? 'S.BOMBS ' : 'BOMBS   ';
    line(label + '●'.repeat(lander.bombs) + '○'.repeat(START_BOMBS - lander.bombs),
      lander.bombs > 0 ? '#e0e0e0' : '#666');
  }
  const shownLives = Math.max(0, game.lives);
  line('LIVES   ' + (shownLives > 6 ? '♥ x ' + shownLives : '♥'.repeat(shownLives)),
    game.lives > 1 ? '#ff5252' : '#ff8a80');

  // docking-style landing safety indicator
  drawLandingIndicator(20, y + 8);

  // right column
  ctx.font = '13px Courier New';
  ctx.textAlign = 'right';
  if (gamepad.connected) {
    ctx.fillStyle = '#4caf50';
    ctx.fillText('\u{1F3AE} CONTROLLER', W - 20, 28);
  }
  if (unlocks.assist >= 1) {
    ctx.fillStyle = game.assistActive ? '#4caf50' : '#666';
    ctx.fillText((unlocks.assist >= 2 ? 'RETRO' : 'LEVEL') + ' ASSIST ' + (game.assistActive ? '●' : '○'), W - 20, 48);
  }

  ctx.textAlign = 'center';
  const restartHint = gamepad.connected ? 'Press SPACE or A' : (touch.enabled ? 'Tap screen' : 'Press SPACE');
  if (game.state === 'landed') {
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 32px Courier New';
    ctx.fillText('THE EAGLE HAS LANDED', W / 2, H / 2 - 20);
    if (game.lifeAwarded) {
      ctx.font = 'bold 15px Courier New';
      ctx.fillText('+1 BONUS LIFE', W / 2, H / 2 + 8);
    }
  } else if (game.state === 'crashed') {
    const over = game.lives <= 0;
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 32px Courier New';
    ctx.fillText(over ? 'GAME OVER' : 'CRASHED', W / 2, H / 2 - 20);
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(restartHint + (over ? ' to start over' : ' to retry'), W / 2, H / 2 + 12);
    if (over) {
      ctx.fillStyle = '#888';
      ctx.fillText('REACHED LEVEL ' + game.level, W / 2, H / 2 + 40);
    }
  } else if (!touch.enabled) {
    ctx.fillStyle = '#666';
    ctx.font = '13px Courier New';
    const parts = gamepad.connected
      ? ['Stick/D-pad rotate', 'A / RT thrust']
      : ['← → rotate', '↑ / SPACE thrust'];
    if (unlocks.weapon >= 1) parts.push(gamepad.connected ? 'B / LB bomb' : 'B / ↓ bomb');
    if (unlocks.assist >= 1) parts.push(gamepad.connected ? 'X assist' : 'F assist');
    parts.push(gamepad.connected ? 'BACK settings' : 'ESC settings');
    ctx.fillText(parts.join('   '), W / 2, H - 16);
  }
}
