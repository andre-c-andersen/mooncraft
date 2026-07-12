// Starfield, terrain, and landing pads: generation, queries, drawing.

import { game } from './state.js';
import { ctx } from './canvas.js';

export function genStars() {
  game.stars = [];
  for (let i = 0; i < 120; i++) {
    game.stars.push({ x: Math.random() * game.W, y: Math.random() * game.H * 0.85, r: Math.random() * 1.4 + 0.3 });
  }
}

// markedly different landing difficulties: wide & cheap → narrow & lucrative
const PAD_TYPES = [
  { w: 2.6, mult: 1, color: '#4caf50' },  // easy: wide
  { w: 1.6, mult: 3, color: '#ffb300' },  // medium
  { w: 1.0, mult: 6, color: '#ff5252' },  // hard: barely wider than the ship
];

export function genTerrain() {
  const { W, H } = game;
  game.terrain = [];
  game.pads = [];
  const segs = 30;
  const segW = W / segs;
  let y = H * (0.65 + Math.random() * 0.2);
  // choose non-adjacent pad segments, one per difficulty, in random order
  const padSegs = [];
  while (padSegs.length < PAD_TYPES.length) {
    const s = 3 + Math.floor(Math.random() * (segs - 6));
    if (padSegs.every(p => Math.abs(p - s) >= 3)) padSegs.push(s);
  }
  padSegs.sort((a, b) => a - b);
  const types = [...PAD_TYPES].sort(() => Math.random() - 0.5);
  let x = 0;
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
      y += (Math.random() - 0.5) * H * 0.18;
      y = Math.max(H * 0.45, Math.min(H * 0.92, y));
      game.terrain.push({ x, y });
    }
  }
  // make the last point reach the right edge
  game.terrain[game.terrain.length - 1].x = W;
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
