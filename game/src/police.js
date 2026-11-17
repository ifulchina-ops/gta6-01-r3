// The police: a five-star wanted system. Crimes add heat, heat decays when
// Rico stays clean, and stars decide how many interceptors and foot
// officers hunt him. Cop cars ram, officers chase on foot and bust him when
// they get close enough for long enough. Busted means a fine and a trip to
// Bay General — the story does not end, it just costs money.

import { WANTED_TABLE, clamp, angleDiff, angleTo } from './config.js';
import { hitBuilding } from './city.js';
import { makeCar } from './traffic.js';

export function addHeat(game, amount) {
  game.heat = clamp(game.heat + amount, 0, 100);
  const stars = game.heat >= 90 ? 5 : game.heat >= 70 ? 4 : game.heat >= 50 ? 3 : game.heat >= 28 ? 2 : game.heat >= 10 ? 1 : 0;
  if (stars !== game.wanted) {
    game.wanted = stars;
    if (stars > 0) game.toast(`Wanted level ${stars} — the law is coming.`);
    else game.toast('You lost the heat. Stay clean.');
  }
  game.lastCrimeAt = game.time;
}

function spawnCopCar(game) {
  const p = game.player;
  const a = game.random.next() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(a) * 700, 200, game.city.w - 200);
  const y = clamp(p.y + Math.sin(a) * 700, 200, game.city.h - 200);
  const car = makeCar(game, x, y, 'cop');
  car.color = '#1c2733';
  car.driver = 'cop';
  car.cruise = 470;
  car.speed = 300;
  game.cars.push(car);
  game.cops.push(car);
  return car;
}

function spawnOfficer(game) {
  const p = game.player;
  const a = game.random.next() * Math.PI * 2;
  const officer = {
    x: clamp(p.x + Math.cos(a) * 320, 40, game.city.w - 40),
    y: clamp(p.y + Math.sin(a) * 320, 40, game.city.h - 40),
    speed: 205, bustTimer: 0, shootTimer: game.random.range(1, 2),
  };
  game.officers.push(officer);
  return officer;
}

export function stepPolice(game, dt) {
  // Staying clean cools the heat off, slowly.
  if (game.wanted > 0 && game.time - game.lastCrimeAt > 14) {
    addHeat(game, -dt * 2.2);
  }
  const want = WANTED_TABLE[game.wanted] || WANTED_TABLE[0];
  while (game.cops.length < want.cars) spawnCopCar(game);
  while (game.officers.length < want.officers) spawnOfficer(game);
  if (game.wanted === 0) {
    // Stand down: cops drive off, officers walk away.
    game.cops = game.cops.filter((c) => {
      if (Math.hypot(c.x - game.player.x, c.y - game.player.y) > 900) {
        game.cars.splice(game.cars.indexOf(c), 1);
        return false;
      }
      return true;
    });
    game.officers = [];
  }

  const p = game.player;
  for (const cop of game.cops) {
    if (cop.wrecked) continue;
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    // Interceptors predict where Rico is going and cut him off.
    const px = p.x + Math.cos(p.angle) * Math.min(120, Math.abs(p.car ? p.car.speed : 0) * 0.35);
    const py = p.y + Math.sin(p.angle) * Math.min(120, Math.abs(p.car ? p.car.speed : 0) * 0.35);
    const aim = angleTo(cop.x, cop.y, px, py);
    cop.angle += clamp(angleDiff(cop.angle, aim), -2.6 * dt, 2.6 * dt);
    const wantSpeed = d > 700 ? 480 : 430;
    cop.speed += (wantSpeed - cop.speed) * Math.min(1, 1.2 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (hitBuilding(game.city, cop.x, cop.y, 18)) {
      cop.x -= Math.cos(cop.angle) * cop.speed * dt;
      cop.y -= Math.sin(cop.angle) * cop.speed * dt;
      cop.speed *= 0.4;
      cop.angle += Math.PI / 3;
    }
    // A ram hurts: the player's car takes it, or Rico does on foot.
    if (d < 34) {
      if (p.car) {
        p.car.hp -= 26 * dt;
        if (game.random.chance(dt * 2)) game.audio.crash();
      } else if (p.invuln <= 0) {
        p.health -= 22 * dt;
        p.invuln = 0.5;
        game.toast('A cop car clipped you!');
      }
      cop.speed *= 0.6;
    }
    if (d > 1800) {
      // Lost the trail: reposition the chase near the player.
      const a = game.random.next() * Math.PI * 2;
      cop.x = clamp(p.x + Math.cos(a) * 650, 200, game.city.w - 200);
      cop.y = clamp(p.y + Math.sin(a) * 650, 200, game.city.h - 200);
    }
  }
  // Officers on foot: chase, shoot when close, bust when touching.
  for (const off of game.officers) {
    const d = Math.hypot(p.x - off.x, p.y - off.y);
    const a = angleTo(off.x, off.y, p.x, p.y);
    off.shootTimer -= dt;
    if (d > 30) {
      off.x += Math.cos(a) * off.speed * dt;
      off.y += Math.sin(a) * off.speed * dt;
      off.bustTimer = 0;
    } else if (!p.car) {
      off.bustTimer += dt;
      if (off.bustTimer > 1.1) {
        game.busted();
        return;
      }
    }
    if (d < 420 && d > 60 && off.shootTimer <= 0 && !p.car) {
      off.shootTimer = game.random.range(1.4, 2.4);
      game.enemyShoot(off.x, off.y, p.x, p.y, 6);
    }
    if (hitBuilding(game.city, off.x, off.y, 10)) {
      off.x -= Math.cos(a) * off.speed * dt;
      off.y -= Math.sin(a) * off.speed * dt;
    }
  }
}
