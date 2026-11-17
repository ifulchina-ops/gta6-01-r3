// Traffic: the cars that make the streets feel alive. Each one picks a road,
// a lane and a direction, drives it, turns at intersections, and keeps a
// polite distance from the car ahead. Five civilian types — sedan, sports
// car, taxi, box truck, street bike — plus parked cars waiting to be stolen.
// Cop cars are traffic too, but police.js drives them.

import { VEHICLES, clamp, angleDiff } from './config.js';
import { ROAD_V, ROAD_H, hitBuilding, isWater, nearestRoadPoint } from './city.js';

const CIVILIAN = ['sedan', 'sedan', 'sedan', 'sports', 'taxi', 'taxi', 'truck', 'bike'];
const PAINT = ['#4a7fc1', '#c25a3a', '#4a9a5a', '#d9a03a', '#7a5ac2', '#c2c2c2', '#3a3f4a', '#e86a8a'];

export function makeCar(game, x, y, body) {
  const spec = VEHICLES[body];
  return {
    x, y, body, angle: 0, speed: 0, hp: spec.hp,
    color: game.random.pick(PAINT),
    driver: null, parked: false, owned: false, wrecked: false,
    axis: 'x', dir: 1, cruise: game.random.range(0.5, 0.85) * spec.speed,
    turnAt: 0, brake: 0,
  };
}

/** Spawn a car on a road near (x, y), or anywhere on the grid when omitted. */
export function spawnTrafficCar(game, x, y, body) {
  const spot = (x === undefined)
    ? nearestRoadPoint(game.random, game.random.range(200, game.city.w - 200), game.random.range(200, game.city.h - 200))
    : { x, y };
  const car = makeCar(game, spot.x, spot.y, body || game.random.pick(CIVILIAN));
  if (game.random.chance(0.5)) {
    car.axis = 'y';
    car.angle = game.random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.axis = 'x';
    car.angle = game.random.chance(0.5) ? 0 : Math.PI;
  }
  car.dir = 1;
  car.speed = car.cruise * 0.6;
  car.parked = game.random.chance(0.22);
  if (car.parked) car.speed = 0;
  // Nudge onto the correct lane so cars do not sit on the centre line.
  const lane = 22;
  if (car.axis === 'x') car.y += (car.angle === 0 ? lane : -lane);
  else car.x += (car.angle === Math.PI / 2 ? -lane : lane);
  game.cars.push(car);
  return car;
}

function nearestRoadAhead(car) {
  // Distance to the next intersection along the car's axis.
  if (car.axis === 'x') {
    let best = Infinity;
    for (const ry of ROAD_H) {
      const d = Math.abs(car.y - ry);
      if (d < best) best = d;
    }
    return best;
  }
  let best = Infinity;
  for (const rx of ROAD_V) {
    const d = Math.abs(car.x - rx);
    if (d < best) best = d;
  }
  return best;
}

function maybeTurn(game, car, dt) {
  if (car.parked || car.driver) return;
  car.turnAt -= dt;
  const nearCross = nearestRoadAhead(car) < 46;
  if (nearCross && car.turnAt <= 0 && game.random.chance(0.35)) {
    car.turnAt = 2.5;
    if (car.axis === 'x') {
      car.axis = 'y';
      car.angle = game.random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'x';
      car.angle = game.random.chance(0.5) ? 0 : Math.PI;
    }
  }
}

function carAhead(game, car) {
  let best = null;
  let bestD = 90;
  for (const other of game.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
    const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
    if (forward > 0 && forward < bestD && side < 26) { bestD = forward; best = other; }
  }
  return best;
}

export function stepTraffic(game, dt) {
  const player = game.player;
  for (const car of game.cars) {
    if (car.driver === 'player' || car.wrecked) continue;
    if (car.parked) continue;
    maybeTurn(game, car, dt);
    // Ease toward cruise speed, brake for the car ahead.
    const ahead = carAhead(game, car);
    const target = ahead ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, 1.4 * dt);
    // Steer gently back onto the lane centre.
    const lane = 22;
    let wantAngle = car.angle;
    if (car.axis === 'x') {
      const roadY = ROAD_H.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      const laneY = roadY + (car.angle === 0 ? lane : -lane);
      wantAngle = car.angle === 0 ? Math.atan2(laneY - car.y, 100) : Math.PI - Math.atan2(laneY - car.y, 100);
    } else {
      const roadX = ROAD_V.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      const laneX = roadX + (car.angle === Math.PI / 2 ? -lane : lane);
      wantAngle = car.angle === Math.PI / 2
        ? Math.PI / 2 - Math.atan2(laneX - car.x, 100)
        : -Math.PI / 2 + Math.atan2(laneX - car.x, 100);
    }
    car.angle += clamp(angleDiff(car.angle, wantAngle), -1.4 * dt, 1.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (hitBuilding(game.city, car.x, car.y, 18) || isWater(car.x, car.y)) {
      car.x -= Math.cos(car.angle) * car.speed * dt;
      car.y -= Math.sin(car.angle) * car.speed * dt;
      car.speed = 0;
      car.angle += Math.PI / 2;
    }
    // Keep the streets full: respawn cars that wander too far from the player.
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d > 1600) {
      const spot = nearestRoadPoint(game.random, player.x + game.random.range(-700, 700), player.y + game.random.range(-700, 700));
      car.x = spot.x;
      car.y = spot.y;
      car.speed = car.cruise * 0.5;
    }
  }
  // Prune wrecks the player left behind, keep the list bounded.
  if (game.cars.length > 46) {
    game.cars = game.cars.filter((c) => c.driver === 'player' || c.owned || !c.wrecked).slice(0, 46);
  }
}
