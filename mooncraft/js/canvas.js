// Canvas element and scaling: the game draws in a fixed logical space
// (VIEW_W × VIEW_H); the canvas is scaled to fit the screen, centered,
// with black bars where the aspect ratio differs.

import { VIEW_W, VIEW_H } from './config.js';

export const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
export const ctx = canvas.getContext('2d');

export function resize() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(VIEW_W * scale * dpr);
  canvas.height = Math.round(VIEW_H * scale * dpr);
  canvas.style.width = Math.round(VIEW_W * scale) + 'px';
  canvas.style.height = Math.round(VIEW_H * scale) + 'px';
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0); // draw in logical pixels
}

// map a client (screen) coordinate into logical game space
export function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * VIEW_W / rect.width,
    y: (clientY - rect.top) * VIEW_H / rect.height,
  };
}
