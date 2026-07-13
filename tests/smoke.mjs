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
assert(game.pads.length === 1 && game.pads[0].mult === 3, 'only the hard pad at level 20+');
assert(game.credits === 0 && game.score === 0, 'credits and score start at zero');

// easier pads retire as levels climb
{
  const { genTerrain } = await importGame('terrain.js');
  const multsAt = l => { game.level = l; genTerrain(); return game.pads.map(p => p.mult).sort((a, b) => a - b).join(); };
  assert(multsAt(9) === '1,2,3', 'all three pads up to level 9');
  assert(multsAt(10) === '2,3', 'easy pad gone from level 10');
  assert(multsAt(19) === '2,3', 'medium pad survives to level 19');
  assert(multsAt(20) === '3', 'only the hard pad from level 20');
  assert(multsAt(25) === '3,3,3', 'three decoy-era pads from level 25');
  game.level = 20;
  genTerrain(); // restore level-20 terrain for the rest of the run
}
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

// a real touchdown: pad + fuel + full speed bonus, paid and itemized
{
  const pad = game.pads[0];
  const l = game.lander;
  const creditsBefore = game.credits;
  l.x = (pad.x1 + pad.x2) / 2;
  l.y = pad.y - 40;
  l.vx = 0;
  l.vy = 0.5;
  l.angle = 0;
  l.age = 0; // fast landing → full speed bonus
  const expectedFuel = Math.floor(l.fuel / 10);
  runFrames(120);
  assert(game.state === 'landed', 'controlled touchdown lands');
  assert(game.landingBreakdown && game.landingBreakdown.speed === 150,
    'fast landing earns the full speed bonus');
  assert(game.credits === creditsBefore + 50 * pad.mult + expectedFuel + 150,
    'landing pays pad + fuel + speed');
  assert(game.score === game.credits, 'score tracks earnings one-to-one');
}

// --- shop flow (already landed above) ---
game.state = 'landed';
runFrames(1); // shop opens
assert(shop.index === 8, 'LAUNCH is preselected when the shop opens');
const scoreBeforeShopping = game.score;
game.credits = 5000; // handout, not earnings — score must not move
shop.index = 0;
pressKey('Enter'); // buy weapon tier 1: BOMBS ×1 (100)
assert(game.unlocks.weapon === 1 && game.credits === 4900, 'bought bombs unlock');
pressKey('Enter'); // tier 2: BOMBS ×3 (250)
assert(game.unlocks.weapon === 2 && game.credits === 4650, 'bought bombs ×3');
pressKey('ArrowDown'); // assist row
pressKey('Enter'); // LEVEL ASSIST (100)
assert(game.unlocks.assist === 1 && game.credits === 4550, 'bought level assist');
pressKey('Enter'); // RETRO ASSIST (300)
assert(game.unlocks.assist === 2 && game.credits === 4250, 'bought retro assist');
pressKey('Enter'); // LANDING ASSIST (600)
assert(game.unlocks.assist === 3 && game.credits === 3650, 'bought landing assist');
pressKey('ArrowDown'); // nav row
pressKey('Enter'); // LANDING COMPUTER (150)
assert(game.unlocks.nav === 1 && game.credits === 3500, 'bought landing computer');
pressKey('Enter'); // already owned — a second press must not charge again
assert(game.unlocks.nav === 1 && game.credits === 3500, 'landing computer is one-shot');
pressKey('ArrowDown'); // shield row
pressKey('Enter'); // SHIELD +1 HIT (600)
assert(game.unlocks.shield === 1 && game.credits === 2900, 'bought shield tier 1');
pressKey('ArrowDown'); // gear row
pressKey('Enter'); // LANDING GEAR MK2 (200)
assert(game.unlocks.gear === 1 && game.credits === 2700, 'bought landing gear');
pressKey('ArrowDown'); // thruster row
pressKey('Enter'); // THRUSTER MK2 (250)
assert(game.unlocks.thruster === 1 && game.credits === 2450, 'bought thruster mk2');
pressKey('Enter'); // THRUSTER MK3 (500)
assert(game.unlocks.thruster === 2 && game.credits === 1950, 'bought thruster mk3');
pressKey('ArrowDown'); // fuel row
pressKey('Enter'); // FUEL TANK (120)
assert(game.unlocks.fuel === 1 && game.credits === 1830, 'bought fuel tank');
pressKey('ArrowDown'); // life row
const livesBefore = game.lives;
pressKey('Enter'); // EXTRA LIFE (100)
assert(game.lives === livesBefore + 1 && game.credits === 1730, 'bought extra life');
pressKey('Enter'); // second life should cost more (180)
assert(game.credits === 1550, 'life price escalates (180 for the second)');
assert(game.score === scoreBeforeShopping, 'buying upgrades never reduces score');

const levelBefore = game.level;
pressKey(' '); // launch
assert(game.state === 'flying' && game.level === levelBefore + 1, 'launch advances level');
assert(game.lives === livesBefore + 2, 'no free life on level advance');
assert(game.lander.bombs === 3, 'tier 2 grants a 3-pack of bombs');
assert(game.lander.fuel === 650, 'fuel capacity upgraded to 650');
assert(game.lander.shield === 1, 'shield charge granted on launch');
const { safeVY, thrustPower } = await importGame('state.js');
assert(Math.abs(safeVY() - 2.15) < 1e-9, 'landing gear raises safe descent speed to 2.15');
assert(Math.abs(thrustPower() - 0.111) < 1e-9, 'thruster upgrades raise thrust to 0.111');
{
  const p = JSON.parse(h.store.moonLanderProgress);
  assert(p.level === game.level && p.credits === game.credits
    && p.lives === game.lives && p.unlocks.weapon === game.unlocks.weapon,
    'progress persisted to localStorage');
}

// ESC exits the shop by launching — it does not open the menu there
{
  const { menu } = await importGame('menu.js');
  game.state = 'landed';
  runFrames(1);
  const lvl = game.level;
  pressKey('Escape');
  assert(game.state === 'flying' && game.level === lvl + 1 && !menu.open,
    'ESC leaves the shop by launching, without opening the menu');
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

// bombs always drop one per press — no volley mechanic
pressKey('b');
assert(game.lander.bombs === 2 && game.bombs.length === 1, 'one press drops exactly one bomb');

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

// pack sizes per weapon tier
{
  const { bombsPerAttempt } = await importGame('state.js');
  const weaponWas = game.unlocks.weapon;
  const packs = [0, 1, 2, 3, 4].map(w => { game.unlocks.weapon = w; return bombsPerAttempt(); });
  game.unlocks.weapon = weaponWas;
  assert(packs.join() === '0,1,3,3,6', 'bomb pack ladder 0→1→3→3→6, got ' + packs.join());
}

// super bombs — still one per press
game.unlocks.weapon = 4;
game.state = 'flying';
game.lander.bombs = 3;
game.bombs = []; // clear leftovers from the earlier drop
pressKey('b');
assert(game.bombs.length === 1 && game.bombs.every(b => b.super), 'super bombs flagged');

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

  // craters heal on retry: dying restores the level's original moonscape
  game.state = 'crashed';
  pressKey(' ');
  assert(terrainYAt(cx) === before, 'craters reset when the attempt restarts');
}

// blast bounties: a destroyed cannon pays 75 CR, a blasted asteroid 25 CR
{
  const { detonate } = await importGame('bombs.js');
  game.lander.x = 100;
  game.lander.y = 100; // keep the ship clear of the blasts
  const bx = game.W - 200, by = 300;
  game.cannons = [{ x: bx, y: by, type: 'gun', angle: 0, cooldown: 9999 }];
  game.asteroids = [];
  let credits = game.credits;
  detonate(bx, by, false);
  assert(game.credits === credits + 75 && game.cannons.length === 0, 'destroyed cannon pays 75 CR');
  game.asteroids.push({ x: bx, y: by, vx: 0, vy: 0, r: 12, rot: 0, vrot: 0, verts: Array(8).fill(1) });
  credits = game.credits;
  detonate(bx, by, false);
  assert(game.credits === credits + 25 && game.asteroids.length === 0, 'blasted asteroid pays 25 CR');

  // cannon shields: each blast strips one charge — no bounty until the kill
  game.cannons = [{ x: bx, y: by, type: 'gun', angle: 0, cooldown: 9999, shield: 2 }];
  credits = game.credits;
  detonate(bx, by, false);
  detonate(bx, by, false);
  assert(game.cannons.length === 1 && game.cannons[0].shield === 0 && game.credits === credits,
    'blasts strip cannon shields first, paying nothing');
  detonate(bx, by, false);
  assert(game.cannons.length === 0 && game.credits === credits + 75,
    'the unshielded blast kills and pays the bounty');
}

// past the MAX_CANNONS cap, unplaced cannons become randomly-sprinkled
// shield charges — the every-other-level cadence continues as shields
{
  const { placeCannons, cannonCount } = await importGame('cannons.js');
  const { genTerrain } = await importGame('terrain.js');
  const { MAX_CANNONS } = await importGame('config.js');
  const levelWas = game.level;
  const totalShields = () => game.cannons.reduce((s, c) => s + c.shield, 0);

  game.level = 30; // the cap (12) is passed from level 26 — shields visible here
  genTerrain();
  placeCannons();
  assert(game.cannons.length <= MAX_CANNONS, 'placement respects the cannon cap');
  assert(totalShields() === cannonCount() - game.cannons.length && totalShields() >= 3,
    'level 30 already fields shielded cannons (' + totalShields() + ' charges)');

  game.level = 80; // wants 40 — deep past the cap
  genTerrain();
  placeCannons();
  const wanted = cannonCount(), placed = game.cannons.length;
  assert(placed <= MAX_CANNONS && placed < wanted, 'level 80 caps placement (' + placed + '/' + wanted + ')');
  assert(totalShields() === wanted - placed, 'every unplaced cannon becomes one shield charge');

  game.level = levelWas;
  genTerrain();
  game.state = 'crashed';
  pressKey(' '); // fresh attempt on the restored level
  // placement is best-effort, so a tight terrain may still yield a charge
  // or two below the cap — but wanted defense is always conserved
  assert(totalShields() === cannonCount() - game.cannons.length,
    'wanted defense conserved at level ' + game.level);
}

// decoy pads: from level 25 three gray pads, one real, revealed on a timer
{
  const { genTerrain, padAt, padRevealDelay, padsRevealed } = await importGame('terrain.js');
  const levelWas = game.level;
  game.level = 30;
  genTerrain();
  game.state = 'crashed';
  pressKey(' '); // fresh attempt: age 0, real pad re-rolled
  assert(game.pads.length === 3 && game.pads.every(p => p.mult === 3),
    'three identical hard pads at level 30');
  assert(game.pads.filter(p => p.real).length === 1, 'exactly one pad is real');
  assert(padRevealDelay() === 375, 'reveal cooldown grows with level (375 frames at 30)');
  game.level = 999;
  assert(padRevealDelay() === 1200, 'reveal cooldown caps at 20s');
  game.level = 30;
  const real = game.pads.find(p => p.real);
  const decoy = game.pads.find(p => !p.real);
  const rcx = (real.x1 + real.x2) / 2, dcx = (decoy.x1 + decoy.x2) / 2;
  assert(!padsRevealed() && padAt(rcx) === null, 'no pad is landable before the reveal');
  game.lander.age = padRevealDelay();
  assert(padsRevealed() && padAt(rcx) === real && padAt(dcx) === null,
    'after the reveal only the real pad is landable');

  // touching a decoy is a crash like any other terrain
  const livesWas = game.lives;
  Object.assign(game.lander, { x: dcx, y: decoy.y - 40, vx: 0, vy: 0.5, angle: 0 });
  runFrames(120);
  assert(game.state === 'crashed' && game.lives === livesWas - 1, 'a decoy pad is not a landing');

  pressKey(' '); // retry: the scan restarts and the real pad re-rolls
  assert(!padsRevealed(), 'the scan cooldown restarts every attempt');
  const real2 = game.pads.find(p => p.real);
  Object.assign(game.lander, {
    x: (real2.x1 + real2.x2) / 2, y: real2.y - 40, vx: 0, vy: 0.5, angle: 0,
    age: padRevealDelay(),
  });
  runFrames(150);
  assert(game.state === 'landed', 'the revealed real pad still lands');
  assert(game.landingBreakdown.speed === 150, 'the speed-bonus clock starts at the reveal');

  game.level = levelWas;
  genTerrain();
  game.state = 'crashed';
  pressKey(' '); // back on the pre-decoy level for the rest of the run
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

// a qualifying game over opens three-letter name entry; the board persists
{
  const { entry } = await importGame('hiscores.js');
  assert(!entry.active && !('moonLanderHiscores' in h.store),
    'zero-score game overs never reach the board');
  game.score = 4200;
  game.lives = 1;
  game.state = 'flying';
  runFrames(900); // fall to the final crash
  assert(game.state === 'crashed' && game.lives === 0, 'hiscore run reaches game over');
  assert(entry.active, 'a top-10 score opens name entry');
  const diedAt = game.level;
  pressKey(' ');
  assert(game.state === 'crashed' && entry.active, 'SPACE cannot skip past name entry');
  pressKey('ArrowUp');   // A -> B
  pressKey('ArrowDown'); // back to A
  pressKey('a');         // type ACE directly; typing hops to the next slot
  pressKey('c');
  pressKey('e');
  pressKey('Enter');
  assert(!entry.active && entry.rank === 0, 'ENTER records the name at rank 1');
  const board = JSON.parse(h.store.moonLanderHiscores);
  assert(board.length === 1 && board[0].name === 'ACE'
    && board[0].level === diedAt && board[0].score === 4200, 'hiscore saved to localStorage');
  pressKey(' ');
  assert(game.state === 'flying' && game.score === 0, 'restart after entry resets the score');
  assert(JSON.parse(h.store.moonLanderHiscores).length === 1, 'hiscores survive the fresh run');

  // ranking: level reached beats raw score; empty runs never qualify
  const { recordHiscore, qualifies } = await importGame('hiscores.js');
  recordHiscore('LVL', diedAt + 5, 10);
  recordHiscore('LOW', diedAt, 100);
  assert(JSON.parse(h.store.moonLanderHiscores).map(e => e.name).join() === 'LVL,ACE,LOW',
    'board ranks by level, then score');
  assert(!qualifies(1, 0), 'a zero-score run never qualifies');
}

// long soak across states
for (let round = 0; round < 4; round++) {
  runFrames(400);
  if (game.state !== 'flying') pressKey(' ');
}
console.log('\nAll smoke tests passed. Final: state=' + game.state + ' level=' + game.level +
  ' lives=' + game.lives + ' credits=' + game.credits);
