// Shared mutable game state. Leaf module: everything imports this,
// it imports nothing but config.

import {
  START_LIVES, START_FUEL, FUEL_TANK_STEP, BOMB_PACKS, VIEW_W, VIEW_H,
  SAFE_VY, SAFE_ANGLE, GEAR_VY_STEP, GEAR_ANGLE_STEP, THRUST, THRUST_STEP,
} from './config.js';

// debug/testing: pick the starting level via query param, e.g. ?level=4
const urlParams = new URLSearchParams(location.search);
const urlLevel = parseInt(urlParams.get('level'), 10);
const startLevel = urlLevel >= 1 ? urlLevel : 1;

// cheats: ?cheat=god (invulnerable + maxed) or ?cheat=max (all unlocks + lives)
const cheatParam = (urlParams.get('cheat') || '').toLowerCase();
export const cheat = {
  god: cheatParam === 'god',
  max: cheatParam === 'god' || cheatParam === 'max',
};

export function freshUnlocks() {
  return {
    weapon: 0,      // 0 none, 1 bombs ×1, 2 bombs ×3, 3 super bombs ×3, 4 super bombs ×6
    assist: 0,      // 0 none, 1 level assist, 2 retro assist
    nav: 0,         // 1 = landing computer (the docking-style landing indicator)
    shield: 0,      // hits absorbed per attempt (0..3)
    gear: 0,        // landing gear tier: raises safe descent speed and angle (0..3)
    thruster: 0,    // stronger engines (0..2)
    fuel: 0,        // fuel tank upgrades owned
    livesBought: 0, // for the progressive life price
  };
}

// --- Persisted run progress (survives refresh; cleared by game over) ---
const PROGRESS_KEY = 'moonLanderProgress';

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    // a save with no lives left is a dead run — start fresh instead
    if (saved && typeof saved === 'object' && saved.lives > 0) return saved;
  } catch (e) {}
  return null;
}

const saved = loadProgress();

export const game = {
  W: VIEW_W,  // logical size — fixed; the canvas scales it to the screen
  H: VIEW_H,
  startLevel,
  terrain: [],   // list of {x, y}
  pads: [],      // list of {x1, x2, y, mult, color}
  stars: [],
  lander: null,
  particles: [],
  cannons: [],
  slugs: [],
  bombs: [],
  booms: [],
  asteroids: [],
  state: 'flying', // flying | landed | crashed
  credits: saved ? saved.credits || 0 : 0,
  score: saved ? saved.score || 0 : 0, // lifetime run earnings — never spent down
  // an explicit ?level= beats the save (debugging); otherwise resume where we were
  level: urlLevel >= 1 ? startLevel : (saved && saved.level >= 1 ? saved.level : startLevel),
  lives: saved ? saved.lives : START_LIVES,
  unlocks: { ...freshUnlocks(), ...(saved ? saved.unlocks : null) },
  assistOn: saved ? !!saved.assistOn : false, // fly assist toggle state
  assistActive: false, // assist engaged this frame (for the HUD)
  lifeAwarded: false,  // bonus life granted on the current landing (for the HUD)
  landingBreakdown: null, // { pad, fuel, speed } credits of the current landing (for the HUD)
};

export function applyCheats() {
  if (!cheat.max) return;
  game.unlocks = { weapon: 4, assist: 3, nav: 1, shield: 3, gear: 3, thruster: 2, fuel: 3, livesBought: 0 };
  game.lives = 99;
  game.credits = Math.max(game.credits, 9999);
}
applyCheats();

export function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch (e) {}
}

// levelBump: pass 1 when saving at touchdown, so a refresh on the shop screen
// resumes on the next level instead of letting the landing be re-earned
export function saveProgress(levelBump = 0) {
  if (cheat.max) return; // cheated runs never touch the real save
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      credits: game.credits,
      score: game.score,
      level: game.level + levelBump,
      lives: game.lives,
      unlocks: game.unlocks,
      assistOn: game.assistOn,
    }));
  } catch (e) {}
}

// all earnings flow through here: credits are spendable, score only ever grows
export function earn(n) {
  game.credits += n;
  game.score += n;
}

export function fuelCapacity() {
  return START_FUEL + game.unlocks.fuel * FUEL_TANK_STEP;
}

export function bombsPerAttempt() {
  return BOMB_PACKS[game.unlocks.weapon];
}

export function bombsAreSuper() {
  return game.unlocks.weapon >= 3;
}

// landing tolerances grow with the landing-gear tier
export function safeVY() {
  return SAFE_VY + game.unlocks.gear * GEAR_VY_STEP;
}

export function safeAngle() {
  return SAFE_ANGLE + game.unlocks.gear * GEAR_ANGLE_STEP;
}

export function thrustPower() {
  return THRUST + game.unlocks.thruster * THRUST_STEP;
}
