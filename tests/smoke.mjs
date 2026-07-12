// End-to-end smoke test: boots the real game headless and exercises
// flight, combat, the economy, shields, gear, craters, and the menu.
import { setup, assert, importGame } from './harness.mjs';

const h = setup({ search: '?level=20' }); // high level: max cannons and hazards
const { runFrames, keyDown, keyUp, pressKey } = h;

await importGame('main.js');
const { game } = await importGame('state.js');
const { shop } = await importGame('shop.js');

assert(game.level === 20, 'starts at ?level=20');
// placement is best-effort: spacing + pad exclusion can cap below the level max
assert(game.cannons.length >= 5 && game.cannons.length <= 10,
  'several cannons at level 20, got ' + game.cannons.length);
assert(game.cannons.some(c => c.type === 'laser'), 'lasers present');
assert(game.cannons[0].type === 'gun' && game.cannons[1].type === 'laser', 'alternation starts gun, laser');
assert(game.pads.length === 3, '3 landing pads');
assert([...game.pads.map(p => p.mult)].sort((a, b) => a - b).join() === '1,2,3', 'pad multipliers are 1, 2, 3');
assert(game.credits === 0 && game.score === undefined, 'credits replace score');
assert(game.lander.bombs === 0, 'no bombs before the unlock is bought');

// bomb key does nothing while weapon is locked
pressKey('b');
assert(game.bombs.length === 0, 'bomb key inert without the unlock');

// asteroid wave sizes scale from level 6 to 25
const { waveSize } = await importGame('asteroids.js');
const sizes = [5, 6, 11, 16, 21, 25].map(l => { game.level = l; return waveSize(); });
game.level = 20;
assert(sizes.join() === '0,1,2,3,4,5', 'asteroid wave size ramps 0→5 over levels 6..25, got ' + sizes.join());

// asteroid physics + draw paths run; a rock dropped on the ship kills it
game.asteroids.push({ x: game.lander.x, y: game.lander.y - 40, vx: 0, vy: 2, r: 12, rot: 0, vrot: 0.02, verts: Array(8).fill(1) });
runFrames(30);
assert(game.state === 'crashed' && game.asteroids.length === 0, 'asteroid collision crashes the ship');
pressKey(' '); // retry

// free-fall: gravity must eventually end the attempt
const livesBeforeFall = game.lives;
runFrames(600);
assert(game.state !== 'flying', 'free-fall ends the attempt; state=' + game.state);
assert(game.lives === livesBeforeFall - 1, 'crash costs a life');

// retry
pressKey(' ');
assert(game.state === 'flying', 'space retries after crash');

// thrust burns fuel
const fuelBefore = game.lander.fuel;
keyDown('ArrowUp');
runFrames(30);
keyUp('ArrowUp');
assert(game.lander.fuel < fuelBefore, 'thrusting burns fuel');

// --- shop flow (simulate a landing) ---
game.state = 'landed';
runFrames(1); // shop opens
assert(shop.index === 6, 'LAUNCH is preselected when the shop opens');
game.credits = 5000;
shop.index = 0;
pressKey('Enter'); // buy weapon tier 1: BOMBS ×3 (100)
assert(game.unlocks.weapon === 1 && game.credits === 4900, 'bought bombs unlock');
pressKey('Enter'); // tier 2: TRIPLE BOMB (250)
assert(game.unlocks.weapon === 2 && game.credits === 4650, 'bought triple bomb');
pressKey('ArrowDown'); // assist row
pressKey('Enter'); // LEVEL ASSIST (150)
assert(game.unlocks.assist === 1 && game.credits === 4500, 'bought level assist');
pressKey('Enter'); // RETRO ASSIST (700)
assert(game.unlocks.assist === 2 && game.credits === 3800, 'bought retro assist');
pressKey('Enter'); // LANDING ASSIST (1400)
assert(game.unlocks.assist === 3 && game.credits === 2400, 'bought landing assist');
pressKey('ArrowDown'); // shield row
pressKey('Enter'); // SHIELD +1 HIT (600)
assert(game.unlocks.shield === 1 && game.credits === 1800, 'bought shield tier 1');
pressKey('ArrowDown'); // gear row
pressKey('Enter'); // LANDING GEAR MK2 (200)
assert(game.unlocks.gear === 1 && game.credits === 1600, 'bought landing gear');
pressKey('ArrowDown'); // fuel row
pressKey('Enter'); // FUEL TANK (120)
assert(game.unlocks.fuel === 1 && game.credits === 1480, 'bought fuel tank');
pressKey('ArrowDown'); // life row
const livesBefore = game.lives;
pressKey('Enter'); // EXTRA LIFE (100)
assert(game.lives === livesBefore + 1 && game.credits === 1380, 'bought extra life');
pressKey('Enter'); // second life should cost more (180)
assert(game.credits === 1200, 'life price escalates (180 for the second)');

const levelBefore = game.level;
pressKey(' '); // launch
assert(game.state === 'flying' && game.level === levelBefore + 1, 'launch advances level');
assert(game.lives === livesBefore + 2, 'no free life on level advance');
assert(game.lander.bombs === 3, 'bombs granted after unlock');
assert(game.lander.fuel === 650, 'fuel capacity upgraded to 650');
assert(game.lander.shield === 1, 'shield charge granted on launch');
const { safeVY } = await importGame('state.js');
assert(Math.abs(safeVY() - 2.15) < 1e-9, 'landing gear raises safe descent speed to 2.15');
{
  const p = JSON.parse(h.store.moonLanderProgress);
  assert(p.level === game.level && p.credits === game.credits
    && p.lives === game.lives && p.unlocks.weapon === game.unlocks.weapon,
    'progress persisted to localStorage');
}

// shield: one charge blocks exactly one projectile — no immunity window
game.slugs.push({ x: game.lander.x, y: game.lander.y, vx: 0, vy: 0, life: 60 });
runFrames(1);
assert(game.state === 'flying' && game.lander.shield === 0, 'shield absorbs a slug');
game.slugs.push({ x: game.lander.x, y: game.lander.y, vx: 0, vy: 0, life: 60 });
runFrames(1);
assert(game.state === 'crashed', 'second projectile kills — no blanket immunity');
pressKey(' '); // retry
assert(game.lander.shield === 1, 'shield recharges each attempt');

// a laser beam persists for many frames but counts as ONE projectile
{
  const fake = {
    x: game.lander.x - 100, y: game.lander.y, angle: 0, cooldown: 9999,
    type: 'laser', phase: 'beam', timer: 12, aimTotal: 90, beamAngle: 0, beamHit: false,
  };
  game.cannons.push(fake);
  runFrames(14); // the full beam sweeps over the ship
  assert(game.state === 'flying' && game.lander.shield === 0,
    'laser beam consumes exactly one shield charge, not all of them');
  game.cannons.splice(game.cannons.indexOf(fake), 1);
}

// a consumed charge recharges after ~4 quiet seconds
{
  const levelWas = game.level;
  game.level = 2;       // no asteroid spawns while we wait
  game.cannons = [];    // no incoming fire either
  game.asteroids = [];
  assert(game.lander.shield === 0, 'charge consumed before the recharge wait');
  for (let i = 0; i < 6; i++) { // park the ship so it can't hit terrain
    game.lander.y = 150;
    game.lander.vy = 0;
    runFrames(50);
  }
  assert(game.lander.shield === 1, 'shield recharges after a few seconds');
  runFrames(60);
  assert(game.lander.shield === 1, 'recharge never exceeds the owned tier');
  game.level = levelWas;
}

// triple bomb: one press releases the whole rack
pressKey('b');
assert(game.lander.bombs === 0 && game.bombs.length === 3, 'triple bomb releases all 3 at once');

// retro assist: F toggles it on; ship tilts against x-travel
// (pin the tier to 2 so landing assist doesn't take over)
game.unlocks.assist = 2;
game.lander.vx = 3;
game.lander.vy = 0;
game.lander.y = game.H * 0.2;
game.lander.angle = 0;
pressKey('f'); // toggle on
runFrames(40); // linear rate: 40 frames × 0.012 rad ≈ 0.48 rad of correction
assert(game.assistActive, 'assist toggled on stays on');
assert(game.lander.angle < -0.3, 'retro assist tilts against +vx, angle=' + game.lander.angle.toFixed(2));
pressKey('f'); // toggle off
runFrames(2);
assert(!game.assistActive, 'second press toggles assist off');
game.unlocks.assist = 3;

// landing assist: aims the rocket toward the nearest pad
{
  const levelWas = game.level;
  game.level = 2;       // hazard-free window
  game.cannons = [];
  game.asteroids = [];
  // park the ship left of a pad that is its own nearest pad
  let padX = null;
  for (const p of game.pads) {
    const cx = (p.x1 + p.x2) / 2;
    const probe = cx - 160;
    const nearest = game.pads.reduce((a, b) =>
      Math.abs((a.x1 + a.x2) / 2 - probe) < Math.abs((b.x1 + b.x2) / 2 - probe) ? a : b);
    if (nearest === p) { padX = cx; break; }
  }
  assert(padX !== null, 'found a pad for the landing assist test');
  game.lander.x = padX - 160;
  game.lander.y = 150;
  game.lander.vx = 0;
  game.lander.vy = 0;
  game.lander.angle = 0;
  pressKey('f'); // toggle on
  runFrames(50);
  assert(game.assistActive, 'landing assist engaged');
  assert(game.lander.angle > 0.08,
    'landing assist tilts toward the pad on the right, angle=' + game.lander.angle.toFixed(2));
  pressKey('f'); // toggle off
  runFrames(2);
  game.level = levelWas;
}

// super bombs
game.unlocks.weapon = 4;
game.state = 'flying';
game.lander.bombs = 3;
game.bombs = []; // clear leftovers from the earlier volley
pressKey('b');
assert(game.bombs.length === 3 && game.bombs.every(b => b.super), 'super bombs flagged');

// super blasts crater the terrain, but never below the floor
{
  const { terrainYAt } = await importGame('terrain.js');
  const { detonate } = await importGame('bombs.js');
  let cx = game.W * 0.31;
  while (game.pads.some(p => cx >= p.x1 - 40 && cx <= p.x2 + 40)) cx += 90;
  const before = terrainYAt(cx);
  detonate(cx, before, true);
  const after = terrainYAt(cx);
  assert(after > before, 'super blast deepens the terrain (' + before.toFixed(0) + ' → ' + after.toFixed(0) + ')');
  for (let i = 0; i < 30; i++) detonate(cx, terrainYAt(cx), true);
  assert(terrainYAt(cx) <= game.H * 0.94 + 1, 'craters never sink below the floor');
  const padY = game.pads[0].y;
  detonate((game.pads[0].x1 + game.pads[0].x2) / 2, padY, true);
  assert(game.pads[0].y === padY, 'pads are never deformed');
}

// perf overlay toggles with P and draws without breaking the loop
{
  const { perf } = await importGame('perf.js');
  pressKey('p');
  assert(perf.visible, 'P shows the perf overlay');
  runFrames(5);
  pressKey('p');
  assert(!perf.visible, 'P hides the perf overlay');
}

// menu still pauses
pressKey('Escape');
const { menu } = await importGame('menu.js');
assert(menu.open, 'escape opens menu');
const xBefore = game.lander.x;
runFrames(10);
assert(game.lander.x === xBefore, 'game pauses while menu open');
pressKey('Escape');
assert(!menu.open, 'escape closes menu');

// RESET PROGRESS menu item wipes the run
game.credits = 555;
pressKey('Escape');
menu.index = 4; // RESET PROGRESS row
pressKey('Enter');
assert(!menu.open, 'reset progress closes the menu');
assert(game.credits === 0 && game.level === game.startLevel && game.lives === 3
  && game.unlocks.weapon === 0, 'reset progress starts a fresh run');

// game over resets economy
game.lives = 1;
game.state = 'flying';
runFrames(900); // fall/crash
assert(game.state === 'crashed' && game.lives === 0, 'final crash reaches game over');
pressKey(' ');
assert(game.credits === 0 && game.unlocks.weapon === 0 && game.unlocks.assist === 0
  && game.lives === 3 && game.level === game.startLevel, 'game over resets credits, unlocks, lives, level');

// long soak across states
for (let round = 0; round < 4; round++) {
  runFrames(400);
  if (game.state !== 'flying') pressKey(' ');
}
console.log('\nAll smoke tests passed. Final: state=' + game.state + ' level=' + game.level +
  ' lives=' + game.lives + ' credits=' + game.credits);
