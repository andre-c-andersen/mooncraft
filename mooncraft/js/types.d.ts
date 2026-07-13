// Ambient entity shapes for type-checking the plain-JS modules
// (tsc --noEmit with checkJs; see tsconfig.json). Not imported anywhere —
// these names are global in JSDoc annotations.

interface Lander {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  fuel: number;
  thrusting: boolean;
  thrustAmt: number;
  bombs: number;
  shield: number;
  shieldCooldown: number;
  shieldRegen: number;
  age: number;
  loopAcc: number;
}

interface Pad {
  x1: number; x2: number; y: number;
  mult: number;
  color: string;
  real?: boolean; // decoy era: only the real pad is landable
}

interface Cannon {
  x: number; y: number;
  angle: number;
  cooldown: number;
  shield: number;
  type: 'gun' | 'laser';
  phase: 'idle' | 'aim' | 'beam';
  timer: number;
  aimTotal: number;
  beamAngle: number;
  beamHit: boolean;
}

interface Slug { x: number; y: number; vx: number; vy: number; life: number; }

interface Bomb { x: number; y: number; vx: number; vy: number; super: boolean; }

interface Boom { x: number; y: number; r: number; max: number; color?: string; }

interface Asteroid {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  rot: number; vrot: number;
  verts: number[];
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  color: string;
  text?: string; // floating bonus text instead of a pixel
}

interface Star { x: number; y: number; r: number; }

interface TerrainPoint { x: number; y: number; }

interface Unlocks {
  weapon: number;
  assist: number;
  nav: number;
  shield: number;
  gear: number;
  thruster: number;
  fuel: number;
  livesBought: number;
}

interface LandingBreakdown { pad: number; fuel: number; speed: number; }

interface HiscoreEntry { name: string; level: number; score: number; }

interface ShopRow {
  id: string;
  label: string;
  price: number | null;
  maxed?: boolean;
}

interface Game {
  W: number; H: number;
  startLevel: number;
  terrain: TerrainPoint[];
  pads: Pad[];
  stars: Star[];
  lander: Lander | null;
  particles: Particle[];
  cannons: Cannon[];
  slugs: Slug[];
  bombs: Bomb[];
  booms: Boom[];
  asteroids: Asteroid[];
  state: 'flying' | 'landed' | 'crashed';
  credits: number;
  score: number;
  level: number;
  lives: number;
  unlocks: Unlocks;
  assistOn: boolean;
  assistActive: boolean;
  lifeAwarded: boolean;
  landingBreakdown: LandingBreakdown | null;
}
