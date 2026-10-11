// A chaser bot runs at a runner that follows a fixed key script, on a BuildAMapWorkshop map.
//   node bin/run.js scenarios/straight-chase.js
module.exports = {
  name: 'straight chase',
  map: { generate: { seed: 7, width: 45, height: 45, diagonals: 0.5 } },
  ticks: 900,            // 15 seconds
  stopWhen: 'tag',
  balls: [
    // key script: hold right 60 ticks, up+right 45, nothing 15, then left until the end
    { id: 'runner', team: 2, tile: [22, 22], keys: 'R60 UR45 _15 L' },
    { id: 'chaser', team: 1, tile: [12, 22], bot: 'chase', target: 'runner' },
  ],
};
