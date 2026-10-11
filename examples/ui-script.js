// A script for the UI (ui/index.html -> Upload script). Everything is optional:
//   map     the map to use (default: generated from the seed box)
//   setup   add the balls (default: one red, one blue)
//   tick    called before every tick (1/60 s) to set keys; state has x, y, vx, vy per ball
// Pick a ball in "Arrow keys drive" to steer it yourself on top of the script.
const { generateMap } = require('chase-playground');

module.exports = {
  map: generateMap({ seed: 3 }),

  setup(pg) {
    pg.addBall({ id: 'runner', team: 2 });
    pg.addBall({ id: 'chaser', team: 1, minDistance: 12 });
  },

  tick(pg, state) {
    const me = state.balls.chaser, target = state.balls.runner;
    let keys = '';
    if (target.y < me.y - 0.02) keys += 'U';
    if (target.y > me.y + 0.02) keys += 'D';
    if (target.x < me.x - 0.02) keys += 'L';
    if (target.x > me.x + 0.02) keys += 'R';
    pg.setKeys('chaser', keys);

    // on a tag, put the runner somewhere new
    if (pg.touching('chaser', 'runner')) {
      const spot = pg.randomSpot(pg.ball('runner'), 12);
      pg.place('runner', spot.x, spot.y);
    }
  },
};
