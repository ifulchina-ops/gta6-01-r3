// Solara Bay: Heat Rising — shared constants for the whole game.
// One place for the numbers every system agrees on: the world size, the
// step the simulation runs at, the sun-soaked palette, and the small math
// helpers the modules share. Nothing here touches the DOM or the canvas.

export const STEP = 1 / 60;

/** World size in world units. The city is bigger than the screen on purpose. */
export const WORLD_W = 3400;
export const WORLD_H = 2600;

/** Sun direction: late-afternoon sun from the south-west, so shadows fall long to the north-east. */
export const SUN = { x: 0.55, y: -0.8 };

/** Long-shadow offset applied to buildings, cars, palms and people. */
export const SHADOW = { x: 16, y: 22 };

/** Palette: sun-soaked Solara Bay — warm sand, teal water, hot asphalt. */
export const PALETTE = {
  grass: '#7fae5a',
  grassDry: '#a8b96a',
  sand: '#eed9a4',
  water: '#2e9db4',
  waterDeep: '#1d7f9c',
  asphalt: '#3a3f4a',
  asphaltEdge: '#2c3038',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  plaza: '#cbb98f',
  block: '#8fae62',
};

/** Vehicle types. speed is top speed in world units per second. */
export const VEHICLES = {
  sedan: { name: 'Sedan', speed: 340, accel: 260, turn: 2.6, hp: 100, color: '#4a7fc1' },
  sports: { name: 'Comet GT', speed: 520, accel: 420, turn: 3.4, hp: 80, color: '#d83a2e' },
  taxi: { name: 'Taxi', speed: 350, accel: 270, turn: 2.7, hp: 100, color: '#f2c200' },
  truck: { name: 'Box Truck', speed: 260, accel: 170, turn: 2.0, hp: 220, color: '#7a8894' },
  bike: { name: 'Street Bike', speed: 470, accel: 480, turn: 4.2, hp: 50, color: '#22242c' },
  cop: { name: 'Interceptor', speed: 470, accel: 380, turn: 3.2, hp: 120, color: '#1c2733' },
};

/** Radio stations: name, colour for the HUD chip, and a mood for the music engine. */
export const STATIONS = [
  { name: 'SOLARA FM', genre: 'sunset pop', color: '#ff7a59', bpm: 96 },
  { name: 'BAY 98.5', genre: 'westside rap', color: '#39c2d7', bpm: 88 },
  { name: 'WAVE 101', genre: 'synth drive', color: '#b388ff', bpm: 116 },
];

/** Wanted stars: how many cop cars and foot officers each level fields. */
export const WANTED_TABLE = [
  { cars: 0, officers: 0 },
  { cars: 1, officers: 1 },
  { cars: 2, officers: 2 },
  { cars: 3, officers: 2 },
  { cars: 4, officers: 3 },
  { cars: 5, officers: 4 },
];

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle a toward angle b. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Pick a point on a circle of radius r around (x, y). */
export function ringPoint(random, x, y, r) {
  const a = random.next() * Math.PI * 2;
  return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
}
