// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between six screens: title, play, paused, busted, wasted and story done.
// Progress saves itself after every job and at every bust or waste, so
// closing the tab never loses the story.
//
// ?seed=N fixes the city. ?shot=chase|heist|beach|title (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity, landmarkPos } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RADIO, ACTION_STEAL, ACTION_HORN } from './input.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { createPlayer, enterCar, exitCar, nearestCar, stepPlayer } from './player.js';
import { spawnTrafficCar, stepTraffic } from './traffic.js';
import { spawnPedestrian, stepPeds, scarePeds } from './pedestrians.js';
import { addHeat, stepPolice } from './police.js';
import { createCombat, playerShoot, stepCombat, enemyShoot } from './combat.js';
import { createMissionState, startMission, stepEnemies, updateMissions, onEnemyDown, missionTarget } from './missions.js';
import { createActivities, updateActivities, fareTarget, STASH_SPOTS } from './activities.js';
import { createHud } from './hud.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const audio = createAudio();
const radio = createRadio(audio);
const input = createInput(canvas);
const hud = createHud();
const renderer = createRenderer(canvas, hud);

const startSpot = landmarkPos(city, 'plaza');
const game = {
  time: 0, money: 0, health: 100, wanted: 0, heat: 0, lastCrimeAt: -99,
  player: createPlayer(startSpot.x + 120, startSpot.y + 40),
  city, random, audio, radio, input, hud, combat: createCombat(),
  cars: [], peds: [], cops: [], officers: [], enemies: [],
  props: [], skids: [], particles: [],
  mission: createMissionState(),
  activities: createActivities(),
  stashSpots: STASH_SPOTS,
  missionTarget: null, fareTarget: null,
  storyDone: false, bustedFine: 0, screen: SCREEN_TITLE,
  toastText: '', toastTimer: 0, hasSave: hasSave(),
  save() { saveGame(game); },
  toast(text) { game.toastText = text; game.toastTimer = 3.5; },
  addHeat(amount) { addHeat(game, amount); },
  scarePeds(x, y, r) { scarePeds(game, x, y, r); },
  enemyShoot(x, y, tx, ty, damage) { enemyShoot(game, x, y, tx, ty, damage); },
  enemyDown(enemy) { onEnemyDown(game, enemy); },
  busted() { bustPlayer(game, false); },
  wasted() { bustPlayer(game, true); },
};
// The streets are alive from the first frame: traffic and pedestrians.
for (let i = 0; i < 26; i += 1) spawnTrafficCar(game);
for (let i = 0; i < 34; i += 1) spawnPedestrian(game);

/** A parked car of Rico's own, waiting near the plaza when a new game starts. */
function parkStarterCar() {
  const car = spawnTrafficCar(game, startSpot.x + 200, startSpot.y + 120);
  car.body = 'sedan';
  car.color = '#3d7bd9';
  car.angle = Math.PI / 2;
  car.parked = true;
  car.speed = 0;
  return car;
}

function newGame() {
  clearSave();
  game.money = 0;
  game.mission = createMissionState();
  game.storyDone = false;
  game.player = createPlayer(startSpot.x + 120, startSpot.y + 40);
  game.player.health = 100;
  game.heat = 0;
  game.wanted = 0;
  game.cops = [];
  game.officers = [];
  game.enemies = [];
  game.props = [];
  game.combat = createCombat();
  game.activities = createActivities();
  parkStarterCar();
  startMission(game, 0);
  game.screen = SCREEN_PLAY;
  announce('Playing. Steal a car and drive to Solara Plaza.');
}

function continueGame() {
  const data = loadGame();
  if (!data) { newGame(); return; }
  game.money = data.money || 0;
  game.mission = createMissionState();
  game.mission.index = Math.min(data.missionIndex || 0, 11);
  game.storyDone = !!data.storyDone;
  game.player = createPlayer(data.x || startSpot.x, data.y || startSpot.y);
  game.player.health = data.health || 100;
  game.player.ammo = data.ammo || 48;
  game.activities = createActivities();
  game.activities.faresDone = data.faresDone || 0;
  game.activities.stashesFound = Array.isArray(data.stashes) ? data.stashes : [];
  game.activities.stashes = game.activities.stashesFound.length;
  if (typeof data.station === 'number') game.radio.set(data.station);
  parkStarterCar();
  startMission(game, game.mission.index);
  game.screen = SCREEN_PLAY;
  announce('Welcome back to Solara Bay.');
}

function bustPlayer(g, wasted) {
  const fine = Math.min(Math.round(g.money * 0.2), 1500);
  g.money -= fine;
  g.bustedFine = fine;
  g.heat = 0;
  g.wanted = 0;
  g.cops = [];
  g.officers = [];
  g.enemies = [];
  const hospital = landmarkPos(g.city, 'hospital');
  if (g.player.car) {
    g.player.car.owned = false;
    g.player.car.driver = null;
    g.player.car = null;
  }
  g.player.x = hospital.x;
  g.player.y = hospital.y + 140;
  g.player.health = 100;
  g.player.ammo = Math.max(g.player.ammo, 24);
  g.save();
  g.audio.busted();
  g.screen = wasted ? SCREEN_WASTED : SCREEN_BUSTED;
  announce(wasted ? 'Wasted. You woke up at Bay General.' : 'Busted. You woke up at Bay General.');
}

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const screen = stageShot(name, game);
  game.screen = screen;
  let painted = 0;
  function paint() {
    renderer.draw(game, screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    audio.unlock();
    if (game.hasSave) continueGame();
    else newGame();
    game.screen = SCREEN_PLAY;
  }

  function resumeFromEnd() {
    audio.unlock();
    game.screen = SCREEN_PLAY;
    announce('Playing.');
  }

  function aimAngle() {
    const mouse = input.mouse();
    const view = renderer.view;
    const wx = view.camX + (mouse.x - view.width / 2) / view.zoom;
    const wy = view.camY + (mouse.y - view.height / 2) / view.zoom;
    return Math.atan2(wy - game.player.y, wx - game.player.x);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      game.toast(muted ? 'Sound off' : 'Sound on');
    }
    if (actions & ACTION_RADIO) {
      const name = radio.next();
      game.toast(`Radio: ${name} — ${radio.track()}`);
    }
    if (actions & ACTION_HORN && game.player.car) audio.horn();
    if (actions & ACTION_CONFIRM) {
      if (game.screen === SCREEN_TITLE) startGame();
      else if (game.screen === SCREEN_BUSTED || game.screen === SCREEN_WASTED || game.screen === SCREEN_DONE) resumeFromEnd();
    }
    if (actions & ACTION_PAUSE) {
      if (game.screen === SCREEN_PLAY) {
        game.screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (game.screen === SCREEN_PAUSED) {
        game.screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_STEAL && game.screen === SCREEN_PLAY) {
      if (game.player.car) exitCar(game);
      else {
        const car = nearestCar(game, 64);
        if (car) {
          const wasOwned = car.owned;
          enterCar(game, car);
          if (!wasOwned) game.addHeat(4);
        }
      }
    }
  }

  function step() {
    game.time += STEP;
    if (game.toastTimer > 0) game.toastTimer -= STEP;
    // Rico's own shot, toward the mouse.
    const mouse = input.mouse();
    if (game.screen === SCREEN_PLAY && mouse.down && !game.player.car) {
      playerShoot(game, aimAngle());
    }
    stepPlayer(game, STEP, aimAngle());
    stepTraffic(game, STEP);
    stepPeds(game, STEP);
    stepPolice(game, STEP);
    stepEnemies(game, STEP);
    stepCombat(game, STEP);
    updateMissions(game, STEP);
    updateActivities(game, STEP);
    radio.update(STEP);
    // Markers the renderer and minimap read.
    game.missionTarget = missionTarget(game);
    game.fareTarget = fareTarget(game);
    // Particles and skid marks decay.
    for (const pt of game.particles) {
      pt.life -= STEP;
      pt.x += pt.vx * STEP;
      pt.y += pt.vy * STEP;
    }
    game.particles = game.particles.filter((pt) => pt.life > 0);
    for (const s of game.skids) s.life -= STEP;
    game.skids = game.skids.filter((s) => s.life > 0);
    if (game.storyDone && game.screen === SCREEN_PLAY && game.mission.index >= 11) {
      game.screen = SCREEN_DONE;
      announce('King of Solara! The story is complete.');
    }
    // Health can hit zero from a ram or a bullet: the hospital takes him in.
    if (game.player.health <= 0 && game.screen === SCREEN_PLAY) {
      game.wasted();
    }
    audio.update(STEP, game.player.car ? game.player.car.speed : 0, game.cops.length > 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (game.screen === SCREEN_TITLE) {
      game.time += STEP;
    } else if (game.screen === SCREEN_PLAY) {
      while (accumulator >= STEP && game.screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, game.screen);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A peek at the state for automated play-tests: window.__game.
  window.__game = game;
  announce('Solara Bay: Heat Rising. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
