// Random interior spawns at least 10 tiles apart. Change `seed` for a different start; the map
// has its own seed. Both balls just hold a key script here; give one a bot to make it chase.
module.exports = {
  name: 'random spawns',
  seed: 42,
  map: { generate: { seed: 3 } },
  ticks: 600,
  balls: [
    { id: 'runner', team: 2, keys: 'U60 R60 D60 L60' },
    { id: 'chaser', team: 1, minDistance: 10, keys: 'DL120 UR' },
  ],
};
