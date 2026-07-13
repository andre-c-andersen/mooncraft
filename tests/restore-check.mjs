// Restore-path check: boot the game fresh (no ?level param) with a saved
// progress blob already in localStorage and assert the run is resumed.
import { setup, assert, importGame } from './harness.mjs';

const expected = {
  credits: 700,
  level: 21,
  lives: 4,
  unlocks: { weapon: 2, assist: 2, nav: 1, shield: 1, gear: 1, thruster: 1, fuel: 1, livesBought: 2 },
  assistOn: false,
};

const h = setup({ search: '' }); // no debug override — must resume from the save
h.store.moonLanderProgress = JSON.stringify(expected);

await importGame('main.js');
const { game } = await importGame('state.js');

assert(game.level === expected.level, 'level restored: ' + game.level);
assert(game.credits === expected.credits, 'credits restored: ' + game.credits);
assert(game.lives === expected.lives, 'lives restored: ' + game.lives);
assert(game.unlocks.weapon === expected.unlocks.weapon
  && game.unlocks.assist === expected.unlocks.assist
  && game.unlocks.nav === expected.unlocks.nav
  && game.unlocks.shield === expected.unlocks.shield
  && game.unlocks.gear === expected.unlocks.gear
  && game.unlocks.thruster === expected.unlocks.thruster
  && game.unlocks.fuel === expected.unlocks.fuel
  && game.unlocks.livesBought === expected.unlocks.livesBought, 'unlocks restored');
console.log('Restore path OK.');
