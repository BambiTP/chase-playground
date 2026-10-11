# chase-playground

TagPro ball movement and nothing else, for training bots to chase. Balls spawn inside a map,
you (or a key script, or your own bot) hold arrow keys, and they move with **TagPro's exact default
physics**. There are no boosts, spikes, flags, powerups or tags. The only collisions are balls
against walls and against each other.

- The physics is [tagpro-local](https://github.com/BambiTP/tagpro-local)'s game server with everything except movement removed. It uses the same Box2D build as the official client, the same constants, and the same tick order. A test runs both engines side by side and checks they match bit for bit.
- Maps come from the [BuildAMapWorkshop](https://github.com/BambiTP/BuildAMapWorkshop) generator (ported here with a seed), any TagPro map PNG, or ASCII you type in.
- Scenarios are small JS files that set the map, where the balls start, and what each ball presses.
- Runs about 700× real time in Node (about 43k ticks/s with 2 balls).

```sh
npm install
npm test                                       # includes the parity test against tagpro-local
npm run viewer                                 # http://localhost:8060: play, watch, record keys
node bin/run.js scenarios/straight-chase.js    # run a scenario
node bin/run.js --map gen:7                    # print a map as ASCII (also file.png)
```

## The physics

These are all default TagPro values. `src/physics.js` holds them, and the test checks them
against tagpro-local's.

| | |
|---|---|
| tick | 1/60 s; Box2D `Step(1/60, 8, 3)` |
| ball | circle, radius 0.19 m, density 1, friction 0.5, restitution 0.2, linear and angular damping 0.5 |
| walls | one static body per wall tile: 0.4 m squares, or triangles for 45° tiles; friction 0.5, restitution 0.2 |
| keys | each held key adds 0.025 m/s per tick on its axis, but only while the speed on that axis is under 2.5 m/s |
| order | wake every ball, run the world step, **then** add key acceleration (the real server does it in this order) |

Units are metres and m/s. Tile `(tx, ty)` is centred on `(tx * 0.4, ty * 0.4)`. TagPro pixels
are metres × 100. Keys you set before tick *n* are applied at the end of tick *n*, so a ball
first moves on tick *n+1*. This is the same as on the real server.

Only walls count: `1` (square) and `1.1`–`1.4` (45°). Every other tile, including boosts,
spikes, gates, portals and team tiles, is plain floor here. In real TagPro, spikes are solid
circles. Here they are not.

## Maps

```js
{ generate: { seed: 7, width: 45, height: 45, randLeft: 0.5, randRight: 0.5, diagonals: 0.5 } }
{ png: 'maps/mymap.png' }           // any TagPro map PNG (e.g. BuildAMapWorkshop "Download PNG")
{ ascii: `
#########
#◤.....◥#
#...c...#
#◣.....◢#
#########` }                        // # wall  . floor  ◣◤◥◢ (or 1 2 3 4) 45s  letters = named floor tiles
```

`generate` is the BuildAMapWorkshop wall generator, ported line for line
(`src/mapgen.js`), with a seeded RNG in place of `Math.random`. Its sliders are the options.
`width` and `height` must be odd. `diagonals: 0` means no 45° walls.

Balls spawn in the **largest connected open area** of the map, so every ball can reach every
other ball. Random spawns land on tile centres.

## Scenarios

```js
// scenarios/straight-chase.js
module.exports = {
  name: 'straight chase',
  seed: 1,                                  // random spawns
  map: { generate: { seed: 7 } },
  ticks: 900,                               // 60 ticks = 1 s
  stopWhen: 'tag',                          // stop when any two balls touch (or (pg) => boolean)
  ballCollisions: true,                     // false = balls pass through each other
  balls: [
    { id: 'runner', team: 2, tile: [22, 22], keys: 'R60 UR45 _15 L' },
    { id: 'chaser', team: 1, tile: [12, 22], keys: 'R90 UR40 R' },
  ],
};
```

**Where a ball starts:** `tile: [tx, ty]`, `pos: [x, y]` (metres), `mark: 'c'` (a letter in an
ASCII map), or leave it out to get a random spot (`minDistance: 10` keeps it at least 10 tiles
from the other balls). Add `vel: [vx, vy]` to give it a starting velocity.

**What a ball presses:**

- `keys: 'R60 UR45 _15 L'`: a key script. Each group is the keys to hold (U D L R, `_` for none) followed by how many ticks to hold them. The last group can leave off the count to hold until the end.
- `keys: [[0, 'R'], [60, 'up right'], [105, '']]`: from tick N on, hold these keys.
- `bot: (ctx) => 'UR'`: your own bot (there are no built-in ones). It is called before every tick with `ctx.me`, `ctx.target` and `ctx.balls[id]` (each has `x, y, vx, vy`), plus `ctx.tick`, a seeded `ctx.rng`, a `ctx.state` object that persists between ticks, `ctx.pg`, and `ctx.opts` (the ball's spec, for your own settings). `ctx.target` is the ball named in `target:`, or else the first ball on the other team. See `scenarios/custom-bot.js`.
- Neither: the ball holds nothing until you set its keys with `pg.setKeys`.

`node bin/run.js <scenario>` prints when the first touch happened and where every ball ended
up. `--out trace.json` (or `.csv`) writes every tick, `--every 15` thins the trace, and
`--ticks` overrides the scenario's length.

### Recording keys in the viewer

`npm run viewer` opens a page where you can pick a map source, choose who drives each ball (you
on arrows or WASD, the scenario's keys or bot, or nothing), and play. It can also load any file in `scenarios/`. Everything
you press is recorded as a key script. **Copy as scenario** gives you a scenario file with the
exact start positions and your keys, and it replays the run bit for bit in Node.

## Using it from code

```js
const cp = require('chase-playground');

const pg = new cp.Playground({ map: cp.generateMap({ seed: 7 }), seed: 1 });
pg.addBall({ id: 'runner', team: 2 });
pg.addBall({ id: 'chaser', team: 1, minDistance: 10 });

for (let t = 0; t < 600; t++) {
  const { balls } = pg.state();
  pg.step({ chaser: myPolicy(balls.chaser, balls.runner), runner: 'L' });
  if (pg.touching('chaser', 'runner')) break;
}
```

Other entry points:

- `cp.runScenario(fileOrObject)` runs a scenario to the end.
- `cp.prepareScenario(...)` returns `{ pg, control }`. Call `control()` to apply the scripted and bot keys, override any ball with `pg.setKeys`, then call `pg.step()`.
- `cp.loadMapFile(png)`, `cp.fromAscii(text)` and `cp.toAscii(map)` load and print maps.

### Python (or any other language)

`node bin/serve.js` speaks JSON lines on stdin/stdout: `reset` takes a scenario, and `step`
takes keys and returns the state. `examples/python_client.py` is a complete example: a
greedy chaser written in Python against a runner on a key script.

## How it's checked against the real code

`test/parity.test.js` loads tagpro-local's actual game server (`engine/game.js` `GameRoom`,
stubbed the same way as tagpro-local's own replay checker). It runs that server and the
playground on the same maps with the same random key presses, and requires every ball's
position, velocity, angle and spin to be **bit-identical on every tick**. It covers:

- generated maps with 45° walls
- a crowded small map with hundreds of ball-to-ball collisions
- an ASCII box where balls are launched into each other
- `ballCollisions: false` compared with TagPro's `noPlayerCollisions` ghost mode
- three real TagPro maps (PNG files from tagpro-local's `maps/`)

It also checks that `engine/box2d.js` is byte-identical to tagpro-local's copy and that the
constants match.

To confirm the test catches real differences, I swapped the movement and the world step. 7 of
the 9 parity tests then failed.

The test needs a tagpro-local checkout next to this repo (`../tagpro-local`) or at
`$TAGPRO_LOCAL`. Without one, those tests are skipped.

tagpro-local is the reference because it has already been fitted to real TagPro. Its engine
reproduces real replays' 250 ms position snapshots in 99.7% of segments (tools/repro in that
repo). That is why key acceleration is applied after the step.

## Layout

```
engine/box2d.js     Box2D exactly as bundled in the official TagPro client (copied from tagpro-local)
src/physics.js      constants
src/world.js        Playground: walls, balls, step, contacts
src/maps.js         PNG colours -> tiles, ASCII maps, spawn area      (browser + Node)
src/mapgen.js       BuildAMapWorkshop generator, seeded               (browser + Node)
src/maps-node.js    PNG files                                         (Node)
src/scenario.js     scenarios, key scripts
bin/run.js          run a scenario from the command line
bin/viewer.js       viewer server
bin/serve.js        JSON-lines bridge
viewer/index.html   the viewer
scenarios/          examples
test/               parity + basics
```
