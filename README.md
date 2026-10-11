# chase-playground

TagPro ball movement with the exact default physics, as a small Node engine for writing chase
bots. Make a map, spawn balls, set their keys, step. The only collisions are balls with walls
and with each other: no boosts, spikes, flags, powerups or tags.

The physics is [tagpro-local](https://github.com/BambiTP/tagpro-local)'s game server with
everything except movement removed. It uses the same Box2D build as the official client and the
same tick order. It was checked tick by tick against tagpro-local's server and matches bit for bit.

```js
const { Playground, generateMap } = require('./');   // no dependencies

const pg = new Playground({ map: generateMap({ seed: 7 }) });
pg.addBall({ id: 'runner', team: 2 });                 // random open tile
pg.addBall({ id: 'chaser', team: 1, minDistance: 10 });

while (pg.tick < 600) {
  const { balls } = pg.state();                        // x, y, vx, vy per ball
  pg.step({ chaser: myBot(balls.chaser, balls.runner), runner: 'UL' });
  if (pg.touching('chaser', 'runner')) break;
}
```

Examples: `node examples/basic.js`, `examples/ascii-map.js`, `examples/chase-bot.js`.

## UI

Open `ui/index.html` in a browser. You don't need a server or a build step. It shows the map and
the balls, and the arrow keys drive whichever ball you pick. **Upload script** loads a JS file that
sets up the balls and controls them. `examples/ui-script.js` is a chaser that respawns the runner
on every tag:

```js
const { generateMap } = require('chase-playground');
module.exports = {
  map: generateMap({ seed: 3 }),          // optional: default is the seed box
  setup(pg) { pg.addBall({ id: 'runner', team: 2 }); pg.addBall({ id: 'chaser', team: 1 }); },
  tick(pg, state) { pg.setKeys('chaser', 'UR'); },   // before every tick; state = pg.state()
};
```

**Reset** rebuilds the map and runs `setup` again. If the script throws, it pauses and shows the error.

## Maps

- `generateMap({ seed, width: 45, height: 45, randLeft: 0.5, randRight: 0.5, diagonals: 0.5 })` is the [BuildAMapWorkshop](https://github.com/BambiTP/BuildAMapWorkshop) generator with a seed. `width` and `height` must be odd.
- `fromAscii(text)` builds a map from text: `#` wall, `.` floor, `◣◤◥◢` 45° walls, and any letter is a floor tile listed in `map.marks`.
- `fromGrid(grid)` takes rows of TagPro tile ids.
- `toAscii(map)` prints a map.

Random spawns go on open tiles in the largest connected area of the map.

## Balls and keys

- `pg.addBall({ id, team, tile: [tx, ty] | pos: [x, y], vel, keys, minDistance })` adds a ball. With no `tile` or `pos` it spawns at random.
- `pg.setKeys(id, 'UR')` sets the keys a ball holds. `'up right'`, `['up', 'right']` and `{ up: true, right: true }` also work, and `''` releases everything.
- `pg.step(keys?)` runs one 60 Hz tick.
- `pg.state()`, `pg.ballState(id)`, `pg.contacts()` and `pg.touching(a, b)` read the world.
- `pg.place(id, x, y, vx, vy)` and `pg.removeBall(id)` move or remove a ball.
- `new Playground({ map, ballCollisions: false })` lets balls pass through each other.

Units are metres and m/s. Tile `(tx, ty)` is centred on `(tx * 0.4, ty * 0.4)`, and TagPro
pixels are metres × 100. A held key adds 0.025 m/s per tick on its axis while the speed on that
axis is under 2.5 m/s. Keys set before tick *n* take effect at the end of tick *n*, the same as
on the real server.
