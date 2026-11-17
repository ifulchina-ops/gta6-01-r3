// Staged scenes for screenshots: ?shot=chase|heist|beach|title (with &seed=N)
// arranges a real, playable state — a car, cops, pedestrians, a mission
// objective on the HUD — paints it twice and sets window.__shotReady so the
// screenshot runner knows the frame is settled. Nothing here is faked: the
// scene is the game running, with the same systems the player gets.

import { landmarkPos } from './city.js';
import { makeCar, spawnTrafficCar } from './traffic.js';
import { spawnPedestrian } from './pedestrians.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function placeSportsCar(game, x, y, angle) {
  const car = makeCar(game, x, y, 'sports');
  car.color = '#d83a2e';
  car.angle = angle;
  car.speed = 300;
  car.driver = 'player';
  car.owned = true;
  game.cars.push(car);
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

function placeCopChase(game, x, y) {
  for (let i = 0; i < 3; i += 1) {
    const a = game.random.next() * Math.PI * 2;
    const car = makeCar(game, x + Math.cos(a) * (260 + i * 130), y + Math.sin(a) * (200 + i * 110), 'cop');
    car.color = '#1c2733';
    car.driver = 'cop';
    car.speed = 420;
    car.angle = Math.atan2(y - car.y, x - car.x);
    game.cars.push(car);
    game.cops.push(car);
  }
  for (let i = 0; i < 2; i += 1) {
    game.officers.push({
      x: x + game.random.range(-260, 260), y: y + game.random.range(160, 300),
      speed: 205, bustTimer: 0, shootTimer: 1,
    });
  }
}

function skidTrail(game, x, y, angle) {
  for (let i = 0; i < 14; i += 1) {
    game.skids.push({
      x: x - Math.cos(angle) * (i * 22), y: y - Math.sin(angle) * (i * 22) + (i % 2 === 0 ? 12 : -12),
      angle, life: 5,
    });
  }
}

function crowd(game, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    const ped = spawnPedestrian(game, x + game.random.range(-320, 320), y + game.random.range(-260, 260));
    ped.flee = 2;
    ped.fleeX = game.random.range(-1, 1);
    ped.fleeY = game.random.range(-1, 1);
  }
}

export function stageShot(name, game) {
  const plaza = landmarkPos(game.city, 'plaza');
  const bank = landmarkPos(game.city, 'bank');
  const beach = landmarkPos(game.city, 'boardwalk');

  // A busy street under every shot: traffic on the roads, people on the walks.
  for (let i = 0; i < 10; i += 1) spawnTrafficCar(game);
  crowd(game, plaza.x, plaza.y, 8);

  if (name === 'chase') {
    // The cover: a Comet GT mid-chase down the plaza road, three stars, cops
    // closing in, skid marks behind, the heist escape on the HUD.
    game.mission.index = 7;
    game.mission.phase = 2;
    game.mission.count = 3;
    game.money = 2840;
    placeSportsCar(game, 1400, 1050, 0);
    placeCopChase(game, 1400, 1050);
    skidTrail(game, 1400, 1050, 0);
    game.addHeat(45);
    game.wanted = 3;
    game.heat = 55;
    for (let i = 0; i < 10; i += 1) {
      game.particles.push({
        x: 1400 - i * 20, y: 1050 + 14, vx: -60, vy: 20,
        life: 0.5, max: 0.5, color: '#e8d9a4', size: 5,
      });
    }
    game.toast('ALARM! Three stars — run for the safehouse!');
    game.toastTimer = 3.5;
    return SCREEN_PLAY;
  }

  if (name === 'heist') {
    // The Big One: Rico on foot outside Solara Bank, vault cash in hand,
    // two rivals down the street, a cop car rolling in, two stars.
    game.mission.index = 7;
    game.mission.phase = 1;
    game.mission.count = 2;
    game.money = 640;
    game.player.x = bank.x + 40;
    game.player.y = bank.y + 170;
    game.player.angle = -Math.PI / 2;
    game.player.ammo = 36;
    game.props.push({ kind: 'cash', x: bank.x + 60, y: bank.y + 30, taken: false });
    game.props.push({ kind: 'cash', x: bank.x + 106, y: bank.y + 30, taken: false });
    game.props.push({ kind: 'cash', x: bank.x + 152, y: bank.y + 30, taken: false });
    for (let i = 0; i < 2; i += 1) {
      game.enemies.push({
        x: bank.x + 180 + i * 90, y: bank.y + 240, hp: 100,
        shootTimer: 1, mission: 7, boss: false,
      });
    }
    const cop = makeCar(game, bank.x - 260, bank.y + 320, 'cop');
    cop.color = '#1c2733';
    cop.driver = 'cop';
    cop.speed = 200;
    cop.angle = 0.4;
    game.cars.push(cop);
    game.cops.push(cop);
    game.addHeat(28);
    game.wanted = 2;
    game.heat = 30;
    game.combat.bullets.push({
      x: game.player.x + 20, y: game.player.y - 10, vx: 400, vy: -500, life: 0.5, from: 'player',
    });
    game.toast('Inside! Grab all three bags of vault cash.');
    game.toastTimer = 3.5;
    return SCREEN_PLAY;
  }

  if (name === 'beach') {
    // Taxi King on the boardwalk: a yellow cab, a fare waiting, palms, the
    // bay glittering, a stash winking on the sand, the beach on the minimap.
    game.mission.index = 4;
    game.money = 930;
    game.activities.faresDone = 1;
    const taxi = makeCar(game, beach.x + 180, beach.y, 'taxi');
    taxi.color = '#f2c200';
    taxi.angle = Math.PI / 2;
    taxi.speed = 120;
    taxi.driver = 'player';
    taxi.owned = true;
    game.cars.push(taxi);
    game.player.car = taxi;
    game.player.x = taxi.x;
    game.player.y = taxi.y;
    game.player.angle = Math.PI / 2;
    game.activities.fare = {
      px: beach.x + 320, py: beach.y + 420, dx: 1650, dy: 1050,
      phase: 'pickup', timer: 70, value: 140,
    };
    game.props.push({ kind: 'stash', x: 165, y: beach.y - 120, taken: false });
    spawnPedestrian(game, beach.x + 320, beach.y + 420);
    crowd(game, beach.x + 200, beach.y, 6);
    for (let i = 0; i < 6; i += 1) spawnTrafficCar(game);
    game.toast('A fare is waving! Pick them up at the green $.');
    game.toastTimer = 3.5;
    return SCREEN_PLAY;
  }

  // Title: the city behind the start screen.
  game.player.x = plaza.x;
  game.player.y = plaza.y;
  game.screen = SCREEN_TITLE;
  return SCREEN_TITLE;
}

export function stageShotNames() {
  return ['chase', 'heist', 'beach', 'title'];
}
