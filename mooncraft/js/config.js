// Gameplay tuning constants.

export const VERSION = '1.38';

// fixed logical play area — scaled to fit the screen, letterboxed, same view everywhere.
// 2:1 splits the difference between phone screens (~19.5:9) and laptop browser
// viewports (wider than 16:9 once browser chrome takes its slice)
export const VIEW_W = 1440;
export const VIEW_H = 720;

export const GRAVITY = 0.018;
export const THRUST = 0.085;
export const THRUST_STEP = 0.013; // extra thrust per thruster upgrade (2 tiers)
export const ROT_SPEED = 0.055;

export const SAFE_VX = 1.3;
export const SAFE_VY = 1.8;
export const SAFE_ANGLE = 0.25; // radians from vertical

export const SPEED_BONUS_MAX = 150;   // landing credits for a lightning-fast touchdown…
export const SPEED_BONUS_DECAY = 10;  // …shrinking by this much per second of attempt time
export const LOOP_BONUS = 50;         // stunt credits for a full 360° mid-air loop

// touch throttle response: hover thrust is low (~25%), so the slider rests
// OFF in a bottom deadzone and responds steeply just above it
export const TOUCH_THRUST_DEADZONE = 0.15; // bottom fraction of the travel that stays OFF
export const TOUCH_THRUST_CURVE = 0.5;     // response exponent — <1 = most sensitive near the bottom
export const TOUCH_ROT_DEADZONE = 0.35;    // center fraction of the rotation pad (per side) that stays neutral

// decoy pads: from this level three identical hard pads spawn, all gray —
// only one is real, revealed after a scan cooldown, so a suicide burn can't
// dive at a known pad from frame one. Re-rolled every attempt.
export const DECOY_PADS_LEVEL = 25;
export const PAD_REVEAL_BASE = 300;  // frames ≈ 5 s at the first decoy level…
export const PAD_REVEAL_STEP = 15;   // …+0.25 s per level beyond it…
export const PAD_REVEAL_MAX = 1200;  // …capped at 20 s

export const START_FUEL = 500;
export const FUEL_TANK_STEP = 150; // extra capacity per fuel tank upgrade

// dry tank: vapor in the lines — reduced thrust from a small per-attempt
// impulse budget: enough Δv to flare one landing, drained in seconds if you
// try to fly on it
export const RESERVE_POWER = 0.5; // fraction of normal thrust when the tank is dry
export const RESERVE_BURN = 60;   // full-throttle frames of vapor per attempt
export const BOMB_PACKS = [0, 1, 3, 3, 6]; // bombs per attempt, by weapon tier
export const START_LIVES = 3;

export const SHIELD_COOLDOWN = 45;    // frames the shield flash lasts after an absorb (visual only)
export const SHIELD_RECHARGE_FRAMES = 240; // ≈4s to regain one charge; taking a hit restarts the timer
export const GEAR_VY_STEP = 0.35;     // extra safe descent speed per landing-gear tier
export const GEAR_ANGLE_STEP = 0.07;  // extra safe landing angle (rad) per tier

export const ASSIST_LEVEL_RATE = 0.012; // rad/frame — constant angular speed toward the assist target
export const ASSIST_RETRO_GAIN = 0.35;  // retro assist: target tilt per unit of vx
export const ASSIST_RETRO_MAX = 1.1;    // radians — max assist tilt (retro and landing)

// landing assist: aim thrust to steer onto the nearest pad
export const LAND_ASSIST_RATE = 0.03;        // rad/frame — the top tier gimbals faster than level/retro
export const LAND_ASSIST_KP = 0.05;          // velocity-error correction gain
export const LAND_ASSIST_DRIFT = 0.02;       // desired drift per px of horizontal offset…
export const LAND_ASSIST_DRIFT_MAX = 2.0;    // …capped at this approach speed
export const LAND_ASSIST_DESCENT = 0.004;    // desired descent per px of height above the pad…
export const LAND_ASSIST_DESCENT_MIN = 0.3;  // …between a soft floor near touchdown
export const LAND_ASSIST_DESCENT_MAX = 1.4;  // …and a brisk ceiling when high up

export const MAX_CANNONS = 12; // placement cap — the wanted count keeps growing and the excess becomes cannon shields
export const FIRE_INTERVAL = 150;      // frames between shots per cannon at low levels…
export const FIRE_INTERVAL_MIN = 70;   // …shrinking to this floor at high levels
export const FIRE_INTERVAL_STEP = 3;   // frames of cooldown lost per level past the first cannon
export const SLUG_SPEED = 1.7;
export const SLUG_SPEED_STEP = 0.15;      // extra slug speed per additional cannon
export const SLUG_SPEED_MAX = 4.6;        // ≈ where terrain caps cannon placement (~level 40)
export const SLUG_HIT_RADIUS = 15;

export const LASER_AIM_TIME = 90;         // frames ≈ 1500 ms — telegraph at low levels…
export const LASER_AIM_MIN = 42;          // …shrinking to ≈ 700 ms at high levels
export const LASER_AIM_STEP = 3;          // frames of telegraph lost per level past the first laser
export const LASER_BEAM_TIME = 12;        // frames ≈ 200 ms — live beam duration
export const LASER_HIT_RADIUS = 12;

export const ASTEROID_LEVELS = [6, 11, 16, 21, 25]; // wave size grows by one at each
export const ASTEROID_GRAVITY = 0.4;   // fraction of ship gravity — asteroids fall floatier

// sound: gain time-constants (seconds) for setTargetAtTime smoothing
export const THRUST_FADE_IN = 0.03;  // thruster fade-in when the burn rises…
export const THRUST_FADE_OUT = 0.12; // …and the slower fade-out when it dies
export const VOLUME_SMOOTH = 0.05;   // volume-slider smoothing (no zipper clicks)
export const THRUST_VOL = 1.0;       // thruster loop gain — loudness is baked into the sample (−11.5 LUFS, peaks −1 dB)
export const THRUST_VOL_CURVE = 0.6; // throttle→gain exponent — partial burns (hover ≈ 25%) stay clearly audible
export const MUSIC_TRIM = 0.5;       // music bus trim — at equal sliders the music sits under the SFX, not over them

export const BOMB_EJECT = 2.2;    // ejection speed along the ship's down-axis
export const BOMB_RECOIL = 1.6;   // Newton: equal-and-opposite kick on the ship
export const BLAST_RADIUS = 55;
export const SUPER_BLAST_RADIUS = 130;
export const CANNON_BOUNTY = 75;   // credits for a cannon destroyed by a blast
export const ASTEROID_BOUNTY = 25; // credits for an asteroid destroyed by a blast
