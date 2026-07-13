// The lander: creation, flight physics, touchdown/crash, drawing.

import { game, fuelCapacity, bombsPerAttempt, safeVY, safeAngle, thrustPower, saveProgress, cheat, earn } from './state.js';
import { ctx } from './canvas.js';
import {
  GRAVITY, ROT_SPEED, SAFE_VX,
  SPEED_BONUS_MAX, SPEED_BONUS_DECAY,
  ASSIST_LEVEL_RATE, ASSIST_RETRO_GAIN, ASSIST_RETRO_MAX,
  LAND_ASSIST_RATE, LAND_ASSIST_KP, LAND_ASSIST_DRIFT, LAND_ASSIST_DRIFT_MAX,
  LAND_ASSIST_DESCENT, LAND_ASSIST_DESCENT_MIN, LAND_ASSIST_DESCENT_MAX,
  SHIELD_COOLDOWN, SHIELD_RECHARGE_FRAMES,
} from './config.js';
import { terrainYAt, padAt, padRevealDelay } from './terrain.js';

// highest terrain (smallest y) along the horizontal span between two x's
function terrainCrestBetween(x1, x2) {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  let crest = Infinity;
  for (let x = lo; x <= hi; x += 40) crest = Math.min(crest, terrainYAt(x));
  return Math.min(crest, terrainYAt(hi));
}

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
    shield: game.unlocks.shield, // hits this attempt can absorb
    shieldCooldown: 0,
    shieldRegen: SHIELD_RECHARGE_FRAMES,
    age: 0, // frames since the attempt started, for the landing speed bonus
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
  if (cheat.god) return; // invulnerable
  game.state = 'crashed';
  game.lives--;
  explode();
  saveProgress();
}

function shieldBurst() {
  const lander = game.lander;
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 2.5 + 1;
    game.particles.push({
      x: lander.x + Math.cos(a) * 18,
      y: lander.y + Math.sin(a) * 18,
      vx: Math.cos(a) * sp + lander.vx,
      vy: Math.sin(a) * sp + lander.vy,
      life: 18 + Math.random() * 18,
      color: Math.random() < 0.5 ? '#4dd0e1' : '#b2ebf2',
    });
  }
}

// a shot or impact the shield can absorb (terrain crashes bypass this).
// one charge blocks exactly one projectile — there is no immunity window,
// so simultaneous hits each consume their own charge
export function hitShip() {
  if (cheat.god) return;
  const lander = game.lander;
  if (lander.shield > 0) {
    lander.shield--;
    lander.shieldCooldown = SHIELD_COOLDOWN; // visual flash only
    lander.shieldRegen = SHIELD_RECHARGE_FRAMES; // getting hit restarts the recharge
    shieldBurst();
    return;
  }
  crash();
}

// landing assist: the tilt that makes thrust steer the ship onto the
// nearest pad — correct the velocity error toward a gentle approach,
// while countering gravity
function landingAssistAngle(lander) {
  let pad = null, best = Infinity;
  for (const p of game.pads) {
    const d = Math.abs((p.x1 + p.x2) / 2 - lander.x);
    if (d < best) { best = d; pad = p; }
  }
  if (!pad) return 0;
  const padCx = (pad.x1 + pad.x2) / 2;
  const dx = padCx - lander.x;
  const dy = pad.y - 12 - lander.y; // pad surface, ship-height adjusted
  const desVx = Math.max(-LAND_ASSIST_DRIFT_MAX, Math.min(LAND_ASSIST_DRIFT_MAX, dx * LAND_ASSIST_DRIFT));
  let desVy;
  // commit to the final descent only when well inside the pad's width
  const descentGate = Math.min(40, (pad.x2 - pad.x1) * 0.3);
  if (Math.abs(dx) > descentGate) {
    // translate phase: cruise above both the pad and every ridge on the way
    const cruiseY = Math.min(pad.y - 140, terrainCrestBetween(lander.x, padCx) - 110);
    desVy = Math.max(-1.2, Math.min(1.0, (cruiseY - lander.y) * 0.01));
  } else if (dy > 0) {
    // final descent, slowing as the pad nears
    desVy = Math.min(LAND_ASSIST_DESCENT_MAX, LAND_ASSIST_DESCENT_MIN + dy * LAND_ASSIST_DESCENT);
  } else {
    desVy = LAND_ASSIST_DESCENT_MIN; // below pad level (in a crater): settle slowly
  }
  // thrust acceleration is (sin θ, −cos θ)·THRUST, so aim it along the
  // desired correction; gravity compensation keeps θ upright when parked.
  // ay is clamped upward-only: "descend faster" is expressed by the player
  // cutting throttle, never by aiming the nozzle past horizontal
  const ax = (desVx - lander.vx) * LAND_ASSIST_KP;
  const ay = Math.min((desVy - lander.vy) * LAND_ASSIST_KP - GRAVITY, -0.005);
  const target = Math.atan2(ax, -ay);
  return Math.max(-ASSIST_RETRO_MAX, Math.min(ASSIST_RETRO_MAX, target));
}

// rot, thrustAmt, and assistHeld are the aggregated control inputs for this frame
export function updateLander(rot, thrustAmt, assistHeld) {
  const lander = game.lander;
  lander.age++;
  if (lander.shieldCooldown > 0) lander.shieldCooldown--;
  // consumed shield charges trickle back after a few quiet seconds
  if (lander.shield < game.unlocks.shield) {
    lander.shieldRegen--;
    if (lander.shieldRegen <= 0) {
      lander.shield++;
      lander.shieldRegen = SHIELD_RECHARGE_FRAMES;
      lander.shieldCooldown = 12; // brief blink as the bubble returns
    }
  }

  if (rot) {
    lander.angle += ROT_SPEED * rot;
  } else if (assistHeld && game.unlocks.assist >= 1) {
    // level assist eases upright; retro assist tilts against horizontal
    // travel so thrusting brakes the ship in x; landing assist aims the
    // rocket so thrusting steers onto the nearest pad
    let target = 0;
    if (game.unlocks.assist >= 3) {
      target = landingAssistAngle(lander);
    } else if (game.unlocks.assist >= 2) {
      target = Math.max(-ASSIST_RETRO_MAX, Math.min(ASSIST_RETRO_MAX, -lander.vx * ASSIST_RETRO_GAIN));
    }
    let dev = (lander.angle - target) % (Math.PI * 2);
    if (dev > Math.PI) dev -= Math.PI * 2;
    if (dev < -Math.PI) dev += Math.PI * 2;
    // turn at a constant angular speed, stopping dead on the target;
    // the landing tier gimbals faster so it can track its moving target
    const rate = game.unlocks.assist >= 3 ? LAND_ASSIST_RATE : ASSIST_LEVEL_RATE;
    if (Math.abs(dev) <= rate) lander.angle = target;
    else lander.angle = target + dev - Math.sign(dev) * rate;
  }

  lander.thrusting = false;
  lander.thrustAmt = 0;
  if (thrustAmt > 0 && lander.fuel > 0) {
    lander.thrusting = true;
    lander.thrustAmt = thrustAmt;
    lander.vx += Math.sin(lander.angle) * thrustPower() * thrustAmt;
    lander.vy -= Math.cos(lander.angle) * thrustPower() * thrustAmt;
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
    // tolerances scale with the landing-gear tier
    const upright = Math.abs(((lander.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < safeAngle()
                 || Math.abs(((lander.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) > Math.PI * 2 - safeAngle();
    const slow = Math.abs(lander.vx) < SAFE_VX && lander.vy < safeVY();
    if (pad && upright && slow) {
      game.state = 'landed';
      lander.y = pad.y - 12;
      lander.vx = lander.vy = 0;
      lander.angle = 0;
      // payout: pad multiplier + leftover fuel + a bonus for landing fast
      const padCr = 50 * pad.mult;
      const fuelCr = Math.floor(lander.fuel / 10);
      // the speed clock starts at the pad reveal, not at launch — decoy-era
      // waits don't eat the bonus
      const speedAge = Math.max(0, lander.age - padRevealDelay());
      const speedCr = Math.max(0, SPEED_BONUS_MAX - Math.floor(speedAge / 60) * SPEED_BONUS_DECAY);
      earn(padCr + fuelCr + speedCr);
      game.landingBreakdown = { pad: padCr, fuel: fuelCr, speed: speedCr };
      // a free life every other level, awarded at touchdown
      if (game.level % 2 === 0) {
        game.lives++;
        game.lifeAwarded = true;
      }
      // save as next level: a refresh on the shop screen can't re-earn this landing
      saveProgress(1);
    } else if (cheat.god) {
      // god mode: bounce off the terrain instead of crashing
      lander.y -= 3;
      lander.vy = -Math.abs(lander.vy) * 0.4;
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

  // flame — length and width scale with throttle and thruster tier
  if (lander.thrusting && game.state === 'flying') {
    const amt = lander.thrustAmt;
    const flick = Math.random() * 8 * amt;
    const boost = 1 + game.unlocks.thruster * 0.2;
    const w = 2 + 3 * amt;
    ctx.beginPath();
    ctx.moveTo(-w, 12);
    ctx.lineTo(0, 12 + (10 + flick) * amt * boost);
    ctx.lineTo(w, 12);
    ctx.closePath();
    ctx.fillStyle = amt < 0.5 ? '#ffcc80' : '#ffa726';
    ctx.fill();
  }

  // shield bubble: steady glow while charges remain, bright flash on absorb
  if (game.state === 'flying' && (lander.shield > 0 || lander.shieldCooldown > 0)) {
    const flashing = lander.shieldCooldown > 0;
    ctx.save();
    ctx.globalAlpha = flashing ? 0.5 + 0.4 * Math.random() : 0.18 + 0.06 * Math.sin(performance.now() / 200);
    ctx.strokeStyle = '#4dd0e1';
    ctx.lineWidth = flashing ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
