// Keyboard + mouse. WASD/arrows move and drive, E steals a car, R changes
// the radio station, H honks, M mutes, P pauses, Enter confirms. Actions are
// edge-triggered bits the main loop consumes once per frame, so a held key
// never double-fires a steal or a pause.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4;
export const ACTION_MUTE = 8;
export const ACTION_RADIO = 16;
export const ACTION_HORN = 32;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_STEAL,
  KeyM: ACTION_MUTE,
  KeyR: ACTION_RADIO,
  KeyH: ACTION_HORN,
};

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let queued = 0;

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (KEY_ACTIONS[e.code] && !e.repeat) queued |= KEY_ACTIONS[e.code];
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    if (e.button === 0) queued |= ACTION_CONFIRM;
  }
  function onMouseUp() {
    mouse.down = false;
  }
  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse() {
      return mouse;
    },
    /** True while any of the given codes is held. */
    held(...codes) {
      return codes.some((c) => keys.has(c));
    },
    /** Steering: -1 left, +1 right, from A/D or the arrow keys. */
    steer() {
      let s = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      return s;
    },
    /** Throttle: -1 back, +1 forward, from W/S or the arrow keys. */
    throttle() {
      let t = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) t += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) t -= 1;
      return t;
    },
    /** Take the queued one-shot actions, clearing the queue. */
    takeActions() {
      const out = queued;
      queued = 0;
      return out;
    },
  };
}
