// Solara Bay, the city itself: five districts on one road grid, a beach and
// a bay on the west edge, a working port in the south. Buildings carry
// windows, rooftops and neon signs so the streets read as a place, not a
// grid of blocks. Also answers the two questions the simulation keeps
// asking: "is this point on a road?" and "does this circle hit a building?"

import { WORLD_W, WORLD_H } from './config.js';

/** Vertical road centre-lines, and horizontal ones. Roads are 92 wide. */
export const ROAD_V = [300, 750, 1200, 1650, 2100, 2550, 3000];
export const ROAD_H = [250, 650, 1050, 1450, 1850, 2250];
export const ROAD_W = 92;

const DISTRICT_COLORS = {
  downtown: ['#5a6b8a', '#6b5a8a', '#8a6b5a', '#4a7a8a', '#7a5a6b'],
  beach: ['#e8b48a', '#d9a06a', '#c98f7a', '#e8c98a'],
  plaza: ['#8a7a5a', '#7a8a5a', '#9a8a6a'],
  port: ['#6a7a72', '#7a6a5a', '#5a6a7a'],
  suburb: ['#c98a6a', '#b07a8a', '#8aa06a', '#d9b06a'],
};

const SIGNS = ['HOTEL', '24H', 'PIZZA', 'TACOS', 'BANK', 'CLUB', 'GYM', 'BAR', 'MALL', 'CINE', 'Diner', 'MOTEL'];

function districtAt(x, y) {
  if (x < 220) return 'beach';
  if (y > 2100) return 'port';
  if (x > 2350 && y < 900) return 'downtown';
  if (x > 1400 && x < 1900 && y > 800 && y < 1300) return 'plaza';
  if (x > 2600) return 'suburb';
  if (y < 500 && x > 1900) return 'downtown';
  return 'plaza';
}

export function createCity(random) {
  const buildings = [];
  const palms = [];
  const props = [];
  const containers = [];

  // Buildings fill every block between two roads, with a margin for sidewalk.
  for (let vi = 0; vi < ROAD_V.length - 1; vi += 1) {
    for (let hi = 0; hi < ROAD_H.length - 1; hi += 1) {
      const x0 = ROAD_V[vi] + ROAD_W / 2 + 14;
      const x1 = ROAD_V[vi + 1] - ROAD_W / 2 - 14;
      const y0 = ROAD_H[hi] + ROAD_W / 2 + 14;
      const y1 = ROAD_H[hi + 1] - ROAD_W / 2 - 14;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      // The plaza block stays open: fountain, benches, palms.
      if (district === 'plaza' && x0 > 1400 && x0 < 1900 && y0 > 800 && y0 < 1300) {
        props.push({ kind: 'fountain', x: 1875, y: 1250, r: 46 });
        for (let b = 0; b < 6; b += 1) {
          props.push({ kind: 'bench', x: 1760 + b * 46, y: 1150, r: 10 });
        }
        for (let p = 0; p < 10; p += 1) {
          palms.push({ x: 1740 + random.range(0, 270), y: 1140 + random.range(0, 220), s: random.range(0.8, 1.2) });
        }
        continue;
      }
      // One or two buildings per block, sized to the block.
      const count = random.chance(0.45) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const bw = count === 1 ? x1 - x0 - 20 : (x1 - x0) / 2 - 26;
        const bh = count === 1 ? y1 - y0 - 20 : y1 - y0 - 20;
        const bx = count === 1 ? x0 + 10 : x0 + 10 + b * ((x1 - x0) / 2 + 6);
        const by = y0 + 10;
        if (bw < 60 || bh < 60) continue;
        const tall = district === 'downtown' && random.chance(0.6);
        const colors = DISTRICT_COLORS[district];
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          floors: tall ? random.int(9) + 6 : random.int(3) + 1,
          color: random.pick(colors),
          roof: random.pick(['#3a3f4a', '#4a3f3a', '#2c3038', '#5a4a3a']),
          sign: random.chance(0.4) ? random.pick(SIGNS) : '',
          signColor: random.pick(['#ff5a5a', '#39c2d7', '#ffd23f', '#7dff8a', '#ff9de2']),
          windowsLit: random.next(),
          district,
        });
      }
      // Street palms along the block edges, denser near the beach.
      const palmCount = district === 'beach' ? 5 : random.int(3);
      for (let p = 0; p < palmCount; p += 1) {
        palms.push({
          x: x0 + random.range(0, x1 - x0),
          y: random.chance(0.5) ? y0 - 8 : y1 + 8,
          s: random.range(0.8, 1.3),
        });
      }
    }
  }

  // Beach strip: sand, umbrellas, towels, a boardwalk of palms.
  for (let i = 0; i < 14; i += 1) {
    const y = 140 + i * 170 + random.range(-30, 30);
    props.push({ kind: 'umbrella', x: 130 + random.range(-20, 30), y, color: random.pick(['#ff5a5a', '#ffd23f', '#39c2d7', '#ff9de2']) });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: 205 + random.range(-8, 8), y: 120 + i * 95 + random.range(-20, 20), s: random.range(0.9, 1.4) });
  }

  // Port: stacked containers and cranes along the south docks.
  for (let i = 0; i < 18; i += 1) {
    containers.push({
      x: 2150 + (i % 6) * 130 + random.range(-8, 8),
      y: 2320 + Math.floor(i / 6) * 70,
      w: 110, h: 52,
      color: random.pick(['#c25a3a', '#3a7fc2', '#4a9a5a', '#d9a03a', '#7a5ac2']),
    });
  }
  props.push({ kind: 'crane', x: 2350, y: 2450 });
  props.push({ kind: 'crane', x: 2750, y: 2450 });

  const city = {
    w: WORLD_W, h: WORLD_H,
    buildings, palms, props, containers,
    landmarks: {
      plaza: { x: 1650, y: 1050 },
      bank: { x: 1500, y: 800 },
      hospital: { x: 600, y: 1900 },
      port: { x: 2400, y: 2380 },
      safehouse: { x: 2850, y: 420 },
      garage: { x: 2250, y: 700 },
      docks: { x: 2400, y: 2150 },
      boardwalk: { x: 260, y: 1450 },
      motel: { x: 2900, y: 1650 },
    },
  };
  return city;
}

export function landmarkPos(city, name) {
  return city.landmarks[name] || city.landmarks.plaza;
}

export function isRoad(x, y) {
  for (const rx of ROAD_V) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_H) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function isWater(x, y) {
  return x < 96;
}

export function isSand(x, y) {
  return x >= 96 && x < 230;
}

/** Nearest road centre-line point, for spawning cars and pedestrians on streets. */
export function nearestRoadPoint(random, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROAD_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

/** Circle-vs-building test; returns the building hit, or null. */
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const c of city.containers) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
  }
  return null;
}

/** Push a circle out of any building it overlaps. Returns true when pushed. */
export function resolveBuilding(city, p, r) {
  const b = hitBuilding(city, p.x, p.y, r);
  if (!b) return false;
  const overlapL = p.x + r - b.x;
  const overlapR = b.x + b.w - (p.x - r);
  const overlapT = p.y + r - b.y;
  const overlapB = b.y + b.h - (p.y - r);
  const m = Math.min(overlapL, overlapR, overlapT, overlapB);
  if (m === overlapL) p.x = b.x - r;
  else if (m === overlapR) p.x = b.x + b.w + r;
  else if (m === overlapT) p.y = b.y - r;
  else p.y = b.y + b.h + r;
  return true;
}
