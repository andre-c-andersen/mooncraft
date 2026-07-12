// Droppable bombs, detonations, and expanding blast rings.

import { game, bombsAreSuper, bombsAreTriple } from './state.js';
import { ctx } from './canvas.js';
import {
  GRAVITY, BOMB_EJECT, BOMB_RECOIL, BLAST_RADIUS, SUPER_BLAST_RADIUS, TRIPLE_SPREAD,
} from './config.js';
import { terrainYAt } from './terrain.js';
import { hitShip } from './lander.js';

export function dropBomb() {
  const lander = game.lander;
  if (game.state !== 'flying' || game.unlocks.weapon < 1 || lander.bombs <= 0) return;
  const triple = bombsAreTriple();
  const count = triple ? lander.bombs : 1;
  const spread = [0, -TRIPLE_SPREAD, TRIPLE_SPREAD];
  for (let i = 0; i < count; i++) {
    // ship's down-axis (opposite the thrust vector), fanned out for a volley
    const a = lander.angle + (triple ? spread[i % 3] : 0);
    const dx = -Math.sin(a), dy = Math.cos(a);
    game.bombs.push({
      x: lander.x + dx * 16,
      y: lander.y + dy * 16,
      vx: lander.vx + dx * BOMB_EJECT,
      vy: lander.vy + dy * BOMB_EJECT,
      super: bombsAreSuper(),
    });
  }
  lander.bombs -= count;
  // Newton: equal and opposite — the ship gets a kick, softened per bomb in a volley
  const kick = BOMB_RECOIL * (triple ? 0.6 : 1) * count;
  const dx0 = -Math.sin(lander.angle), dy0 = Math.cos(lander.angle);
  lander.vx -= dx0 * kick;
  lander.vy -= dy0 * kick;
}

export function detonate(x, y, isSuper) {
  const radius = isSuper ? SUPER_BLAST_RADIUS : BLAST_RADIUS;
  game.booms.push({ x, y, r: 6, max: radius });
  const n = isSuper ? 80 : 50;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (Math.random() * 3.5 + 1) * (isSuper ? 1.4 : 1);
    game.particles.push({
      x, y: y - 2,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2,
      life: 30 + Math.random() * 35,
      color: ['#ffa726', '#fff176', '#ff7043', '#eee'][Math.floor(Math.random() * 4)],
    });
  }
  for (let i = game.cannons.length - 1; i >= 0; i--) {
    if (Math.hypot(game.cannons[i].x - x, game.cannons[i].y - y) < radius) {
      game.cannons.splice(i, 1);
      game.credits += 75;
    }
  }
  for (let i = game.slugs.length - 1; i >= 0; i--) {
    if (Math.hypot(game.slugs[i].x - x, game.slugs[i].y - y) < radius) game.slugs.splice(i, 1);
  }
  for (let i = game.asteroids.length - 1; i >= 0; i--) {
    const a = game.asteroids[i];
    if (Math.hypot(a.x - x, a.y - y) < radius + a.r) game.asteroids.splice(i, 1);
  }
  // your own blast can take you down too
  if (game.state === 'flying' && Math.hypot(game.lander.x - x, game.lander.y - y) < radius * 0.8) {
    hitShip();
  }
}

export function updateBombs() {
  const bombs = game.bombs;
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.vy += GRAVITY;
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -20 || b.x > game.W + 20) { bombs.splice(i, 1); continue; }
    const direct = game.cannons.some(c => Math.hypot(b.x - c.x, b.y - c.y) < 16);
    if (direct || b.y >= terrainYAt(b.x)) {
      detonate(b.x, Math.min(b.y, terrainYAt(b.x)), b.super);
      bombs.splice(i, 1);
    }
  }
  for (let i = game.booms.length - 1; i >= 0; i--) {
    game.booms[i].r += 3;
    if (game.booms[i].r > game.booms[i].max) game.booms.splice(i, 1);
  }
}

export function drawBombs() {
  for (const b of game.bombs) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    if (b.super) ctx.scale(1.35, 1.35); // super bombs are visibly chunkier
    // body
    ctx.fillStyle = b.super ? '#7b3f00' : '#455a64';
    ctx.strokeStyle = b.super ? '#ffb300' : '#90a4ae';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // tail fins
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(-9, -4);
    ctx.moveTo(-5, 0); ctx.lineTo(-9, 4);
    ctx.stroke();
    // armed light
    if (Math.floor(performance.now() / 150) % 2) {
      ctx.beginPath();
      ctx.arc(2, 0, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5252';
      ctx.fill();
    }
    ctx.restore();
  }
  // expanding blast rings
  for (const bm of game.booms) {
    ctx.globalAlpha = Math.max(0, 1 - bm.r / bm.max);
    ctx.strokeStyle = '#ffa726';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
