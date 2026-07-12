// Canvas element, 2D context, and Retina-aware sizing.

import { game } from './state.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  game.W = window.innerWidth;
  game.H = window.innerHeight;
  canvas.width = game.W * dpr;
  canvas.height = game.H * dpr;
  canvas.style.width = game.W + 'px';
  canvas.style.height = game.H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}
