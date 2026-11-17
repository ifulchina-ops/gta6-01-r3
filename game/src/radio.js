// Radio: three switchable stations, each with a rotating track list. The R
// key flips stations, the HUD chip shows what is playing, and the audio
// engine's bassline follows the station. Tracks are original titles — no
// licensed music, no network requests, everything synthesized in audio.js.

import { STATIONS } from './config.js';

const TRACKS = [
  ['Sunset Drive — The Palms', 'Golden Hour — Marina Luz', 'Boardwalk Lights — Solara Sound'],
  ['Westside Story — Big Tuna', 'Crown Town — Lil Marina', 'Night Shift — DJ Peligro'],
  ['Neon Coast — Vector Nine', 'Midnight Run — Chrome Hearts', 'Afterglow — Palm Static'],
];

export function createRadio(audio) {
  let station = 0;
  let track = 0;
  let trackTimer = 0;
  const TRACK_LEN = 24;

  return {
    station() {
      return station;
    },
    name() {
      return STATIONS[station].name;
    },
    genre() {
      return STATIONS[station].genre;
    },
    color() {
      return STATIONS[station].color;
    },
    track() {
      return TRACKS[station][track];
    },
    /** Flip to the next station (R key). Returns the new station name. */
    next() {
      station = (station + 1) % STATIONS.length;
      track = 0;
      trackTimer = 0;
      audio.setStation(station);
      return STATIONS[station].name;
    },
    set(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      audio.setStation(station);
    },
    update(dt) {
      trackTimer += dt;
      if (trackTimer >= TRACK_LEN) {
        trackTimer = 0;
        track = (track + 1) % TRACKS[station].length;
      }
    },
  };
}
