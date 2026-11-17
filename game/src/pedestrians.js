// Pedestrians: the people on the sidewalks. They stroll between waypoints,
// cross at corners, and run screaming from gunfire and speeding cars. A few
// stand at taxi stands with an arm out — the fares the taxi game is built
// on. Running one over is a crime the whole city notices.

import { clamp } from './config.js';
import { hitBuilding, nearestRoadPoint } from './city.js';

const SHIRTS = ['#e86a8a', '#4a7fc1', '#e8d44d', '#7a5ac2', '#4a9a5a', '#e8e8e8', '#c25a3a', '#39c2d7'];
const PANTS = ['#2c3038', '#3a4a6b', '#5a3a2c', '#4a4a4a'];

export function spawnPedestrian(game, x, y) {
  const spot = (x === undefined)
    ? nearestRoadPoint(game.random, game.random.range(200, game.city.w - 200), game.random.range(200, game.city.h - 200))
    : { x, y };
  const ped = {
    x: spot.x + game.random.range(-60, 60),
    y: spot.y + game.random.range(-60, 60),
    tx: spot.x, ty: spot.y,
    speed: game.random.range(38, 72),
    shirt: game.random.pick(SHIRTS),
    pants: game.random.pick(PANTS),
    flee: 0, fleeX: 0, fleeY: 0,
    walkPhase: game.random.next() * Math.PI * 2,
    dead: false, downTimer: 0,
  };
  game.peds.push(ped);
  return ped;
}

export function scarePeds(game, x, y, r) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < r) {
      ped.flee = game.random.range(1.5, 3);
      const a = Math.atan2(ped.y - y, ped.x - x);
      ped.fleeX = Math.cos(a);
      ped.fleeY = Math.sin(a);
    }
  }
}

export function knockPed(game, ped) {
  if (ped.dead) return;
  ped.dead = true;
  ped.downTimer = 6;
  game.addHeat(1);
  game.toast('You hit a pedestrian! The city saw that.');
  for (let i = 0; i < 6; i += 1) {
    game.particles.push({
      x: ped.x, y: ped.y,
      vx: game.random.range(-90, 90), vy: game.random.range(-90, 90),
      life: 0.5, max: 0.5, color: '#e86a8a', size: 3,
    });
  }
}

export function stepPeds(game, dt) {
  const player = game.player;
  for (const ped of game.peds) {
    if (ped.dead) {
      ped.downTimer -= dt;
      continue;
    }
    ped.walkPhase += dt * 8;
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += ped.fleeX * 150 * dt;
      ped.y += ped.fleeY * 150 * dt;
    } else {
      const d = Math.hypot(ped.tx - ped.x, ped.ty - ped.y);
      if (d < 12) {
        const spot = nearestRoadPoint(game.random, ped.x + game.random.range(-320, 320), ped.y + game.random.range(-320, 320));
        ped.tx = spot.x + game.random.range(-50, 50);
        ped.ty = spot.y + game.random.range(-50, 50);
      } else {
        ped.x += ((ped.tx - ped.x) / d) * ped.speed * dt;
        ped.y += ((ped.ty - ped.y) / d) * ped.speed * dt;
      }
    }
    if (hitBuilding(game.city, ped.x, ped.y, 10)) {
      ped.x -= ped.fleeX * 150 * dt;
      ped.y -= ped.fleeY * 150 * dt;
    }
    ped.x = clamp(ped.x, 110, game.city.w - 20);
    ped.y = clamp(ped.y, 20, game.city.h - 20);
    // A speeding car mows down anyone in its path.
    if (player.car && Math.abs(player.car.speed) > 240) {
      const d = Math.hypot(ped.x - player.x, ped.y - player.y);
      if (d < 26) knockPed(game, ped);
    }
    // Keep the crowd around the player: respawn the far ones.
    const dp = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (dp > 1500) {
      const spot = nearestRoadPoint(game.random, player.x + game.random.range(-600, 600), player.y + game.random.range(-600, 600));
      ped.x = spot.x;
      ped.y = spot.y;
      ped.tx = spot.x;
      ped.ty = spot.y;
      ped.dead = false;
    }
  }
  // Clear the long-dead so the list stays fresh.
  game.peds = game.peds.filter((p) => !p.dead || p.downTimer > 0);
  while (game.peds.length < 30) spawnPedestrian(game);
}
