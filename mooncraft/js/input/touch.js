// Touch input (iOS / mobile): fixed slide controls + tap buttons,
// Minecraft-on-iPad style. Left: a horizontal pad with a center point —
// thumb position left/right of center sets the turn rate. Right: a
// vertical throttle slider — bottom is OFF, top is full thrust (absolute
// position, never reverse). Bomb / assist / gear are tap buttons.

import { game } from '../state.js';
import { canvas, ctx, toLogical } from '../canvas.js';
import { menu, menuTapAt } from '../menu.js';
import { dropBomb } from '../bombs.js';
import { advance } from '../game.js';
import { shopRowAt, shopBuy } from '../shop.js';
import { entry, entryTapAt } from '../hiscores.js';

export const touch = {
  enabled: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  rot: 0,     // -1..1 from the left pad
  thrust: 0,  //  0..1 from the right slider
};

// touches we're tracking, keyed by touch identifier:
// { kind: 'rot' | 'thrust' | 'tap', x, y }
const tracked = new Map();

function sliders() {
  const { W, H } = game;
  return {
    rot: { cx: 220, cy: H - 90, half: 130 },              // horizontal pad, centered on cx
    thr: { x: W - 110, bottom: H - 50, height: 210 },     // vertical slider, bottom = off
  };
}

function actionButtons() {
  const { W, H } = game;
  const r = Math.min(W, H) * 0.07;
  return {
    assist: { x: 24 + r, y: H * 0.52, r },
    bomb:   { x: W - 24 - r, y: H * 0.52, r },
  };
}

function buttonUnlocked(name) {
  if (name === 'bomb') return game.unlocks.weapon >= 1;
  if (name === 'assist') return game.unlocks.assist >= 1;
  return true;
}

// settings/help gear, top-right corner
function gearButton() {
  return { x: game.W - 46, y: 46, r: 26 };
}

function inButton(b, x, y) {
  return Math.hypot(x - b.x, y - b.y) <= b.r * 1.25; // forgiving hit area
}

function inRotPad(s, x, y) {
  return Math.abs(x - s.rot.cx) <= s.rot.half + 46 && Math.abs(y - s.rot.cy) <= 74;
}

function inThrustSlider(s, x, y) {
  return Math.abs(x - s.thr.x) <= 64
    && y <= s.thr.bottom + 36 && y >= s.thr.bottom - s.thr.height - 46;
}

function recompute() {
  touch.rot = 0;
  touch.thrust = 0;
  const s = sliders();
  for (const g of tracked.values()) {
    if (g.kind === 'rot') {
      touch.rot = Math.max(-1, Math.min(1, (g.x - s.rot.cx) / s.rot.half));
    } else if (g.kind === 'thrust') {
      touch.thrust = Math.max(0, Math.min(1, (s.thr.bottom - g.y) / s.thr.height));
    }
  }
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const s = sliders();
  const btns = actionButtons();
  for (const t of e.changedTouches) {
    const p = toLogical(t.clientX, t.clientY);
    let kind = 'tap';

    if (inButton(gearButton(), p.x, p.y)) {
      menu.open = !menu.open;
    } else if (menu.open) {
      menuTapAt(p.x, p.y);
    } else if (game.state === 'landed') {
      const row = shopRowAt(p.x, p.y);
      if (row) shopBuy(row);
    } else if (game.state === 'crashed') {
      if (entry.active) entryTapAt(p.x, p.y); // taps go to the name entry, never restart
      else advance();
    } else if (buttonUnlocked('bomb') && inButton(btns.bomb, p.x, p.y)) {
      dropBomb();
    } else if (buttonUnlocked('assist') && inButton(btns.assist, p.x, p.y)) {
      game.assistOn = !game.assistOn;
    } else if (inRotPad(s, p.x, p.y) && ![...tracked.values()].some(g => g.kind === 'rot')) {
      kind = 'rot';
    } else if (inThrustSlider(s, p.x, p.y) && ![...tracked.values()].some(g => g.kind === 'thrust')) {
      kind = 'thrust';
    }

    tracked.set(t.identifier, { kind, x: p.x, y: p.y });
  }
  recompute();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const g = tracked.get(t.identifier);
    if (!g) continue;
    const p = toLogical(t.clientX, t.clientY);
    g.x = p.x;
    g.y = p.y;
  }
  recompute();
}, { passive: false });

for (const type of ['touchend', 'touchcancel']) {
  canvas.addEventListener(type, e => {
    e.preventDefault();
    for (const t of e.changedTouches) tracked.delete(t.identifier);
    recompute();
  }, { passive: false });
}

// block pinch-zoom gestures in iOS Safari
document.addEventListener('gesturestart', e => e.preventDefault());

// drawn after the menu overlay so it stays visible as the open/close control
export function drawTouchGear() {
  if (!touch.enabled) return;
  const b = gearButton();
  ctx.save();
  ctx.globalAlpha = menu.open ? 0.9 : 0.35;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = '#37474f';
  ctx.fill();
  ctx.strokeStyle = menu.open ? '#fff176' : '#90a4ae';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e0e0e0';
  ctx.font = Math.round(b.r * 1.1) + 'px Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙', b.x, b.y + 1);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

export function drawTouchControls() {
  if (!touch.enabled || menu.open) return;
  const s = sliders();
  const rotActive = [...tracked.values()].some(g => g.kind === 'rot');
  const thrActive = [...tracked.values()].some(g => g.kind === 'thrust');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // left: rotation pad — track, center notch, end arrows, knob
  {
    const { cx, cy, half } = s.rot;
    ctx.globalAlpha = rotActive ? 0.55 : 0.3;
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx + half, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    ctx.fillStyle = '#90a4ae';
    ctx.font = '20px Courier New';
    ctx.fillText('◀', cx - half - 24, cy + 1);
    ctx.fillText('▶', cx + half + 24, cy + 1);
    ctx.globalAlpha = rotActive ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.arc(cx + touch.rot * half, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = touch.rot !== 0 ? '#fff176' : '#78909c';
    ctx.fill();
  }

  // right: throttle slider — bottom is OFF, fill shows the amount
  {
    const { x, bottom, height } = s.thr;
    ctx.globalAlpha = thrActive ? 0.55 : 0.3;
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, bottom - height);
    ctx.stroke();
    ctx.beginPath(); // end caps
    ctx.moveTo(x - 12, bottom);
    ctx.lineTo(x + 12, bottom);
    ctx.moveTo(x - 12, bottom - height);
    ctx.lineTo(x + 12, bottom - height);
    ctx.stroke();
    ctx.fillStyle = '#90a4ae';
    ctx.font = '20px Courier New';
    ctx.fillText('▲', x, bottom - height - 22);
    ctx.font = '12px Courier New';
    ctx.fillText('OFF', x, bottom + 16);
    if (touch.thrust > 0) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffa726';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, bottom - height * touch.thrust);
      ctx.stroke();
    }
    ctx.globalAlpha = thrActive ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.arc(x, bottom - height * touch.thrust, 20, 0, Math.PI * 2);
    ctx.fillStyle = touch.thrust > 0 ? '#ffa726' : '#78909c';
    ctx.fill();
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
