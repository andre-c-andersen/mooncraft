// Sound: looping background music + a thruster loop that follows the burn.
//
// Everything runs through Web Audio (HTMLAudio volume is ignored on iOS):
// music → musicGain, thrusters → thrustGain → sfxGain, both into the
// destination. The thruster loop plays continuously at gain 0 and the gain
// chases the actual burn level each frame — full for keyboard thrust, partial
// for an analog trigger or touch slider — with a fast attack and a slower
// release so hard on/off keying still fades.
//
// Browsers only let an AudioContext start inside a user gesture, so the
// module arms unlock listeners and stays a silent no-op until the first
// key / tap / click — and forever in the headless tests, which have no
// AudioContext at all.

import { settings } from './settings.js';
import {
  THRUST_FADE_IN, THRUST_FADE_OUT, VOLUME_SMOOTH,
  THRUST_VOL, THRUST_VOL_CURVE, MUSIC_TRIM,
} from './config.js';

// observable mirror of the audio state (tests, debugging); sfx counts every
// one-shot request by name, even headless
export const audio = { running: false, thrust: 0, sfx: {} };

const AC = window.AudioContext || window['webkitAudioContext'];

let actx = null;
let musicGain = null, sfxGain = null, thrustGain = null;

// fetch + decode, and find the first/last audible samples — trims encoded
// silence and MP3 decoder padding at the edges
async function loadBuffer(url) {
  const res = await fetch(url);
  const buf = await actx.decodeAudioData(await res.arrayBuffer());
  const d = buf.getChannelData(0);
  let s = 0, e = buf.length;
  while (s < e && Math.abs(d[s]) < 1e-3) s++;
  while (e > s && Math.abs(d[e - 1]) < 1e-3) e--;
  return { buf, start: s / buf.sampleRate, end: e / buf.sampleRate };
}

// an endless loop; the trimmed loop points make the seam seamless
async function startLoop(url, dest) {
  const { buf, start, end } = await loadBuffer(url);
  const src = actx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = start;
  src.loopEnd = end;
  src.connect(dest);
  src.start(0, start);
}

// one-shot effects, decoded once at unlock; gain trims a sound within the
// mix (1 = as mastered) without touching the file
const SFX_DEFS = {
  laserCharge: { url: 'sounds/laser-charge.mp3', gain: 0.4 }, // sustained + frequent — sits under the zap
  laserFire: { url: 'sounds/laser-fire.mp3', gain: 0.45 },
  cannonFire: { url: 'sounds/cannon-fire.mp3', gain: 1 },
  shipCrash: { url: 'sounds/ship-crash.mp3', gain: 1 },
  shieldHit: { url: 'sounds/shield-hit.mp3', gain: 1 },
  bombRelease: { url: 'sounds/bomb-release.mp3', gain: 0.6 }, // mechanical clunk — under the combat sounds
  bombExplosion: { url: 'sounds/bomb-explosion.mp3', gain: 0.8 }, // every blast — supers full, regulars trimmed per call
};
const sfx = {};

// play a one-shot through the SFX bus. opts.fit stretches playback to that
// many seconds by re-pitching — the laser-charge whine rises faster when the
// telegraph is short. opts.jitter randomly detunes by up to ±jitter/2 so a
// sample repeated in quick succession doesn't sound machine-stamped.
// opts.gain scales this play on top of the sound's table gain
export function playSfx(name, opts = {}) {
  audio.sfx[name] = (audio.sfx[name] || 0) + 1;
  const snd = sfx[name];
  if (!snd || !actx || actx.state !== 'running') return;
  const src = actx.createBufferSource();
  src.buffer = snd.buf;
  const dur = snd.end - snd.start;
  if (opts.fit) src.playbackRate.value = Math.min(3, Math.max(0.5, dur / opts.fit));
  else if (opts.jitter) src.playbackRate.value = 1 + (Math.random() - 0.5) * opts.jitter;
  const trim = actx.createGain();
  trim.gain.value = SFX_DEFS[name].gain * (opts.gain ?? 1);
  trim.connect(sfxGain);
  src.connect(trim);
  src.start(0, snd.start, dur);
}

// safe to call from anywhere, any number of times: creates the context on
// the first user gesture, resumes it if a later gesture finds it suspended
export function unlockAudio() {
  if (!AC) return;
  if (actx) {
    if (actx.state === 'suspended' && !document.hidden) actx.resume().catch(() => {});
    return;
  }
  actx = new AC();
  // iOS: route as playback so the ringer mute switch doesn't silence the game
  try { navigator['audioSession'].type = 'playback'; } catch (e) {}

  musicGain = actx.createGain();
  musicGain.gain.value = settings.musicVol * MUSIC_TRIM;
  musicGain.connect(actx.destination);
  sfxGain = actx.createGain();
  sfxGain.gain.value = settings.sfxVol;
  sfxGain.connect(actx.destination);
  thrustGain = actx.createGain();
  thrustGain.gain.value = 0;
  thrustGain.connect(sfxGain);

  startLoop('sounds/music.mp3', musicGain).catch(() => {});
  startLoop('sounds/thrusters.mp3', thrustGain).catch(() => {});
  for (const [name, def] of Object.entries(SFX_DEFS))
    loadBuffer(def.url).then(b => { sfx[name] = b; }).catch(() => {});

  // a hidden tab keeps Web Audio playing — silence the game instead
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) actx.suspend().catch(() => {});
    else actx.resume().catch(() => {});
  });
  audio.running = true;
}

for (const ev of ['pointerdown', 'keydown', 'touchstart'])
  window.addEventListener(ev, unlockAudio, { passive: true });

// called once per 60 Hz sim step with the audible burn level (0..1):
// retargets the volume gains (live menu sliders) and chases the burn
export function audioFrame(burn) {
  audio.thrust = burn;
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  musicGain.gain.setTargetAtTime(settings.musicVol * MUSIC_TRIM, t, VOLUME_SMOOTH);
  sfxGain.gain.setTargetAtTime(settings.sfxVol, t, VOLUME_SMOOTH);
  const target = Math.pow(burn, THRUST_VOL_CURVE) * THRUST_VOL;
  thrustGain.gain.setTargetAtTime(target, t,
    target > thrustGain.gain.value ? THRUST_FADE_IN : THRUST_FADE_OUT);
}
