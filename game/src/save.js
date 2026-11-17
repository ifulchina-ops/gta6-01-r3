// Save: one localStorage key, written after every job, every bust, every
// waste, and every safehouse stop. Closing the tab never loses the story.
// A save older than the story's shape loads defensively — bad numbers fall
// back to the plaza, never to a crash.

const KEY = 'solara-bay-heat-rising-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(KEY);
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function saveGame(game) {
  try {
    const data = {
      money: game.money,
      missionIndex: game.mission.index,
      health: Math.round(game.player.health),
      ammo: game.player.ammo,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      faresDone: game.activities.faresDone,
      stashes: game.activities.stashesFound.slice(),
      storyDone: game.storyDone,
      station: game.radio.station(),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    // Storage full or blocked: the game keeps running, just unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // Nothing to clear.
  }
}
