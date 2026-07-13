// Local top-10 leaderboard (ranked by level reached, then score) with
// arcade-style three-letter name entry: keyboard, gamepad, and touch.
// Stored under its own key, so it survives game over and RESET PROGRESS.

import { game, cheat } from './state.js';
import { ctx } from './canvas.js';

const KEY = 'moonLanderHiscores';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let cache = null;

export function hiscores() {
  if (!cache) {
    try {
      const list = JSON.parse(localStorage.getItem(KEY));
      cache = Array.isArray(list) ? list.filter(e => e && typeof e.name === 'string') : [];
    } catch (e) { cache = []; }
  }
  return cache;
}

// best first: highest level reached wins, score breaks ties
const byRank = (a, b) => b.level - a.level || b.score - a.score;

export function qualifies(level, score) {
  if (score <= 0) return false; // an empty run isn't board-worthy
  const list = hiscores();
  return list.length < 10 || byRank({ level, score }, list[list.length - 1]) < 0;
}

export function recordHiscore(name, level, score) {
  const e = { name, level, score };
  const list = [...hiscores(), e];
  list.sort(byRank); // stable: existing entries win ties
  cache = list.slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (err) {}
  return cache.indexOf(e); // rank on the board, -1 if it fell off
}

// --- Name entry state + controls (shared by keyboard / gamepad / touch) ---

export const entry = { active: false, slot: 0, letters: [0, 0, 0], rank: -1 };

export function maybeStartEntry() {
  if (cheat.max || !qualifies(game.level, game.score)) return; // cheated runs never enter
  entry.active = true;
  entry.slot = 0;
  entry.letters = [0, 0, 0];
  entry.rank = -1;
}

export function entryMove(d) {
  entry.slot = Math.max(0, Math.min(2, entry.slot + d));
}

export function entryCycle(d) {
  entry.letters[entry.slot] = (entry.letters[entry.slot] + d + 26) % 26;
}

// direct typing: set the letter, hop to the next slot
export function entryType(ch) {
  const i = LETTERS.indexOf(ch.toUpperCase());
  if (i === -1) return;
  entry.letters[entry.slot] = i;
  entry.slot = Math.min(2, entry.slot + 1);
}

export function entryConfirm() {
  const name = entry.letters.map(i => LETTERS[i]).join('');
  entry.rank = recordHiscore(name, game.level, game.score);
  entry.active = false;
}

// back out without recording (ESC / gamepad B)
export function entryCancel() {
  entry.active = false;
  entry.rank = -1;
}

export function entryReset() {
  entry.active = false;
  entry.rank = -1;
}

// --- Layout + drawing (game-over screen) ---

function entryLayout() {
  const cx = game.W / 2;
  const boxW = 58, boxH = 64, gap = 18, y = 214;
  const xs = [-1, 0, 1].map(k => cx + k * (boxW + gap) - boxW / 2); // box left edges
  return { xs, y, boxW, boxH, ok: { x: cx + 2 * (boxW + gap) + 4, y: y + 8, w: 92, h: 48 } };
}

// touch: taps on the arrows cycle a letter, on a box select it, on OK confirm.
// Swallows every tap while entry is open so a stray tap can't restart the run.
export function entryTapAt(x, y) {
  const L = entryLayout();
  if (x >= L.ok.x - 8 && x <= L.ok.x + L.ok.w + 8 && y >= L.ok.y - 8 && y <= L.ok.y + L.ok.h + 8) {
    entryConfirm();
    return;
  }
  for (let i = 0; i < 3; i++) {
    const bx = L.xs[i];
    if (x < bx - 10 || x > bx + L.boxW + 10) continue;
    if (y >= L.y - 74 && y < L.y) { entry.slot = i; entryCycle(1); }
    else if (y <= L.y + L.boxH) { entry.slot = i; }
    else if (y <= L.y + L.boxH + 74) { entry.slot = i; entryCycle(-1); }
    return;
  }
}

export function drawHiscores() {
  const { W } = game;
  const list = hiscores();
  ctx.save();
  ctx.textAlign = 'center';

  let tableY = 200;
  if (entry.active) {
    const L = entryLayout();
    ctx.fillStyle = '#fff176';
    ctx.font = 'bold 22px Courier New';
    ctx.fillText('TOP 10 — ENTER YOUR NAME', W / 2, L.y - 56);
    for (let i = 0; i < 3; i++) {
      const bx = L.xs[i], sel = i === entry.slot;
      ctx.fillStyle = sel ? '#fff176' : '#90a4ae';
      ctx.font = '22px Courier New';
      ctx.fillText('▲', bx + L.boxW / 2, L.y - 16);
      ctx.fillText('▼', bx + L.boxW / 2, L.y + L.boxH + 30);
      ctx.strokeStyle = sel ? '#fff176' : '#666';
      ctx.lineWidth = sel ? 3 : 2;
      ctx.strokeRect(bx, L.y, L.boxW, L.boxH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px Courier New';
      ctx.fillText(LETTERS[entry.letters[i]], bx + L.boxW / 2, L.y + L.boxH - 18);
    }
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.strokeRect(L.ok.x, L.ok.y, L.ok.w, L.ok.h);
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText('OK', L.ok.x + L.ok.w / 2, L.ok.y + L.ok.h - 15);
    tableY = L.y + L.boxH + 78;
  }

  if (list.length) {
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('HIGH SCORES', W / 2, tableY);
    ctx.font = '19px Courier New';
    list.forEach((e, i) => {
      ctx.fillStyle = i === entry.rank ? '#fff176' : '#e0e0e0'; // your fresh entry pops
      ctx.fillText(
        String(i + 1).padStart(2) + '. ' + e.name
          + '   LVL ' + String(e.level).padStart(3)
          + '   ' + String(e.score).padStart(7),
        W / 2, tableY + 30 + i * 26);
    });
  }
  ctx.restore();
  ctx.textAlign = 'left';
}
