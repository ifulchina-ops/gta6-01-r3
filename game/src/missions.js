// The story: twelve jobs that take Rico from a nobody with a stolen sedan
// to the King of Solara. Jobs 6–8 are one heist chain — casing the vault,
// stealing the getaway car, then the bank job itself. Each mission owns its
// target, its enemies and its payout; the HUD reads the current objective
// straight from here, and the minimap reads the target.

import { landmarkPos } from './city.js';
import { spawnTrafficCar } from './traffic.js';

export const MISSIONS = [
  { title: 'Wheels Up', brief: 'Rico needs wheels. Any car will do.', reward: 150 },
  { title: 'Hot Package', brief: 'A package for the docks. No questions.', reward: 250 },
  { title: 'Turf War', brief: 'The Vipers hold the docks. Take it back.', reward: 400 },
  { title: 'Heat Check', brief: 'Get two stars, then lose the heat clean.', reward: 350 },
  { title: 'Taxi King', brief: 'Two fares in a yellow cab. The city pays.', reward: 300 },
  { title: 'Casing the Vault', brief: 'Heist part 1: watch the bank. Eight seconds, unseen.', reward: 200 },
  { title: 'Getaway Wheels', brief: 'Heist part 2: the Comet GT in the garage. Bring it home.', reward: 400 },
  { title: 'The Big One', brief: 'Heist part 3: grab the vault cash and vanish.', reward: 2500 },
  { title: 'Beachfront Run', brief: 'Five stashes buried along the beach. Dig them up.', reward: 500 },
  { title: 'Harbor Lights', brief: 'Three guards, one crate run at the port.', reward: 600 },
  { title: "Kingpin's Call", brief: 'Six of the Kingpin’s crew hold the plaza. End it.', reward: 800 },
  { title: 'King of Solara', brief: 'The Kingpin himself, four stars, one last fight.', reward: 1500 },
];

export function createMissionState() {
  return { index: 0, phase: 0, timer: 0, count: 0, started: false };
}

export function currentMission(game) {
  return MISSIONS[game.mission.index] || null;
}

export function currentObjective(game) {
  const m = game.mission;
  const def = MISSIONS[m.index];
  if (!def) return 'Story complete — Solara Bay is yours.';
  switch (m.index) {
    case 0: return 'Steal a car (walk up and press E)';
    case 1: return 'Deliver the package to the port';
    case 2: return `Clear the docks — Vipers down ${m.count}/4`;
    case 3: return m.phase === 0 ? 'Get the cops on you — reach 2 stars' : 'Lose the heat — stay clean until the stars fade';
    case 4: return `Taxi fares done ${game.activities.faresDone}/2 — drive a yellow cab`;
    case 5: return `Watch the bank — stay in the gold zone ${Math.ceil(Math.max(0, 8 - m.timer))}s`;
    case 6: return m.phase === 0 ? 'Steal the Comet GT from the downtown garage' : 'Bring the Comet GT to the safehouse';
    case 7:
      if (m.phase === 0) return 'Get to Solara Bank';
      if (m.phase === 1) return `Grab the vault cash ${m.count}/3`;
      return 'Escape to the safehouse — 3 stars and counting';
    case 8: return `Beach stashes found ${m.count}/5`;
    case 9: return m.phase === 0 ? `Drop the port guards ${m.count}/3` : 'Deliver the crate to the port office';
    case 10: return `Kingpin crew down ${m.count}/6`;
    case 11: return 'Take down the Kingpin — and survive the heat';
    default: return def.brief;
  }
}

/** Where the yellow marker points, for the HUD and the minimap. */
export function missionTarget(game) {
  const m = game.mission;
  const L = (name) => landmarkPos(game.city, name);
  switch (m.index) {
    case 0: return { x: game.player.x + 260, y: game.player.y, label: 'Find a car' };
    case 1: return { x: L('port').x, y: L('port').y, label: 'Port delivery' };
    case 2: return { x: L('docks').x, y: L('docks').y, label: 'The docks' };
    case 3: return null;
    case 4: return game.player.car && game.player.car.body === 'taxi' ? null : { x: 1650, y: 650, label: 'Find a taxi' };
    case 5: return { x: L('bank').x, y: L('bank').y, label: 'Solara Bank' };
    case 6: return m.phase === 0 ? { x: L('garage').x, y: L('garage').y, label: 'The garage' } : { x: L('safehouse').x, y: L('safehouse').y, label: 'Safehouse' };
    case 7:
      if (m.phase === 0) return { x: L('bank').x, y: L('bank').y, label: 'Solara Bank' };
      if (m.phase === 1) return { x: L('bank').x, y: L('bank').y, label: 'Vault cash' };
      return { x: L('safehouse').x, y: L('safehouse').y, label: 'Escape!' };
    case 8: {
      const next = game.props.find((p) => p.kind === 'stash' && !p.taken);
      return next ? { x: next.x, y: next.y, label: 'Beach stash' } : null;
    }
    case 9: return m.phase === 0 ? { x: L('port').x, y: L('port').y, label: 'Port guards' } : { x: L('port').x, y: L('port').y, label: 'Port office' };
    case 10: return { x: L('plaza').x, y: L('plaza').y, label: 'The plaza' };
    case 11: return { x: L('plaza').x, y: L('plaza').y, label: 'The Kingpin' };
    default: return null;
  }
}

function spawnEnemy(game, x, y, hp, mission) {
  const e = { x, y, hp: hp || 100, shootTimer: game.random.range(0.8, 2), mission, boss: false };
  game.enemies.push(e);
  return e;
}

function spawnSquad(game, cx, cy, n, hp, mission) {
  for (let i = 0; i < n; i += 1) {
    spawnEnemy(game, cx + game.random.range(-140, 140), cy + game.random.range(-140, 140), hp, mission);
  }
}

export function startMission(game, i) {
  const m = game.mission;
  m.index = i;
  m.phase = 0;
  m.timer = 0;
  m.count = 0;
  m.started = true;
  game.enemies = [];
  const L = (name) => landmarkPos(game.city, name);
  if (i === 2) spawnSquad(game, L('docks').x, L('docks').y, 4, 100, 2);
  if (i === 6) {
    // The Comet GT waits in the garage: a parked sports car, easy to spot.
    const hasSports = game.cars.some((c) => c.body === 'sports' && c.parked);
    if (!hasSports) {
      const g = L('garage');
      const car = spawnTrafficCar(game, g.x + 40, g.y + 60, 'sports');
      car.parked = true;
      car.speed = 0;
      car.color = '#d83a2e';
    }
  }
  if (i === 7) {
    game.props = game.props.filter((p) => p.kind !== 'cash');
    for (let k = 0; k < 3; k += 1) {
      game.props.push({ kind: 'cash', x: L('bank').x + 60 + k * 46, y: L('bank').y + 30, taken: false });
    }
  }
  if (i === 8) {
    game.props = game.props.filter((p) => p.kind !== 'stash');
    for (let k = 0; k < 5; k += 1) {
      game.props.push({ kind: 'stash', x: 165 + game.random.range(-14, 14), y: 420 + k * 380, taken: false });
    }
  }
  if (i === 9) spawnSquad(game, L('port').x, L('port').y, 3, 120, 9);
  if (i === 10) spawnSquad(game, L('plaza').x, L('plaza').y, 6, 110, 10);
  if (i === 11) {
    const boss = spawnEnemy(game, L('plaza').x, L('plaza').y, 320, 11);
    boss.boss = true;
    spawnSquad(game, L('plaza').x, L('plaza').y, 3, 100, 11);
    game.addHeat(30);
  }
  const def = MISSIONS[i];
  if (def) game.toast(`Job ${i + 1}/12 — ${def.title}: ${def.brief}`);
}

function completeMission(game) {
  const m = game.mission;
  const def = MISSIONS[m.index];
  if (!def) return;
  game.money += def.reward;
  game.audio.cash();
  game.toast(`Job done: ${def.title} — +$${def.reward}`);
  game.save();
  if (m.index >= MISSIONS.length - 1) {
    game.storyDone = true;
    return;
  }
  startMission(game, m.index + 1);
}

function near(game, x, y, r) {
  return Math.hypot(game.player.x - x, game.player.y - y) < r;
}

export function updateMissions(game, dt) {
  const m = game.mission;
  if (game.storyDone || !MISSIONS[m.index]) return;
  const L = (name) => landmarkPos(game.city, name);
  const p = game.player;
  switch (m.index) {
    case 0:
      if (p.car) completeMission(game);
      break;
    case 1:
      if (near(game, L('port').x, L('port').y, 90)) completeMission(game);
      break;
    case 2:
      if (m.count >= 4) completeMission(game);
      break;
    case 3:
      if (m.phase === 0 && game.wanted >= 2) {
        m.phase = 1;
        game.toast('Now lose them — no crimes, no speeding into peds.');
      } else if (m.phase === 1 && game.wanted === 0) completeMission(game);
      break;
    case 4:
      if (game.activities.faresDone >= 2) completeMission(game);
      break;
    case 5:
      if (near(game, L('bank').x, L('bank').y, 130)) {
        m.timer += dt;
        if (m.timer >= 8) completeMission(game);
      } else m.timer = Math.max(0, m.timer - dt * 2);
      break;
    case 6:
      if (m.phase === 0) {
        if (p.car && p.car.body === 'sports') {
          m.phase = 1;
          game.toast('That is the one. Bring it to the safehouse, no cops.');
        }
      } else if (near(game, L('safehouse').x, L('safehouse').y, 110)) completeMission(game);
      break;
    case 7:
      if (m.phase === 0) {
        if (near(game, L('bank').x, L('bank').y, 130)) {
          m.phase = 1;
          game.toast('Inside! Grab all three bags of vault cash.');
        }
      } else if (m.phase === 1) {
        for (const prop of game.props) {
          if (prop.kind === 'cash' && !prop.taken && near(game, prop.x, prop.y, 34)) {
            prop.taken = true;
            m.count += 1;
            game.audio.pickup();
            game.toast(`Vault cash ${m.count}/3`);
          }
        }
        if (m.count >= 3) {
          m.phase = 2;
          game.addHeat(45);
          game.toast('ALARM! Three stars — run for the safehouse!');
        }
      } else if (near(game, L('safehouse').x, L('safehouse').y, 110)) completeMission(game);
      break;
    case 8:
      for (const prop of game.props) {
        if (prop.kind === 'stash' && !prop.taken && near(game, prop.x, prop.y, 34)) {
          prop.taken = true;
          m.count += 1;
          game.money += 60;
          game.audio.pickup();
          game.toast(`Beach stash ${m.count}/5 (+$60)`);
        }
      }
      if (m.count >= 5) completeMission(game);
      break;
    case 9:
      if (m.phase === 0 && m.count >= 3) {
        m.phase = 1;
        game.toast('Guards down. Deliver the crate to the port office.');
      } else if (m.phase === 1 && near(game, L('port').x, L('port').y, 90)) completeMission(game);
      break;
    case 10:
      if (m.count >= 6) completeMission(game);
      break;
    case 11:
      if (m.count >= 4) completeMission(game);
      break;
    default:
      break;
  }
}

export function stepEnemies(game, dt) {
  const p = game.player;
  for (const e of game.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.shootTimer -= dt;
    if (d < 520 && d > 90) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(a) * (e.boss ? 95 : 120) * dt;
      e.y += Math.sin(a) * (e.boss ? 95 : 120) * dt;
    }
    if (d < 400 && e.shootTimer <= 0) {
      e.shootTimer = e.boss ? 0.9 : game.random.range(1.3, 2.3);
      game.enemyShoot(e.x, e.y, p.x, p.y, e.boss ? 12 : 7);
    }
  }
  game.enemies = game.enemies.filter((e) => e.hp > 0);
}

export function onEnemyDown(game, enemy) {
  const m = game.mission;
  game.money += enemy.boss ? 200 : 25;
  game.audio.cash();
  if (enemy.mission === m.index && [2, 9, 10, 11].includes(m.index)) {
    m.count += 1;
  }
  if (enemy.boss) {
    game.toast('The Kingpin is down. Solara Bay is yours.');
  }
  game.scarePeds(enemy.x, enemy.y, 200);
}
