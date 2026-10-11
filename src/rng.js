// rng.js - small seeded RNG (mulberry32) so maps, spawns and bots are reproducible.
(function () {
function makeRng(seed) {
  if (typeof seed === 'function') return seed;
  let a = (seed === undefined ? (Math.random() * 2 ** 32) : Number(seed)) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const api = { makeRng };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.CPRng = api;
})();
