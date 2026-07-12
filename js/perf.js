// Performance metrics overlay, toggled with the P key.

import { game } from './state.js';
import { ctx } from './canvas.js';
import { VERSION } from './config.js';

export const perf = { visible: false };

const WINDOW = 90; // rolling window of render frames
const frames = [];

// called once per render frame with the real elapsed ms, the number of
// 60 Hz sim steps executed, and the cpu time spent in sim vs drawing
export function perfFrame(dt, steps, simMs, drawMs) {
  frames.push({ dt, steps, simMs, drawMs });
  if (frames.length > WINDOW) frames.shift();
}

export function drawPerf() {
  if (!perf.visible || frames.length === 0) return;
  const n = frames.length;
  const sum = k => frames.reduce((a, f) => a + f[k], 0);
  const totalDt = sum('dt');
  const fps = totalDt > 0 ? (n * 1000) / totalDt : 0;
  const stepsPerSec = totalDt > 0 ? (sum('steps') * 1000) / totalDt : 0;
  const worstDt = Math.max(...frames.map(f => f.dt));

  const lines = [
    'v' + VERSION + '   view ' + game.W + 'x' + game.H + ' @ ' + (window.devicePixelRatio || 1) + 'x dpr',
    'render ' + fps.toFixed(1) + ' fps   worst frame ' + worstDt.toFixed(1) + ' ms',
    'sim    ' + stepsPerSec.toFixed(1) + ' steps/s (target 60)',
    'cpu    sim ' + (sum('simMs') / n).toFixed(2) + ' ms   draw ' + (sum('drawMs') / n).toFixed(2) + ' ms',
    'ents   part ' + game.particles.length + '  slug ' + game.slugs.length
      + '  bomb ' + game.bombs.length + '  astr ' + game.asteroids.length
      + '  cann ' + game.cannons.length + '  boom ' + game.booms.length,
  ];

  const lineH = 17, padX = 12, padY = 10;
  const w = 480;
  const h = lines.length * lineH + padY * 2;
  const x = 24;
  const y = game.H - 44 - h; // above the bottom hint line

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#a5d6a7';
  ctx.font = '13px Courier New';
  ctx.textAlign = 'left';
  lines.forEach((text, i) => ctx.fillText(text, x + padX, y + padY + 13 + i * lineH));
  ctx.restore();
}
