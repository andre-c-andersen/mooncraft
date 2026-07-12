// Defense cannons: placement, gun slugs, laser telegraph/beam, drawing.

import { game } from './state.js';
import { ctx } from './canvas.js';
import {
  FIRE_INTERVAL, FIRE_INTERVAL_MIN, FIRE_INTERVAL_STEP,
  SLUG_SPEED, SLUG_SPEED_STEP, SLUG_SPEED_MAX, SLUG_HIT_RADIUS,
  LASER_AIM_TIME, LASER_AIM_MIN, LASER_AIM_STEP, LASER_BEAM_TIME, LASER_HIT_RADIUS,
} from './config.js';
import { terrainYAt } from './terrain.js';
import { hitShip } from './lander.js';

export function cannonCount() {
  // one cannon at level 2, another every other level — no cap; terrain
  // spacing naturally limits how many actually fit
  return Math.max(0, Math.floor(game.level / 2));
}

function slugSpeed() {
  // climbs with the cannon count, capped where terrain stops fitting more
  // cannons — the wanted count keeps growing but placement doesn't
  return Math.min(SLUG_SPEED_MAX, SLUG_SPEED + Math.max(0, cannonCount() - 1) * SLUG_SPEED_STEP);
}

function laserAimTime() {
  // the telegraph gets shorter as levels progress (first laser arrives at level 4)
  return Math.max(LASER_AIM_MIN, LASER_AIM_TIME - (game.level - 4) * LASER_AIM_STEP);
}

function fireCooldown() {
  // cannons fire faster as levels progress (first cannon arrives at level 2)
  const interval = Math.max(FIRE_INTERVAL_MIN, FIRE_INTERVAL - (game.level - 2) * FIRE_INTERVAL_STEP);
  return interval + Math.random() * 60;
}

function leadFactor() {
  // how much cannons lead the ship's motion: none at level ≤4, full intercept by 20
  return Math.max(0, Math.min(1, (game.level - 4) / 16));
}

// where to aim: the lander now, shifted by its velocity over the shot's travel time
function aimPoint(c) {
  const lander = game.lander;
  const lead = leadFactor();
  if (lead <= 0) return { x: lander.x, y: lander.y };
  let t;
  if (c.type === 'laser') {
    // predict where the ship will be when the telegraph ends and the beam fires
    t = laserAimTime();
  } else {
    // slug flight time to the intercept, one refinement iteration
    const sp = slugSpeed();
    t = Math.hypot(lander.x - c.x, lander.y - c.y) / sp;
    t = Math.hypot(lander.x + lander.vx * t - c.x, lander.y + lander.vy * t - c.y) / sp;
    t = Math.min(t, 300);
  }
  return { x: lander.x + lander.vx * t * lead, y: lander.y + lander.vy * t * lead };
}

export function placeCannons() {
  const { W } = game;
  game.cannons = [];
  // terrain vertices away from screen edges and landing pads
  const candidates = game.terrain.filter(pt =>
    pt.x > W * 0.08 && pt.x < W * 0.92 &&
    !game.pads.some(p => pt.x > p.x1 - 45 && pt.x < p.x2 + 45));
  const n = cannonCount();
  const minGap = Math.min(W * 0.15, (W * 0.45) / n); // tighter packing allowed as count grows
  for (let i = 0; i < n; i++) {
    const targetX = W * ((i + 1) / (n + 1));
    let best = null, bestDist = Infinity;
    for (const pt of candidates) {
      const d = Math.abs(pt.x - targetX);
      if (d < bestDist && !game.cannons.some(c => Math.abs(c.x - pt.x) < minGap)) {
        best = pt; bestDist = d;
      }
    }
    if (best) game.cannons.push({
      x: best.x, y: best.y, angle: -Math.PI / 2, cooldown: 0,
      type: game.cannons.length % 2 ? 'laser' : 'gun', // alternate: 1st gun, 2nd laser, ...
      phase: 'idle', timer: 0, aimTotal: 0, beamAngle: 0, beamHit: false,
    });
  }
}

function laserMuzzle(c) {
  return { x: c.x + Math.cos(c.beamAngle) * 24, y: c.y + Math.sin(c.beamAngle) * 24 - 6 };
}

function laserEndpoint(c) {
  // march along the locked angle until terrain or the screen edge
  let { x, y } = laserMuzzle(c);
  const dx = Math.cos(c.beamAngle) * 8, dy = Math.sin(c.beamAngle) * 8;
  for (let i = 0; i < 300; i++) {
    x += dx; y += dy;
    if (x < 0 || x > game.W || y < 0 || y > game.H || y >= terrainYAt(x)) break;
  }
  return { x, y };
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function updateCannons() {
  const lander = game.lander;

  for (const c of game.cannons) {
    // a laser mid-cycle finishes its aim/beam animation even after a crash
    if (c.type === 'laser' && c.phase !== 'idle') {
      c.timer--;
      if (c.phase === 'aim' && c.timer <= 0) {
        c.phase = 'beam';
        c.timer = LASER_BEAM_TIME;
        c.beamHit = false;
      } else if (c.phase === 'beam') {
        // the beam persists for several frames but counts as ONE projectile:
        // it lands at most one hit, so it spends at most one shield charge
        if (game.state === 'flying' && !c.beamHit) {
          const m = laserMuzzle(c), end = laserEndpoint(c);
          if (distToSegment(lander.x, lander.y, m.x, m.y, end.x, end.y) < LASER_HIT_RADIUS) {
            c.beamHit = true;
            hitShip();
          }
        }
        if (c.timer <= 0) {
          c.phase = 'idle';
          c.cooldown = fireCooldown();
        }
      }
      continue; // barrel stays locked on beamAngle while telegraphing/firing
    }

    if (game.state === 'flying') {
      // smoothly track the lander, leading its motion at higher levels
      const aim = aimPoint(c);
      let target = Math.atan2(aim.y - c.y, aim.x - c.x);
      let diff = target - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += diff * 0.06;

      c.cooldown--;
      if (c.cooldown <= 0) {
        if (c.type === 'laser') {
          c.phase = 'aim';
          c.timer = c.aimTotal = laserAimTime();
          c.beamAngle = c.angle; // lock: the thin line shows exactly where the beam fires
        } else {
          c.cooldown = fireCooldown();
          const sp = slugSpeed();
          game.slugs.push({
            x: c.x + Math.cos(c.angle) * 24,
            y: c.y + Math.sin(c.angle) * 24 - 6,
            vx: Math.cos(c.angle) * sp,
            vy: Math.sin(c.angle) * sp,
            life: 900,
          });
        }
      }
    }
  }

  const slugs = game.slugs;
  for (let i = slugs.length - 1; i >= 0; i--) {
    const s = slugs[i];
    s.x += s.vx;
    s.y += s.vy;
    s.life--;
    if (s.life <= 0 || s.x < -20 || s.x > game.W + 20 || s.y < -20 || s.y > game.H + 20
        || s.y > terrainYAt(s.x)) {
      slugs.splice(i, 1);
      continue;
    }
    if (game.state === 'flying' && Math.hypot(s.x - lander.x, s.y - lander.y) < SLUG_HIT_RADIUS) {
      slugs.splice(i, 1);
      hitShip();
    }
  }
}

export function drawCannons() {
  for (const c of game.cannons) {
    const accent = c.type === 'laser' ? '#ff5252' : '#4dd0e1';
    ctx.save();
    ctx.translate(c.x, c.y);
    // barrel
    ctx.save();
    ctx.rotate(c.angle);
    ctx.fillStyle = '#37474f';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(6, -3.5, 20, 7);
    ctx.fill();
    ctx.stroke();
    // muzzle glow
    ctx.beginPath();
    ctx.arc(26, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = c.type === 'laser' ? '#ff1744' : '#ff4081';
    ctx.fill();
    ctx.restore();
    // dome base
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#263238';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.stroke();
    // blinking core light
    ctx.beginPath();
    ctx.arc(0, -4, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = (Math.floor(performance.now() / 400) % 2) ? '#ff4081' : '#880e4f';
    ctx.fill();
    ctx.restore();
  }
}

export function drawLasers() {
  for (const c of game.cannons) {
    if (c.type !== 'laser' || c.phase === 'idle') continue;
    const m = laserMuzzle(c), end = laserEndpoint(c);
    ctx.save();
    if (c.phase === 'aim') {
      // thin telegraph line along the locked firing angle,
      // glowing brighter as the shot gets closer
      const urgency = 1 - c.timer / (c.aimTotal || LASER_AIM_TIME); // 0 → 1 over the aim phase
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 6 + 6 * urgency;
      ctx.strokeStyle = '#ff1744';
      ctx.globalAlpha = 0.75 + 0.25 * urgency;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else {
      // live beam, fading slightly as it expires
      ctx.globalAlpha = Math.max(0.4, c.timer / LASER_BEAM_TIME);
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawSlugs() {
  for (const s of game.slugs) {
    // trail
    ctx.strokeStyle = 'rgba(255, 64, 129, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x - s.vx * 6, s.y - s.vy * 6);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    // glowing slug
    ctx.save();
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff80ab';
    ctx.fill();
    ctx.restore();
  }
}
