// Writing your own bot: a function called before every tick that returns the keys to hold.
//   ctx.me / ctx.target / ctx.balls[id]: { x, y, vx, vy } in metres and m/s (1 tile = 0.4 m)
//   ctx.tick, ctx.rng (seeded), ctx.state (an object kept between ticks), ctx.pg (the Playground)
function zigzagChaser(ctx) {
  const { me, target } = ctx;
  const keys = [];
  if (target.x > me.x + 0.05) keys.push('right'); else if (target.x < me.x - 0.05) keys.push('left');
  // only chase vertically every other half second
  if (Math.floor(ctx.tick / 30) % 2 === 0) { if (target.y > me.y) keys.push('down'); else keys.push('up'); }
  return keys;
}

module.exports = {
  name: 'custom bot',
  seed: 1,
  map: { generate: { seed: 12, diagonals: 0.8 } },
  ticks: 1200,
  stopWhen: 'tag',
  balls: [
    { id: 'runner', team: 2, bot: 'random', hold: 30 },
    { id: 'chaser', team: 1, bot: zigzagChaser, minDistance: 6 },
  ],
};
