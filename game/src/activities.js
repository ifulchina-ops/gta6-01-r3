// Side activities: the things to do between jobs. Drive a yellow cab and
// fares pay by the mile; twelve hidden Solara Stashes are buried around the
// city for $100 each; and the safehouse in the suburbs heals Rico and saves
// the game whenever he rolls through it. All three feed the HUD counters.

import { landmarkPos, nearestRoadPoint } from './city.js';
import { clamp } from './config.js';

export const STASH_SPOTS = [
  { x: 340, y: 700 }, { x: 790, y: 240 }, { x: 1240, y: 1500 },
  { x: 1700, y: 320 }, { x: 2140, y: 1100 }, { x: 2600, y: 700 },
  { x: 3050, y: 1500 }, { x: 800, y: 1900 }, { x: 1300, y: 2300 },
  { x: 2500, y: 1900 }, { x: 3000, y: 400 }, { x: 1750, y: 2200 },
];

export function createActivities() {
  return {
    faresDone: 0,
    fare: null,
    fareTimer: 0,
    stashes: 0,
    stashesFound: [],
    safehouseTimer: 0,
  };
}

function newFare(game) {
  const p = game.player;
  const pickup = nearestRoadPoint(game.random, p.x + game.random.range(-500, 500), p.y + game.random.range(-500, 500));
  const drop = nearestRoadPoint(game.random, game.random.range(300, game.city.w - 300), game.random.range(250, game.city.h - 250));
  game.activities.fare = {
    px: pickup.x, py: pickup.y,
    dx: drop.x, dy: drop.y,
    phase: 'pickup', timer: 75,
    value: 80 + Math.round(Math.hypot(drop.x - pickup.x, drop.y - pickup.y) / 12),
  };
  game.toast('A fare is waving! Pick them up at the green $.');
}

export function updateActivities(game, dt) {
  const a = game.activities;
  const p = game.player;

  // Taxi fares only exist while Rico drives a cab.
  if (p.car && p.car.body === 'taxi') {
    if (!a.fare) newFare(game);
  } else if (a.fare) {
    a.fare = null;
  }
  if (a.fare) {
    a.fare.timer -= dt;
    const target = a.fare.phase === 'pickup'
      ? { x: a.fare.px, y: a.fare.py }
      : { x: a.fare.dx, y: a.fare.dy };
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < 46) {
      if (a.fare.phase === 'pickup') {
        a.fare.phase = 'dropoff';
        a.fare.timer = 90;
        game.audio.pickup();
        game.toast('Passenger aboard — take them to the green flag.');
      } else {
        const tip = Math.max(0, Math.round(a.fare.timer));
        const pay = a.fare.value + tip;
        game.money += pay;
        a.faresDone += 1;
        game.audio.cash();
        game.toast(`Fare complete — +$${pay} (fare $${a.fare.value} + tip $${tip}).`);
        a.fare = null;
      }
    }
    if (a.fare && a.fare.timer <= 0) {
      game.toast('The fare gave up waiting. Another will wave soon.');
      a.fare = null;
    }
  }

  // Hidden stashes: walk or drive over one to pocket it.
  for (let i = 0; i < STASH_SPOTS.length; i += 1) {
    if (a.stashesFound.includes(i)) continue;
    const s = STASH_SPOTS[i];
    if (Math.hypot(p.x - s.x, p.y - s.y) < 34) {
      a.stashesFound.push(i);
      a.stashes += 1;
      game.money += 100;
      game.audio.pickup();
      game.toast(`Solara Stash found! ${a.stashes}/12 (+$100)`);
    }
  }

  // Safehouse: heal up and save, once every few seconds inside the zone.
  const sh = landmarkPos(game.city, 'safehouse');
  const inHouse = Math.hypot(p.x - sh.x, p.y - sh.y) < 120;
  if (inHouse) {
    a.safehouseTimer -= dt;
    if (p.health < 100) p.health = clamp(p.health + 25 * dt, 0, 100);
    if (a.safehouseTimer <= 0) {
      a.safehouseTimer = 4;
      game.save();
      game.toast('Safehouse — healed up and saved.');
    }
  }
}

/** Where the green fare marker points, for the HUD and the minimap. */
export function fareTarget(game) {
  const f = game.activities.fare;
  if (!f) return null;
  return f.phase === 'pickup'
    ? { x: f.px, y: f.py, label: 'Pick up fare' }
    : { x: f.dx, y: f.dy, label: 'Drop off fare' };
}
