// Gamepad input (Xbox 360 / standard mapping): polling + edge detection.

import { settings } from '../settings.js';

export const gamepad = { connected: false };

let prevBtns = {};

window.addEventListener('gamepadconnected', () => { gamepad.connected = true; });
window.addEventListener('gamepaddisconnected', () => { gamepad.connected = false; });

function poll() {
  const gp = (navigator.getGamepads ? navigator.getGamepads() : [])
    .find(g => g && g.connected);
  if (!gp) { gamepad.connected = false; return null; }
  gamepad.connected = true;

  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  return {
    stickX: gp.axes[0] || 0,
    stickY: gp.axes[1] || 0,
    dpadUp: b(12), dpadDown: b(13), dpadLeft: b(14), dpadRight: b(15),
    a: b(0), bBtn: b(1), xBtn: b(2), lb: b(4), back: b(8), start: b(9),
    // A = full power; trigger is analog, rescaled so threshold..full-pull maps to 0..1
    thrustAmt: b(0) ? 1 : (() => {
      const v = gp.buttons[7] ? gp.buttons[7].value : 0;
      return v > settings.trigThresh ? (v - settings.trigThresh) / (1 - settings.trigThresh) : 0;
    })(),
  };
}

// call once per frame: returns the pad state plus buttons that went down this frame
export function readGamepad() {
  const pad = poll();
  const edge = {};
  if (pad) {
    const cur = {
      navUp: pad.dpadUp || pad.stickY < -0.5,
      navDown: pad.dpadDown || pad.stickY > 0.5,
      navLeft: pad.dpadLeft || pad.stickX < -0.5,
      navRight: pad.dpadRight || pad.stickX > 0.5,
      a: pad.a, bBtn: pad.bBtn, xBtn: pad.xBtn, lb: pad.lb,
      back: pad.back, start: pad.start,
    };
    for (const k in cur) edge[k] = cur[k] && !prevBtns[k];
    prevBtns = cur;
  } else {
    prevBtns = {};
  }
  return { pad, edge };
}
