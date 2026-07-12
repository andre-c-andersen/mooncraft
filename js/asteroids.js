// Asteroid waves: from level 10 the sky occasionally drops rocks — up to
// five consecutive asteroids per wave at level 25. Bomb blasts destroy them.

import { game } from './state.js';
import { ctx } from './canvas.js';
import { GRAVITY, ASTEROID_LEVELS, ASTEROID_GRAVITY } from './config.js';
import { terrainYAt } from './terrain.js';
import { hitShip } from './lander.js';

let queue = 0;      // asteroids still to spawn in the current wave
let spawnTimer = 0; // frames until the next spawn

export function waveSize() {
  return ASTEROID_LEVELS.filter(l => game.level >= l).length;
}

export function resetAsteroids() {
  game.asteroids = [];
  queue = 0;
  spawnTimer = 150 + Math.random() * 150; // short grace, then the first wave (~2.5-5s)
}

function spawnOne() {
  // heading is uniform across the whole downward semicircle (1°..179°),
  // so near-horizontal streaks are as likely as straight drops
  const deg = 1 + Math.random() * 178;
  const a = deg * Math.PI / 180;
  const speed = 0.8 + Math.random() * 1.0;
  // strongly sideways rocks enter from the matching side edge, steep ones from the top
  let x, y;
  if (deg < 35) { x = -20; y = Math.random() * game.H * 0.5; }             // heading right
  else if (deg > 145) { x = game.W + 20; y = Math.random() * game.H * 0.5; } // heading left
  else { x = Math.random() * game.W; y = -20; }
  game.asteroids.push({
    x, y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r: 9 + Math.random() * 8,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.06,
    verts: Array.from({ length: 8 }, () => 0.75 + Math.random() * 0.5), // rocky outline
  });
}

function dust(a) {
  for (let i = 0; i < 14; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = Math.random() * 2 + 0.5;
    game.particles.push({
      x: a.x, y: a.y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 1,
      life: 20 + Math.random() * 25,
      color: Math.random() < 0.5 ? '#9e9e9e' : '#6d6d6d',
    });
  }
}

export function updateAsteroids() {
  const max = waveSize();
  if (max > 0 && game.state === 'flying') {
    spawnTimer--;
    if (spawnTimer <= 0) {
      if (queue === 0) queue = 1 + Math.floor(Math.random() * max); // wave of 1..max
      spawnOne();
      queue--;
      // consecutive within a wave, then a breather between waves (~5-10s)
      spawnTimer = queue > 0 ? 30 + Math.random() * 30 : 300 + Math.random() * 300;
    }
  }

  for (let i = game.asteroids.length - 1; i >= 0; i--) {
    const a = game.asteroids[i];
    a.vy += GRAVITY * ASTEROID_GRAVITY;
    a.x += a.vx;
    a.y += a.vy;
    a.rot += a.vrot;
    if (a.x < -40 || a.x > game.W + 40 || a.y >= terrainYAt(a.x)) {
      if (a.y >= terrainYAt(a.x)) dust(a);
      game.asteroids.splice(i, 1);
      continue;
    }
    if (game.state === 'flying' && Math.hypot(a.x - game.lander.x, a.y - game.lander.y) < a.r + 11) {
      game.asteroids.splice(i, 1);
      dust(a);
      hitShip();
    }
  }
}

export function drawAsteroids() {
  for (const a of game.asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.beginPath();
    a.verts.forEach((v, i) => {
      const ang = (i / a.verts.length) * Math.PI * 2;
      const px = Math.cos(ang) * a.r * v;
      const py = Math.sin(ang) * a.r * v;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = '#4e4e4e';
    ctx.fill();
    ctx.strokeStyle = '#8d8d8d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
