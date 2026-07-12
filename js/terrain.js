// Starfield, terrain, and landing pads: generation, queries, drawing.

import { game } from './state.js';
import { ctx } from './canvas.js';

export function genStars() {
  game.stars = [];
  for (let i = 0; i < 120; i++) {
    game.stars.push({ x: Math.random() * game.W, y: Math.random() * game.H * 0.85, r: Math.random() * 1.4 + 0.3 });
  }
}

// markedly different landing difficulties: wide & cheap → narrow & lucrative.
// easier pads retire as levels climb: the easy one is gone from level 10,
// the medium from level 20 — only the hard pad remains after that
const PAD_TYPES = [
  { w: 2.6, mult: 1, color: '#4caf50', maxLevel: 9 },   // easy: wide
  { w: 1.6, mult: 2, color: '#ffb300', maxLevel: 19 },  // medium
  { w: 1.0, mult: 3, color: '#ff5252', maxLevel: Infinity }, // hard: barely wider than the ship
];

export function genTerrain() {
  const { W, H } = game;
  game.terrain = [];
  game.pads = [];
  const segs = 30;
  const segW = W / segs;

  // level-shaped baseline: a gentle dome (∩) on level 1 that flattens out,
  // then deepens into a U-shaped bowl — high rims give the cannons
  // clearer firing lines down at the ship as levels progress
  const depth = Math.min(0.35, -0.10 + (game.level - 1) * 0.03) * H;
  const baseY = H * (0.55 + Math.random() * 0.12);
  const shapeAt = t => baseY + depth * (1 - 4 * (t - 0.5) ** 2) - depth / 2;

  // choose non-adjacent pad segments, one per difficulty still in play
  const inPlay = PAD_TYPES.filter(t => game.level <= t.maxLevel);
  const padSegs = [];
  while (padSegs.length < inPlay.length) {
    const s = 3 + Math.floor(Math.random() * (segs - 6));
    if (padSegs.every(p => Math.abs(p - s) >= 3)) padSegs.push(s);
  }
  padSegs.sort((a, b) => a - b);
  const types = [...inPlay].sort(() => Math.random() - 0.5);
  let x = 0;
  let y = shapeAt(0);
  game.terrain.push({ x, y });
  for (let i = 0; i < segs; i++) {
    const padIdx = padSegs.indexOf(i);
    if (padIdx !== -1) {
      const type = types[padIdx];
      const padW = segW * type.w;
      game.terrain.push({ x: x + padW, y });
      game.pads.push({ x1: x, x2: x + padW, y, mult: type.mult, color: type.color });
      x += padW;
    } else {
      x += segW;
      // random wander pulled toward the level's baseline profile
      y += (Math.random() - 0.5) * H * 0.12 + (shapeAt(x / W) - y) * 0.55;
      y = Math.max(H * 0.25, Math.min(H * 0.92, y));
      game.terrain.push({ x, y });
    }
  }
  // make the last point reach the right edge
  game.terrain[game.terrain.length - 1].x = W;
}

// carve a crater: push nearby terrain down with a smooth falloff, never
// below a minimum floor; pad surfaces are never deformed
export function deformTerrain(x, radius, depth) {
  const floor = game.H * 0.94;
  for (const pt of game.terrain) {
    const d = Math.abs(pt.x - x);
    if (d >= radius) continue;
    if (game.pads.some(p => pt.x >= p.x1 && pt.x <= p.x2)) continue;
    const falloff = 1 - (d / radius) ** 2;
    pt.y = Math.min(pt.y + depth * falloff, floor);
  }
}

export function terrainYAt(x) {
  const terrain = game.terrain;
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i], b = terrain[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + t * (b.y - a.y);
    }
  }
  return game.H;
}

export function padAt(x) {
  return game.pads.find(p => x >= p.x1 && x <= p.x2) || null;
}

export function drawStars() {
  ctx.fillStyle = '#fff';
  for (const s of game.stars) {
    ctx.globalAlpha = 0.4 + Math.random() * 0.3;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

export function drawTerrain() {
  const { W, H, terrain, pads } = game;
  ctx.beginPath();
  ctx.moveTo(terrain[0].x, terrain[0].y);
  for (const pt of terrain) ctx.lineTo(pt.x, pt.y);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(terrain[0].x, terrain[0].y);
  for (const pt of terrain) ctx.lineTo(pt.x, pt.y);
  ctx.stroke();

  // pads, color-coded by difficulty
  for (const p of pads) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y);
    ctx.lineTo(p.x2, p.y);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('x' + p.mult, (p.x1 + p.x2) / 2, p.y + 16);
  }
}
