// Touch input (iOS / mobile): on-screen buttons + tap to continue.

import { game } from '../state.js';
import { canvas, ctx } from '../canvas.js';
import { menu } from '../menu.js';
import { dropBomb } from '../bombs.js';
import { advance } from '../game.js';
import { shopRowAt, shopBuy } from '../shop.js';

export const touch = {
  enabled: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  rot: 0,
  thrust: false,
  assist: false,
};

function touchButtons() {
  const { W, H } = game;
  const r = Math.min(W, H) * 0.085;
  const m = r * 0.7; // margin from screen edges
  const y = H - r - m;
  return {
    left:   { x: m + r, y, r },
    right:  { x: m + r * 3.4, y, r },
    assist: { x: m + r * 2.2, y: y - r * 2.6, r: r * 0.8 },
    thrust: { x: W - m - r * 1.15, y, r: r * 1.15 },
    bomb:   { x: W - m - r * 1.15, y: y - r * 3, r: r * 0.75 },
  };
}

function buttonUnlocked(name) {
  if (name === 'bomb') return game.unlocks.weapon >= 1;
  if (name === 'assist') return game.unlocks.assist >= 1;
  return true;
}

function inButton(b, x, y) {
  return Math.hypot(x - b.x, y - b.y) <= b.r * 1.25; // forgiving hit area
}

function readTouches(e) {
  touch.rot = 0;
  touch.thrust = false;
  touch.assist = false;
  const btns = touchButtons();
  for (const t of e.touches) {
    if (inButton(btns.left, t.clientX, t.clientY)) touch.rot -= 1;
    if (inButton(btns.right, t.clientX, t.clientY)) touch.rot += 1;
    if (inButton(btns.thrust, t.clientX, t.clientY)) touch.thrust = true;
    if (buttonUnlocked('assist') && inButton(btns.assist, t.clientX, t.clientY)) touch.assist = true;
  }
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const btns = touchButtons();
  for (const t of e.changedTouches) {
    if (buttonUnlocked('bomb') && inButton(btns.bomb, t.clientX, t.clientY)) dropBomb();
  }
  if (game.state === 'landed') {
    // shop taps: tap a row to buy, tap LAUNCH to continue
    for (const t of e.changedTouches) {
      const row = shopRowAt(t.clientX, t.clientY);
      if (row) shopBuy(row);
    }
  } else if (game.state === 'crashed') {
    advance();
  }
  readTouches(e);
}, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); readTouches(e); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); readTouches(e); }, { passive: false });
canvas.addEventListener('touchcancel', e => { e.preventDefault(); readTouches(e); }, { passive: false });
// block pinch-zoom gestures in iOS Safari
document.addEventListener('gesturestart', e => e.preventDefault());

export function drawTouchControls() {
  if (!touch.enabled || menu.open) return;
  const btns = touchButtons();
  const labels = { left: '◀', right: '▶', thrust: '▲', bomb: 'B', assist: 'A' };
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  for (const name in btns) {
    if (!buttonUnlocked(name)) continue;
    const b = btns[name];
    const active = (name === 'left' && touch.rot < 0) || (name === 'right' && touch.rot > 0)
                || (name === 'thrust' && touch.thrust)
                || (name === 'assist' && touch.assist);
    const disabled = name === 'bomb' && game.lander.bombs <= 0;
    ctx.globalAlpha = disabled ? 0.15 : (active ? 0.6 : 0.3);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#37474f';
    ctx.fill();
    ctx.strokeStyle = active ? '#fff176' : '#90a4ae';
    ctx.stroke();
    ctx.globalAlpha = disabled ? 0.25 : (active ? 1 : 0.7);
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold ' + Math.round(b.r * 0.75) + 'px Courier New';
    ctx.fillText(labels[name], b.x, b.y + 1);
  }
  ctx.restore();
}
