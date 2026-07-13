// Cheat-param check: boot with ?cheat=god, verify maxed loadout,
// invulnerability, and that no progress is ever saved.
import { setup, assert, importGame } from './harness.mjs';

const h = setup({ search: '?cheat=god&level=25' });

await importGame('main.js');
const { game } = await importGame('state.js');

assert(game.unlocks.weapon === 4 && game.unlocks.assist === 3 && game.unlocks.nav === 1
  && game.unlocks.fuel === 3 && game.unlocks.shield === 3 && game.unlocks.gear === 3
  && game.unlocks.thruster === 2, 'god: all unlocks maxed');
assert(game.lives === 99, 'god: 99 lives');
assert(game.credits >= 9999, 'god: credits pile');
assert(game.level === 25, 'cheat combines with ?level=');

// free-fall through a level-25 barrage: god mode must never crash
// (bouncing to an eventual legitimate landing is fine)
h.runFrames(2000);
assert(game.state !== 'crashed', 'god: never crashes across 2000 frames (state=' + game.state + ')');
assert(game.lives === 99, 'god: no lives lost');
assert(!('moonLanderProgress' in h.store), 'cheated run never writes the save');
console.log('Cheat checks OK.');
