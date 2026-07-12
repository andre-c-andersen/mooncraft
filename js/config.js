// Gameplay tuning constants.

export const GRAVITY = 0.018;
export const THRUST = 0.085;
export const ROT_SPEED = 0.055;

export const SAFE_VX = 1.3;
export const SAFE_VY = 1.8;
export const SAFE_ANGLE = 0.25; // radians from vertical

export const START_FUEL = 500;
export const FUEL_TANK_STEP = 150; // extra capacity per fuel tank upgrade
export const START_BOMBS = 3;
export const START_LIVES = 3;

export const ASSIST_LEVEL_RATE = 0.015; // rad/frame — constant angular speed toward the assist target
export const ASSIST_RETRO_GAIN = 0.35;  // retro assist: target tilt per unit of vx
export const ASSIST_RETRO_MAX = 1.1;    // radians — max retro tilt
export const ASSIST_TAP_FRAMES = 18;    // press shorter than this (~300 ms) toggles assist; longer = hold

export const FIRE_INTERVAL = 150;  // frames between shots per cannon
export const SLUG_SPEED = 1.7;
export const SLUG_SPEED_STEP = 0.15;      // extra slug speed per additional cannon
export const SLUG_HIT_RADIUS = 15;
export const CANNON_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // one cannon unlocks at each (max 10)

export const LASER_AIM_TIME = 90;         // frames ≈ 1500 ms — thin aiming line before firing
export const LASER_BEAM_TIME = 12;        // frames ≈ 200 ms — live beam duration
export const LASER_HIT_RADIUS = 12;

export const BOMB_EJECT = 2.2;    // ejection speed along the ship's down-axis
export const BOMB_RECOIL = 1.6;   // Newton: equal-and-opposite kick on the ship
export const BLAST_RADIUS = 55;
export const SUPER_BLAST_RADIUS = 95;
export const TRIPLE_SPREAD = 0.28; // radians between bombs in a triple volley
