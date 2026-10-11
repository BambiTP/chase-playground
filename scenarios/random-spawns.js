// Random interior spawns at least 10 tiles apart; the runner flees, the chaser leads its target.
// Change `seed` for a different start; the map has its own seed.
module.exports = {
  name: 'flee vs lead',
  seed: 42,
  map: { generate: { seed: 3 } },
  ticks: 1800,
  stopWhen: 'tag',
  balls: [
    { id: 'runner', team: 2, bot: 'flee' },
    { id: 'chaser', team: 1, bot: 'lead', minDistance: 10 },
  ],
};
