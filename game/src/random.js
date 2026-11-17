// Seeded random numbers. One generator per game, fixed by ?seed=N, so the
// same seed always builds the same city, the same traffic colours and the
// same collectible spots. A mulberry32 stream: small, fast, deterministic.

export function createRandom(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Integer in [0, n). */
    int(n) {
      return Math.floor(next() * n);
    },
    /** Float in [lo, hi). */
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    /** One element of a list, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** A shuffled copy of a list (Fisher-Yates on the stream). */
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
