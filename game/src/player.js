// The player: Rico, on foot or behind the wheel. On foot he walks, runs
// with shift held, and aims where the mouse points. In a car the same keys
// drive it, and the car takes the damage instead of him. Stealing is free —
// the wanted system is what makes it cost something.

import { STEP, clamp, angleDiff, VEHICLES } from './config.js';
import { hitBuilding, isWater, resolveBuilding } from './city.js';

const WALK_SPEED = 190;
const RUN_SPEED = 290;

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: 100, ammo: 48, car: null, moving: false, running: false,
    invuln: 0, punchTimer: 0,
  };
}

/** The nearest car within range, for the E key. Parked cars count too. */
export function nearestCar(game, range) {
  let best = null;
  let bestD = range;
  for (const car of game.cars) {
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(game, car) {
  const p = game.player;
  p.car = car;
  car.driver = 'player';
  car.parked = false;
  car.owned = true;
  p.x = car.x;
  p.y = car.y;
  game.toast(`Driving the ${VEHICLES[car.body].name}.`);
  if (car.body === 'taxi') game.toast('Taxi! Fares pay — look for the green $ on the map.');
  game.audio.horn();
}

export function exitCar(game) {
  const p = game.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  resolveBuilding(game.city, p, 14);
}

export function stepPlayer(game, dt, aimAngle) {
  const p = game.player;
  const input = game.input;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.car) {
    stepDriving(game, dt);
    return;
  }
  const steerX = input.steer();
  const steerY = input.throttle();
  const running = input.held('ShiftLeft', 'ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  p.running = running;
  const len = Math.hypot(steerX, steerY);
  p.moving = len > 0;
  if (len > 0) {
    const ox = p.x;
    const oy = p.y;
    // W is up on screen: throttle +1 walks toward smaller y.
    const nx = p.x + (steerX / len) * speed * dt;
    const ny = p.y - (steerY / len) * speed * dt;
    p.x = nx;
    p.y = ny;
    p.angle = aimAngle;
    if (hitBuilding(game.city, p.x, p.y, 13)) {
      // Slide along walls: try each axis on its own.
      p.x = ox;
      if (!hitBuilding(game.city, p.x, ny, 13)) p.y = ny;
      else {
        p.y = oy;
        if (!hitBuilding(game.city, nx, p.y, 13)) p.x = nx;
      }
    }
    p.x = clamp(p.x, 24, game.city.w - 24);
    p.y = clamp(p.y, 24, game.city.h - 24);
    if (isWater(p.x, p.y)) {
      // The bay is not a shortcut: wade back to the sand.
      p.x = Math.max(p.x, 100);
    }
  } else {
    p.angle = aimAngle;
  }
}

function stepDriving(game, dt) {
  const p = game.player;
  const car = p.car;
  const spec = VEHICLES[car.body];
  const input = game.input;
  const throttle = input.throttle();
  const steer = input.steer();
  const reverse = throttle < 0;
  const target = reverse ? -spec.speed * 0.45 : spec.speed;
  if (throttle !== 0) {
    car.speed += (target - car.speed) * Math.min(1, (spec.accel / spec.speed) * dt * 2.4);
  } else {
    car.speed += (0 - car.speed) * Math.min(1, 1.6 * dt);
  }
  car.speed = clamp(car.speed, -spec.speed * 0.5, spec.speed);
  const moving = Math.abs(car.speed) > 8;
  p.moving = moving;
  if (moving) {
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * spec.turn * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Hard stop on buildings, with a thud and a little damage at speed.
  if (hitBuilding(game.city, car.x, car.y, 20)) {
    if (Math.abs(car.speed) > 140) {
      car.hp -= Math.round(Math.abs(car.speed) * 0.06);
      game.audio.crash();
      game.addHeat(0);
      spawnCrashSparks(game, car.x, car.y);
    }
    car.x = p.x = car.x - Math.cos(car.angle) * car.speed * dt;
    car.y = p.y = car.y - Math.sin(car.angle) * car.speed * dt;
    car.speed *= -0.25;
  }
  // Skid marks when turning hard at speed, or braking from speed.
  if (moving && ((Math.abs(steer) > 0 && Math.abs(car.speed) > 260) || (throttle < 0 && car.speed > 180))) {
    game.skids.push({
      x: car.x - Math.cos(car.angle) * 14, y: car.y - Math.sin(car.angle) * 14,
      angle: car.angle, life: 5,
    });
    if (game.skids.length > 220) game.skids.shift();
  }
  // Dust when tearing across sand, spray at the water's edge.
  if (Math.abs(car.speed) > 200 && (car.x < 240 || car.x > game.city.w - 40)) {
    game.particles.push({
      x: car.x, y: car.y + 10, vx: -car.speed * 0.05, vy: 30,
      life: 0.5, max: 0.5, color: '#e8d9a4', size: 5,
    });
  }
  if (car.hp <= 0) {
    game.audio.crash();
    game.toast('Your car is wrecked — get out and find another.');
    exitCar(game);
    car.wrecked = true;
    car.speed = 0;
  }
  void STEP;
}

function spawnCrashSparks(game, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = game.random.next() * Math.PI * 2;
    game.particles.push({
      x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
      life: 0.4, max: 0.4, color: '#ffd23f', size: 3,
    });
  }
}
