/* Seeded random number generator so every experiment is reproducible. */
(function () {
  const CPM = (globalThis.CPM = globalThis.CPM || {});
  /** mulberry32: small, fast, good enough for simulation. Returns a function giving floats in [0, 1). */
  CPM.makeRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Fisher-Yates shuffle using the supplied rng; returns a new array. */
  CPM.shuffle = function (arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
})();
