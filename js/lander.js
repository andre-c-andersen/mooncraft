// The lander: creation, flight physics, touchdown/crash, drawing.

import { game, fuelCapacity, bombsPerAttempt, saveProgress } from './state.js';
import { ctx } from './canvas.js';
import {
  GRAVITY, THRUST, ROT_SPEED, SAFE_VX, SAFE_VY, SAFE_ANGLE,
  ASSIST_LEVEL_RATE, ASSIST_RETRO_GAIN, ASSIST_RETRO_MAX,
} from './config.js';
import { terrainYAt, padAt } from './terrain.js';

export function createLander() {
  return {
    x: game.W * (0.2 + Math.random() * 0.6),
    y: game.H * 0.12,
    vx: (Math.random() - 0.5) * 1.2,
    vy: 0.3,
    angle: 0,
    fuel: fuelCapacity(),
    thrusting: false,
    thrustAmt: 0,
    bombs: bombsPerAttempt(),
  };
}

export function explode() {
  const lander = game.lander;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 4 + 1;
    game.particles.push({
      x: lander.x, y: lander.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
      life: 40 + Math.random() * 40,
      color: ['#ff5252', '#ffa726', '#fff176', '#eee'][Math.floor(Math.random() * 4)],
    });
  }
}

export function crash() {
  game.state = 'crashed';
  game.lives--;
  explode();
  saveProgress();
}

// rot, thrustAmt, and assistHeld are the aggregated control inputs for this frame
export function updateLander(rot, thrustAmt, assistHeld) {
  const lander = game.lander;

  if (rot) {
    lander.angle += ROT_SPEED * rot;
  } else if (assistHeld && game.unlocks.assist >= 1) {
    // level assist eases upright; retro assist instead tilts against
    // horizontal travel so thrusting brakes the ship in x
    let target = 0;
    if (game.unlocks.assist >= 2) {
      target = Math.max(-ASSIST_RETRO_MAX, Math.min(ASSIST_RETRO_MAX, -lander.vx * ASSIST_RETRO_GAIN));
    }
    let dev = (lander.angle - target) % (Math.PI * 2);
    if (dev > Math.PI) dev -= Math.PI * 2;
    if (dev < -Math.PI) dev += Math.PI * 2;
    // turn at a constant angular speed, stopping dead on the target
    if (Math.abs(dev) <= ASSIST_LEVEL_RATE) lander.angle = target;
    else lander.angle = target + dev - Math.sign(dev) * ASSIST_LEVEL_RATE;
  }

  lander.thrusting = false;
  lander.thrustAmt = 0;
  if (thrustAmt > 0 && lander.fuel > 0) {
    lander.thrusting = true;
    lander.thrustAmt = thrustAmt;
    lander.vx += Math.sin(lander.angle) * THRUST * thrustAmt;
    lander.vy -= Math.cos(lander.angle) * THRUST * thrustAmt;
    lander.fuel -= thrustAmt; // fuel burn scales with throttle
    // exhaust particles
    const n = Math.max(1, Math.round(3 * thrustAmt));
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      game.particles.push({
        x: lander.x - Math.sin(lander.angle) * 14,
        y: lander.y + Math.cos(lander.angle) * 14,
        vx: lander.vx - Math.sin(lander.angle + spread) * (1 + 2 * thrustAmt),
        vy: lander.vy + Math.cos(lander.angle + spread) * (1 + 2 * thrustAmt),
        life: 20 + Math.random() * 15,
        color: Math.random() < 0.5 ? '#ffa726' : '#fff176',
      });
    }
  }

  lander.vy += GRAVITY;
  lander.x += lander.vx;
  lander.y += lander.vy;

  // wrap horizontally
  if (lander.x < 0) lander.x += game.W;
  if (lander.x > game.W) lander.x -= game.W;

  // collision — check the two landing feet
  const footOffsets = [-10, 10];
  let touchdown = false;
  for (const off of footOffsets) {
    const fx = lander.x + Math.cos(lander.angle) * off - Math.sin(lander.angle) * 12;
    const fy = lander.y + Math.sin(lander.angle) * off + Math.cos(lander.angle) * 12;
    if (fy >= terrainYAt(fx)) touchdown = true;
  }

  if (touchdown) {
    const pad = padAt(lander.x);
    const upright = Math.abs(((lander.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < SAFE_ANGLE
                 || Math.abs(((lander.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) > Math.PI * 2 - SAFE_ANGLE;
    const slow = Math.abs(lander.vx) < SAFE_VX && lander.vy < SAFE_VY;
    if (pad && upright && slow) {
      game.state = 'landed';
      lander.y = pad.y - 12;
      lander.vx = lander.vy = 0;
      lander.angle = 0;
      game.credits += 50 * pad.mult + Math.floor(lander.fuel / 10);
      // a free life every other level, awarded at touchdown
      if (game.level % 2 === 0) {
        game.lives++;
        game.lifeAwarded = true;
      }
      // save as next level: a refresh on the shop screen can't re-earn this landing
      saveProgress(1);
    } else {
      crash();
    }
  }
}

export function drawLander() {
  if (game.state === 'crashed') return;
  const lander = game.lander;

  // ship off the top of the screen: mark its position on the top border
  if (game.state === 'flying' && lander.y < -10) {
    const mx = Math.max(12, Math.min(game.W - 12, lander.x));
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.moveTo(mx, 6);
    ctx.lineTo(mx - 7, 20);
    ctx.lineTo(mx + 7, 20);
    ctx.closePath();
    ctx.fill();
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(-lander.y / 10) + '0m', mx, 34);
  }
  ctx.save();
  ctx.translate(lander.x, lander.y);
  ctx.rotate(lander.angle);

  // flame — length and width scale with throttle
  if (lander.thrusting && game.state === 'flying') {
    const amt = lander.thrustAmt;
    const flick = Math.random() * 8 * amt;
    const w = 2 + 3 * amt;
    ctx.beginPath();
    ctx.moveTo(-w, 12);
    ctx.lineTo(0, 12 + (10 + flick) * amt);
    ctx.lineTo(w, 12);
    ctx.closePath();
    ctx.fillStyle = amt < 0.5 ? '#ffcc80' : '#ffa726';
    ctx.fill();
  }

  // body
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#333';
  // capsule
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(9, -2);
  ctx.lineTo(9, 6);
  ctx.lineTo(-9, 6);
  ctx.lineTo(-9, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // legs
  ctx.beginPath();
  ctx.moveTo(-7, 6); ctx.lineTo(-11, 13);
  ctx.moveTo(7, 6);  ctx.lineTo(11, 13);
  ctx.stroke();
  // feet
  ctx.beginPath();
  ctx.moveTo(-14, 13); ctx.lineTo(-8, 13);
  ctx.moveTo(8, 13);   ctx.lineTo(14, 13);
  ctx.stroke();
  // window
  ctx.beginPath();
  ctx.arc(0, -4, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();

  ctx.restore();
}
