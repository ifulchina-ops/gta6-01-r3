// Combat: bullets, muzzle flash and the people who shoot back. Rico fires
// toward the mouse on foot; rivals and officers fire back on a timer. A
// bullet checks buildings, cars, pedestrians and enemies each step, and a
// kill in the open is a crime — the wanted system hears it.

import { hitBuilding } from './city.js';

const BULLET_SPEED = 780;

export function createCombat() {
  return { bullets: [], enemyBullets: [], muzzle: 0 };
}

export function playerShoot(game, angle) {
  const p = game.player;
  if (p.car || p.ammo <= 0) return;
  if (game.combat.muzzle > 0) return;
  p.ammo -= 1;
  game.combat.muzzle = 0.09;
  game.audio.shoot();
  game.combat.bullets.push({
    x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    life: 0.9, from: 'player',
  });
  game.particles.push({
    x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26,
    vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffd23f', size: 7,
  });
  game.scarePeds(p.x, p.y, 320);
}

export function enemyShoot(game, x, y, tx, ty, damage) {
  const a = Math.atan2(ty - y, tx - x) + game.random.range(-0.12, 0.12);
  game.combat.enemyBullets.push({
    x, y, vx: Math.cos(a) * (BULLET_SPEED * 0.8), vy: Math.sin(a) * (BULLET_SPEED * 0.8),
    life: 1.1, damage,
  });
  game.audio.enemyShoot();
}

function bulletHitsCar(game, b) {
  for (const car of game.cars) {
    const dx = b.x - car.x;
    const dy = b.y - car.y;
    const along = Math.abs(Math.cos(car.angle) * dx + Math.sin(car.angle) * dy);
    const across = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
    const halfLen = car.body === 'truck' ? 34 : car.body === 'bike' ? 20 : 26;
    if (along < halfLen && across < 13) return car;
  }
  return null;
}

export function stepCombat(game, dt) {
  const combat = game.combat;
  if (combat.muzzle > 0) combat.muzzle -= dt;

  for (const b of combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitBuilding(game.city, b.x, b.y, 2)) {
      b.life = 0;
      spark(game, b.x, b.y);
      continue;
    }
    const car = bulletHitsCar(game, b);
    if (car && car.driver !== 'player') {
      car.hp -= 12;
      b.life = 0;
      spark(game, b.x, b.y);
      if (car.hp <= 0 && !car.wrecked) {
        car.wrecked = true;
        car.speed = 0;
        game.audio.crash();
      }
      continue;
    }
    // Rivals and officers take the hit.
    for (const e of game.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 16) {
        e.hp -= 34;
        b.life = 0;
        spark(game, b.x, b.y);
        if (e.hp <= 0) game.enemyDown(e);
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const off of game.officers) {
      if (Math.hypot(off.x - b.x, off.y - b.y) < 14) {
        b.life = 0;
        game.officers.splice(game.officers.indexOf(off), 1);
        game.addHeat(6);
        game.toast('You dropped an officer — the heat just went up.');
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const ped of game.peds) {
      if (!ped.dead && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
        b.life = 0;
        game.addHeat(8);
        game.toast('You shot a pedestrian! Witnesses are calling it in.');
        ped.dead = true;
        ped.downTimer = 6;
        break;
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);

  const p = game.player;
  for (const b of combat.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitBuilding(game.city, b.x, b.y, 2)) {
      b.life = 0;
      spark(game, b.x, b.y);
      continue;
    }
    if (!p.car && p.invuln <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
      p.health -= b.damage;
      p.invuln = 0.35;
      b.life = 0;
      game.audio.crash();
    } else if (p.car && Math.hypot(p.x - b.x, p.y - b.y) < 20) {
      p.car.hp -= b.damage * 0.5;
      b.life = 0;
    }
  }
  combat.enemyBullets = combat.enemyBullets.filter((b) => b.life > 0);
}

function spark(game, x, y) {
  for (let i = 0; i < 4; i += 1) {
    const a = game.random.next() * Math.PI * 2;
    game.particles.push({
      x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
      life: 0.25, max: 0.25, color: '#ffd23f', size: 2,
    });
  }
}
