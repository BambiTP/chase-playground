// Draw a map by hand, put balls on marked tiles, change keys at set ticks.
//   node examples/ascii-map.js
const { Playground, fromAscii } = require('..');

// '#' wall, '.' floor, ◣◤◥◢ 45s, letters = floor tiles you can spawn on
const map = fromAscii(`
##############
#◤..........◥#
#..a.........#
#.....##.....#
#.....##...b.#
#◣..........◢#
##############`);

const pg = new Playground({ map });
const at = (m) => [map.marks[m][0].x, map.marks[m][0].y];
pg.addBall({ id: 'a', team: 1, tile: at('a') });
pg.addBall({ id: 'b', team: 2, tile: at('b') });

// tick -> keys to switch to
const plan = {
  a: { 0: 'R', 40: 'DR', 80: 'D', 110: '' },
  b: { 0: 'L', 30: 'UL', 90: 'U' },
};

for (let t = 0; t < 180; t++) {
  for (const id in plan) if (plan[id][t] !== undefined) pg.setKeys(id, plan[id][t]);
  pg.step();
  if (pg.touching('a', 'b')) { console.log(`a and b touched at tick ${pg.tick}`); break; }
}
console.log(pg.state().balls);
