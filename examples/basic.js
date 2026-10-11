// Make a map, spawn two balls, hold some keys, read where they are.
//   node examples/basic.js
const { Playground, generateMap, toAscii } = require('..');

const map = generateMap({ seed: 7 });          // a BuildAMapWorkshop map; same seed = same map
console.log(toAscii(map));

const pg = new Playground({ map });
pg.addBall({ id: 'red', team: 1 });            // random open tile
pg.addBall({ id: 'blue', team: 2, minDistance: 10 });

pg.setKeys('red', 'R');                        // hold right
pg.setKeys('blue', 'up left');                 // 'UL' works too
for (let i = 0; i < 120; i++) pg.step();       // 120 ticks = 2 seconds

for (const b of Object.values(pg.state().balls)) {
  console.log(`${b.id}: tile (${(b.x / 0.4).toFixed(2)}, ${(b.y / 0.4).toFixed(2)})  speed (${b.vx.toFixed(2)}, ${b.vy.toFixed(2)}) m/s`);
}
