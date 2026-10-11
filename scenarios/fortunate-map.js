// A map from Fortunate Maps by id (fortunatemaps.herokuapp.com/map/<id>), downloaded once into
// .fm-cache/. Only its walls count: boosts, spikes, gates, flags etc. are plain floor here.
// Offline? Point `png` at a downloaded map instead: map: { png: '../maps/whatever.png' }
module.exports = {
  name: 'fortunate maps',
  seed: 5,
  map: { fm: 74431 },
  ticks: 1800,
  stopWhen: 'tag',
  balls: [
    { id: 'runner', team: 2, bot: 'flee' },
    { id: 'chaser', team: 1, bot: 'chase', minDistance: 12 },
  ],
};
