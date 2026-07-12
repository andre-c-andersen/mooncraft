// Keyboard input: held-key state plus one-shot actions.

import { game } from '../state.js';
import { menu, menuMove, menuAdjust, menuActivate } from '../menu.js';
import { dropBomb } from '../bombs.js';
import { advance } from '../game.js';
import { shopMove, shopActivate } from '../shop.js';

export const keys = {};

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { menu.open = !menu.open; return; }
  if (menu.open) {
    if (e.key === 'ArrowUp') menuMove(-1);
    else if (e.key === 'ArrowDown') menuMove(1);
    else if (e.key === 'ArrowLeft') menuAdjust(-1);
    else if (e.key === 'ArrowRight') menuAdjust(1);
    else if (e.key === 'Enter' || e.key === ' ') menuActivate();
    e.preventDefault();
    return;
  }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d','b','f'].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if ((e.key === 'b' || e.key === 's' || e.key === 'ArrowDown') && !e.repeat) dropBomb();
  if (e.key === 'f' && !e.repeat && game.unlocks.assist >= 1) game.assistOn = !game.assistOn;
  if (game.state === 'landed') {
    // shop is open: navigate, buy, or launch
    if (e.key === 'ArrowUp') shopMove(-1);
    else if (e.key === 'ArrowDown') shopMove(1);
    else if (e.key === 'Enter') shopActivate();
    else if (e.key === ' ') advance();
    return;
  }
  if (game.state === 'crashed' && (e.key === ' ' || e.key === 'Enter')) {
    advance();
  }
});

window.addEventListener('keyup', e => { keys[e.key] = false; });
