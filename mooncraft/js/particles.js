// Exhaust / explosion / blast particles.

import { game } from './state.js';
import { ctx } from './canvas.js';
import { GRAVITY } from './config.js';
import { terrainYAt } from './terrain.js';

export function updateParticles() {
  const particles = game.particles;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (!p.text) p.vy += GRAVITY * 0.5; // bonus text floats instead of falling
    p.life--;
    if (p.life <= 0 || p.y > terrainYAt(p.x)) particles.splice(i, 1);
  }
}

export function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    if (p.text) {
      ctx.font = 'bold 16px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
