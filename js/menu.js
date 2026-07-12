// Pause menu: settings panel (left) + how-to-play reference (right).

import { game, clearProgress } from './state.js';
import { ctx } from './canvas.js';
import { settings, saveSettings, resetSettings } from './settings.js';
import { freshRun } from './game.js';
import { gamepad } from './input/gamepad.js';

const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export const menu = { open: false, index: 0 };

export const menuItems = [
  { label: 'ROTATION SENSITIVITY', key: 'rotSens',    min: 0.2,  max: 2.5, step: 0.1,  fmt: v => v.toFixed(1) + 'x' },
  { label: 'STICK DEADZONE',       key: 'deadzone',   min: 0.05, max: 0.6, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { label: 'TRIGGER THRESHOLD',    key: 'trigThresh', min: 0.05, max: 0.6, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { label: 'RESET SETTINGS', action: 'reset' },
  { label: 'RESET PROGRESS', action: 'wipe' },
  { label: 'CLOSE', action: 'close' },
];

export function menuMove(d) {
  menu.index = (menu.index + d + menuItems.length) % menuItems.length;
}

export function menuAdjust(d) {
  const it = menuItems[menu.index];
  if (!it.key) return;
  const v = settings[it.key] + d * it.step;
  settings[it.key] = Math.round(Math.min(it.max, Math.max(it.min, v)) * 100) / 100;
  saveSettings();
}

// touch: tap a row to use it — left/right halves adjust sliders, action rows activate
export function menuTapAt(x, y) {
  const { W, H } = game;
  const top = H / 2 - 190;
  const leftCx = W >= 700 ? W * 0.27 : W / 2;
  if (Math.abs(x - leftCx) > 240) return;
  menuItems.forEach((it, i) => {
    const rowY = top + 70 + i * 62;
    if (y < rowY - 26 || y > rowY + 30) return;
    menu.index = i;
    if (it.key) menuAdjust(x < leftCx ? -1 : 1);
    else menuActivate();
  });
}

export function menuActivate() {
  const it = menuItems[menu.index];
  if (it.action === 'reset') resetSettings();
  else if (it.action === 'wipe') {
    // wipe the save and restart the run from scratch
    clearProgress();
    freshRun();
    menu.open = false;
  }
  else if (it.action === 'close') menu.open = false;
}

function helpContent() {
  const controls = gamepad.connected ? [
    ['STICK / D-PAD', 'rotate'],
    ['A or RT', 'thrust'],
    ['B / LB', 'drop bomb *'],
    ['X', 'toggle fly assist *'],
    ['BACK', 'this menu'],
  ] : touchDevice ? [
    ['◀ ▶', 'rotate'],
    ['▲', 'thrust'],
    ['B', 'drop bomb *'],
    ['A', 'toggle fly assist *'],
    ['⚙', 'open/close this menu'],
  ] : [
    ['← → or A / D', 'rotate'],
    ['↑ SPACE or W', 'thrust'],
    ['B, S or ↓', 'drop bomb *'],
    ['F', 'toggle fly assist *'],
    ['P', 'performance metrics'],
    ['ESC', 'this menu'],
  ];
  const goal = [
    'Land slow & upright on a pad.',
    'Wide green x1 → narrow red x3.',
    'Easier pads retire at lvl 10 & 20.',
    'Keep the ball inside the box.',
    'Landings earn credits — spend',
    'them in the supply depot.',
    'Bombed cannons pay 75 cr.',
    'Red laser line = incoming beam.',
    'Asteroids fall from level 6.',
    '* needs unlock from the depot',
  ];
  return { controls, goal };
}

export function drawMenu() {
  const { W, H } = game;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, W, H);
  const top = H / 2 - 190;
  const wide = W >= 700; // two columns; settings-only on narrow screens
  const leftCx = wide ? W * 0.27 : W / 2;
  const rightCx = W * 0.73;

  // --- left: settings ---
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4caf50';
  ctx.font = 'bold 32px Courier New';
  ctx.fillText('SETTINGS', leftCx, top);

  menuItems.forEach((it, i) => {
    const y = top + 70 + i * 62;
    const sel = i === menu.index;
    ctx.fillStyle = sel ? '#fff176' : '#e0e0e0';
    ctx.font = (sel ? 'bold ' : '') + '18px Courier New';
    let text = it.label;
    if (it.key) text += '   < ' + it.fmt(settings[it.key]) + ' >';
    ctx.fillText((sel ? '> ' : '') + text + (sel ? ' <' : ''), leftCx, y);

    if (it.key) {
      const frac = (settings[it.key] - it.min) / (it.max - it.min);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftCx - 130, y + 10, 260, 9);
      ctx.fillStyle = sel ? '#fff176' : '#888';
      ctx.fillRect(leftCx - 130, y + 10, 260 * frac, 9);
    }
  });

  // --- right: how to play ---
  if (wide) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, top - 24);
    ctx.lineTo(W / 2, top + 70 + menuItems.length * 62);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 32px Courier New';
    ctx.fillText('HOW TO PLAY', rightCx, top);

    const { controls, goal } = helpContent();
    let y = top + 60;
    ctx.font = '17px Courier New';
    for (const [key, desc] of controls) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff176';
      ctx.fillText(key, rightCx - 12, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e0e0e0';
      ctx.fillText(desc, rightCx + 12, y);
      y += 28;
    }
    y += 18;
    ctx.textAlign = 'center';
    ctx.font = '16px Courier New';
    for (const lineText of goal) {
      ctx.fillStyle = lineText.startsWith('*') ? '#666' : '#b0bec5';
      ctx.fillText(lineText, rightCx, y);
      y += 24;
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#666';
  ctx.font = '16px Courier New';
  ctx.fillText('↑↓ select   ←→ adjust   ENTER / A confirm   ESC / B / BACK close', W / 2, top + 70 + menuItems.length * 62 + 14);
}
