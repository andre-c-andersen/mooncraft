// Supply depot: spend credits on unlocks between levels (shown when landed).

import { game, saveProgress } from './state.js';
import { ctx } from './canvas.js';
import { advance } from './game.js';
import { gamepad } from './input/gamepad.js';

// note: touch.js imports this module, so touch capability is detected inline
const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const WEAPON_TIERS = [
  { label: 'BOMBS ×3',          price: 100 },
  { label: 'TRIPLE BOMB',       price: 250 },
  { label: 'SUPER BOMBS',       price: 500 },
  { label: 'TRIPLE SUPER BOMB', price: 900 },
];
const ASSIST_TIERS = [
  { label: 'LEVEL ASSIST',  price: 150 },
  { label: 'RETRO ASSIST',  price: 400 },
];
const FUEL_TIERS = [
  { label: 'FUEL TANK +150', price: 120 },
  { label: 'FUEL TANK +150', price: 240 },
  { label: 'FUEL TANK +150', price: 480 },
];

export function lifePrice() {
  // progressively more expensive: 100, 180, 320, 580, ...
  return Math.round(100 * Math.pow(1.8, game.unlocks.livesBought) / 10) * 10;
}

export const shop = { index: 0 };

function nextTier(tiers, owned, id, maxLabel) {
  return tiers[owned]
    ? { id, label: tiers[owned].label, price: tiers[owned].price }
    : { id, label: maxLabel, price: null, maxed: true };
}

export function shopRows() {
  const u = game.unlocks;
  return [
    nextTier(WEAPON_TIERS, u.weapon, 'weapon', 'WEAPONS MAXED'),
    nextTier(ASSIST_TIERS, u.assist, 'assist', 'ASSIST MAXED'),
    nextTier(FUEL_TIERS, u.fuel, 'fuel', 'FUEL TANK MAXED'),
    { id: 'life', label: 'EXTRA LIFE', price: lifePrice() },
    { id: 'launch', label: 'LAUNCH ▸', price: null },
  ];
}

export function shopMove(d) {
  const n = shopRows().length;
  shop.index = (shop.index + d + n) % n;
}

export function shopBuy(row) {
  if (row.id === 'launch') { advance(); return; }
  if (row.maxed || row.price === null || game.credits < row.price) return;
  game.credits -= row.price;
  const u = game.unlocks;
  if (row.id === 'weapon') u.weapon++;
  else if (row.id === 'assist') u.assist++;
  else if (row.id === 'fuel') u.fuel++;
  else if (row.id === 'life') { u.livesBought++; game.lives++; }
  // purchases happen on the shop screen, where the save already points at the
  // next level — keep it that way
  saveProgress(1);
}

export function shopActivate() {
  shopBuy(shopRows()[shop.index]);
}

// --- Layout + drawing ---

function layout() {
  const { W, H } = game;
  const rows = shopRows();
  const rowH = 44;
  const pw = Math.min(W * 0.86, 640);
  const ph = 80 + rows.length * rowH + 26;
  const top = Math.min(H / 2 + 36, H - ph - 8); // keep on-screen for short viewports
  return { rows, rowH, pw, ph, top, left: W / 2 - pw / 2 };
}

export function drawShop() {
  const { rows, rowH, pw, ph, top, left } = layout();
  const cx = game.W / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(left, top, pw, ph);
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top, pw, ph);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4caf50';
  ctx.font = 'bold 21px Courier New';
  ctx.fillText('SUPPLY DEPOT — ' + game.credits + ' CR', cx, top + 32);

  rows.forEach((row, i) => {
    const y = top + 80 + i * rowH;
    const sel = i === shop.index;
    const affordable = row.price !== null && game.credits >= row.price;
    ctx.font = (sel ? 'bold ' : '') + '18px Courier New';
    ctx.textAlign = 'left';
    ctx.fillStyle = row.maxed ? '#666' : (sel ? '#fff176' : '#e0e0e0');
    ctx.fillText((sel ? '> ' : '  ') + row.label, left + 24, y);
    ctx.textAlign = 'right';
    if (row.price !== null) {
      ctx.fillStyle = affordable ? '#4caf50' : '#ff5252';
      ctx.fillText(row.price + ' CR', left + pw - 24, y);
    } else if (row.maxed) {
      ctx.fillStyle = '#666';
      ctx.fillText('MAXED', left + pw - 24, y);
    }
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#666';
  ctx.font = '15px Courier New';
  const hint = gamepad.connected
    ? 'D-PAD select   A confirm   START launch'
    : touchDevice
      ? 'tap a row to buy   tap LAUNCH to lift off'
      : '↑↓ select   ENTER confirm   SPACE launch';
  ctx.fillText(hint, cx, top + ph - 12);
  ctx.restore();
}

export function shopRowAt(x, y) {
  const { rows, rowH, pw, top, left } = layout();
  for (let i = 0; i < rows.length; i++) {
    const ry = top + 80 + i * rowH;
    if (x >= left && x <= left + pw && y >= ry - 28 && y <= ry + 14) return rows[i];
  }
  return null;
}
