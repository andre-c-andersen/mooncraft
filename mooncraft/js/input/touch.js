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
import { shop, shopRows, shopRowAt, shopBuy } from '../shop.js';
import { entry, entryTapAt } from '../hiscores.js';
import { TOUCH_THRUST_DEADZONE, TOUCH_THRUST_CURVE, TOUCH_ROT_DEADZONE } from '../config.js';

export const touch = {
  enabled: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  rot: 0,        // -1..1 applied rotation (deadzoned)
  rotRaw: 0,     // -1..1 raw thumb position, for drawing the knob
  thrust: 0,     //  0..1 applied throttle (deadzoned + curved)
  thrustRaw: 0,  //  0..1 raw thumb travel, for drawing the knob
};

// touches we're tracking, keyed by touch identifier:
// { kind: 'rot' | 'thrust' | 'tap', x, y }
const tracked = new Map();

// exported so tests can drive the exact geometry
export function sliders() {
  const { W, H } = game;
  return {
    rot: { cx: 250, cy: H - 100, half: 200 },             // horizontal pad: left half turns left, right half right
    thr: { x: W - 120, bottom: H - 40, height: 280 },     // vertical slider, bottom = off
  };
}

// exported so tests can drive the exact geometry
export function actionButtons() {
  const { W, H } = game;
  const r = Math.min(W, H) * 0.07;
  return {
    assist: { x: 24 + r, y: H * 0.52, r },
    bomb:   { x: W - 24 - r, y: H * 0.36, r }, // above the taller throttle slider
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
  return Math.abs(x - s.rot.cx) <= s.rot.half + 50 && Math.abs(y - s.rot.cy) <= 105;
}

function inThrustSlider(s, x, y) {
  return Math.abs(x - s.thr.x) <= 84
    && y <= s.thr.bottom + 36 && y >= s.thr.bottom - s.thr.height - 50;
}

function recompute() {
  touch.rot = 0;
  touch.rotRaw = 0;
  touch.thrust = 0;
  touch.thrustRaw = 0;
  const s = sliders();
  for (const g of tracked.values()) {
    if (g.kind === 'rot') {
      // a wide neutral zone in the middle rests the thumb; past it the
      // response is linear out to full rate at the pad's edge
      const u = Math.max(-1, Math.min(1, (g.x - s.rot.cx) / s.rot.half));
      touch.rotRaw = u;
      touch.rot = Math.abs(u) <= TOUCH_ROT_DEADZONE ? 0
        : Math.sign(u) * (Math.abs(u) - TOUCH_ROT_DEADZONE) / (1 - TOUCH_ROT_DEADZONE);
    } else if (g.kind === 'thrust') {
      // resting in the bottom deadzone is OFF; above it the response is
      // curved so the low-throttle hover band gets the most finger travel
      const raw = Math.max(0, Math.min(1, (s.thr.bottom - g.y) / s.thr.height));
      touch.thrustRaw = raw;
      touch.thrust = raw <= TOUCH_THRUST_DEADZONE ? 0
        : Math.pow((raw - TOUCH_THRUST_DEADZONE) / (1 - TOUCH_THRUST_DEADZONE), TOUCH_THRUST_CURVE);
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
      if (row) {
        // two-step like a cursor: the first tap selects the row, a second
        // tap on the selected row buys it (LAUNCH starts selected)
        const idx = shopRows().findIndex(r => r.id === row.id);
        if (idx === shop.index) shopBuy(row);
        else shop.index = idx;
      }
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
  canvas.addEventListener(type, (/** @type {TouchEvent} */ e) => {
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

  // action buttons — invisible buttons don't exist to a player
  const btns = actionButtons();
  if (buttonUnlocked('assist')) {
    const b = btns.assist;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#37474f';
    ctx.fill();
    ctx.strokeStyle = game.assistOn ? '#4caf50' : '#90a4ae';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = game.assistOn ? '#4caf50' : '#e0e0e0';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('ASSIST', b.x, b.y - 8);
    ctx.font = '13px Courier New';
    ctx.fillText(game.assistOn ? 'ON' : 'OFF', b.x, b.y + 14);
  }
  if (buttonUnlocked('bomb')) {
    const b = btns.bomb;
    const armed = game.lander && game.lander.bombs > 0;
    ctx.globalAlpha = armed ? 0.55 : 0.3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#37474f';
    ctx.fill();
    ctx.strokeStyle = armed ? '#ffa726' : '#666';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = Math.round(b.r * 0.7) + 'px Courier New';
    ctx.fillText('💣', b.x, b.y - 6);
    ctx.fillStyle = armed ? '#e0e0e0' : '#666';
    ctx.font = 'bold 14px Courier New';
    ctx.fillText('×' + (game.lander ? game.lander.bombs : 0), b.x, b.y + 26);
  }

  // left: rotation pad — track with a wide neutral center band, end arrows, knob
  {
    const { cx, cy, half } = s.rot;
    const dead = half * TOUCH_ROT_DEADZONE;
    ctx.globalAlpha = rotActive ? 0.55 : 0.3;
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx + half, cy);
    ctx.stroke();
    // neutral band: resting the thumb here doesn't turn
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - dead, cy);
    ctx.lineTo(cx + dead, cy);
    ctx.stroke();
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.beginPath(); // band boundary ticks
    ctx.moveTo(cx - dead, cy - 12);
    ctx.lineTo(cx - dead, cy + 12);
    ctx.moveTo(cx + dead, cy - 12);
    ctx.lineTo(cx + dead, cy + 12);
    ctx.stroke();
    ctx.fillStyle = '#90a4ae';
    ctx.font = '20px Courier New';
    ctx.fillText('◀', cx - half - 24, cy + 1);
    ctx.fillText('▶', cx + half + 24, cy + 1);
    ctx.globalAlpha = rotActive ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.arc(cx + touch.rotRaw * half, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = touch.rot !== 0 ? '#fff176' : '#78909c';
    ctx.fill();
  }

  // right: throttle slider — a deadzone at the bottom stays OFF, then a
  // gradient fill that ramps steeply through the low-throttle hover band
  {
    const { x, bottom, height } = s.thr;
    const deadTop = bottom - height * TOUCH_THRUST_DEADZONE;
    ctx.globalAlpha = thrActive ? 0.55 : 0.3;
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, bottom - height);
    ctx.stroke();
    ctx.beginPath(); // end caps + deadzone boundary tick
    ctx.moveTo(x - 12, bottom);
    ctx.lineTo(x + 12, bottom);
    ctx.moveTo(x - 12, bottom - height);
    ctx.lineTo(x + 12, bottom - height);
    ctx.moveTo(x - 16, deadTop);
    ctx.lineTo(x + 16, deadTop);
    ctx.stroke();
    // the OFF band, visibly distinct so the thumb can rest there
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, deadTop);
    ctx.stroke();
    ctx.fillStyle = '#90a4ae';
    ctx.font = '20px Courier New';
    ctx.fillText('▲', x, bottom - height - 22);
    ctx.font = '12px Courier New';
    ctx.fillText('OFF', x, bottom + 16);
    if (touch.thrust > 0) {
      ctx.globalAlpha = 0.75;
      const grad = ctx.createLinearGradient(0, deadTop, 0, bottom - height);
      grad.addColorStop(0, '#7f5416');
      grad.addColorStop(0.5, '#ffa726');
      grad.addColorStop(1, '#fff176');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, deadTop);
      ctx.lineTo(x, bottom - height * touch.thrustRaw);
      ctx.stroke();
    }
    ctx.globalAlpha = thrActive ? 0.9 : 0.45;
    ctx.beginPath();
    ctx.arc(x, bottom - height * touch.thrustRaw, 22, 0, Math.PI * 2);
    ctx.fillStyle = touch.thrust > 0 ? '#ffa726' : '#78909c';
    ctx.fill();
  }

  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
