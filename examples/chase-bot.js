// A bot is just a function from the state to keys. Here a chaser steers straight at a runner
// that presses random keys; we time how long the tag takes over a few episodes.
//   node examples/chase-bot.js
const { Playground, generateMap } = require('..');

function chaser(me, target) {
  let keys = '';
  if (target.y < me.y - 0.02) keys += 'U';
  if (target.y > me.y + 0.02) keys += 'D';
  if (target.x < me.x - 0.02) keys += 'L';
  if (target.x > me.x + 0.02) keys += 'R';
  return keys;
}

const map = generateMap({ seed: 3 });
const combos = ['', 'U', 'D', 'L', 'R', 'UL', 'UR', 'DL', 'DR'];

for (let episode = 0; episode < 5; episode++) {
  const pg = new Playground({ map, seed: episode });   // seed = where the balls spawn
  pg.addBall({ id: 'runner', team: 2 });
  pg.addBall({ id: 'chaser', team: 1, minDistance: 12 });

  let runnerKeys = '';
  while (pg.tick < 60 * 30) {                           // 30 s max
    const { balls } = pg.state();
    if (pg.tick % 20 === 0) runnerKeys = combos[Math.floor(Math.random() * combos.length)];
    pg.step({ chaser: chaser(balls.chaser, balls.runner), runner: runnerKeys });
    if (pg.touching('chaser', 'runner')) break;
  }
  const tagged = pg.touching('chaser', 'runner');
  console.log(`episode ${episode}: ${tagged ? `tagged after ${(pg.tick / 60).toFixed(2)} s` : 'no tag in 30 s'}`);
}
