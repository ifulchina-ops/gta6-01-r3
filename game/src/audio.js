// Sound: a WebAudio engine with no audio files — an engine hum that follows
// speed, a two-tone siren when the police are close, gunshots and pickups
// from filtered noise, and a tiny step-sequencer that plays a different
// bassline per radio station. Everything is created lazily on the first
// user gesture, so the page never needs an audio permission prompt.

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** One station's loop: a bassline of MIDI notes plus a sparkle line. */
const LOOPS = [
  { bass: [45, 45, 48, 43, 45, 45, 50, 48], lead: [69, 72, 76, 72, 69, 67, 64, 67] },
  { bass: [41, 41, 44, 41, 46, 44, 41, 39], lead: [65, 65, 68, 70, 68, 65, 63, 60] },
  { bass: [48, 51, 48, 46, 48, 51, 55, 53], lead: [72, 76, 79, 76, 72, 74, 71, 74] },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicGain = null;
  let station = 0;
  let step = 0;
  let nextStepAt = 0;
  let muted = false;
  let unlocked = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch (err) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  function playStep() {
    if (!ctx || muted) return;
    const loop = LOOPS[station % LOOPS.length];
    const beat = 60 / [96, 88, 116][station % 3] / 2;
    const now = ctx.currentTime;
    if (now < nextStepAt) return;
    nextStepAt = now + beat;
    const bass = loop.bass[step % loop.bass.length];
    const lead = loop.lead[step % loop.lead.length];
    blip(midiToFreq(bass), beat * 0.9, 'triangle', 0.5);
    if (step % 2 === 0) blip(midiToFreq(lead), beat * 0.5, 'square', 0.1);
    step += 1;
  }

  return {
    get station() {
      return station;
    },
    setStation(i) {
      station = ((i % 3) + 3) % 3;
      step = 0;
    },
    unlock() {
      if (unlocked) return;
      unlocked = true;
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      nextStepAt = ctx ? ctx.currentTime + 0.05 : 0;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      noiseBurst(0.09, 0.5, 2400);
    },
    enemyShoot() {
      noiseBurst(0.07, 0.25, 1600);
    },
    crash() {
      noiseBurst(0.25, 0.6, 500);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.35);
      blip(990, 0.14, 'sine', 0.35, 0.09);
    },
    cash() {
      blip(880, 0.08, 'sine', 0.3);
      blip(1174, 0.08, 'sine', 0.3, 0.08);
      blip(1568, 0.16, 'sine', 0.3, 0.16);
    },
    busted() {
      blip(392, 0.25, 'square', 0.25);
      blip(311, 0.4, 'square', 0.25, 0.25);
    },
    horn() {
      blip(370, 0.18, 'square', 0.2);
      blip(466, 0.18, 'square', 0.2);
    },
    update(dt, speed, chase) {
      if (!ctx || muted) return;
      if (engineOsc && engineGain) {
        engineOsc.frequency.value = 50 + Math.abs(speed) * 0.22;
        engineGain.gain.value = Math.abs(speed) > 12 ? 0.05 : 0.015;
      }
      if (sirenOsc && sirenGain) {
        const t = ctx.currentTime;
        sirenOsc.frequency.value = chase ? 650 + Math.sin(t * 4.4) * 180 : 700;
        sirenGain.gain.value = chase ? 0.045 : 0;
      }
      playStep();
    },
  };
}
