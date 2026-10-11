const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const cp = require('..');
const { timeline, keysAt } = require('../src/scenario');

const room = cp.fromAscii(['#'.repeat(60), ...Array(10).fill('#' + '.'.repeat(58) + '#'), '#'.repeat(60)]);

test('holding right from rest tops out around 2.5 m/s (TagPro max speed)', () => {
  const pg = new cp.Playground({ map: room });
  pg.addBall({ id: 'a', tile: [2, 5], keys: 'R' });
  let top = 0;
  for (let i = 0; i < 300; i++) { pg.step(); top = Math.max(top, pg.ballState('a').vx); }
  assert.ok(top >= 2.5 && top < 2.5 + 0.025 + 1e-9, `top speed ${top}`);
  assert.strictEqual(pg.ballState('a').vy, 0);
});

test('first tick: the key acceleration lands after the step', () => {
  const pg = new cp.Playground({ map: room });
  pg.addBall({ id: 'a', tile: [2, 5], keys: 'R' });
  pg.step();
  const s = pg.ballState('a');
  assert.strictEqual(s.x, 0.8);      // didn't move during the step
  assert.strictEqual(s.vx, 0.025);   // but now has one tick of acceleration
});

test('same seed, same everything', () => {
  const run = () => {
    const pg = new cp.Playground({ map: cp.generateMap({ seed: 9 }), seed: 4 });
    pg.addBall({ id: 'a' }); pg.addBall({ id: 'b' });
    pg.run(300, (p) => { p.setKeys('a', p.tick % 60 < 30 ? 'UR' : 'DL'); p.setKeys('b', 'L'); });
    return JSON.stringify(pg.state());
  };
  assert.strictEqual(run(), run());
});

test('map generator is deterministic and gives walls, floor and 45s', () => {
  const a = cp.generateMap({ seed: 5 }), b = cp.generateMap({ seed: 5 });
  assert.deepStrictEqual(a.tiles, b.tiles);
  const flat = a.tiles.flat();
  assert.ok(flat.includes(1) && flat.includes(2) && flat.some((t) => t > 1 && t < 2));
  assert.ok(cp.interiorTiles(a).length > 200);
  assert.ok(!cp.generateMap({ seed: 5, diagonals: 0 }).tiles.flat().some((t) => t > 1 && t < 2));
});

test('key scripts', () => {
  assert.deepStrictEqual(cp.parseScript('R30 UR60 _10 L'), [[0, 'R'], [30, 'UR'], [90, ''], [100, 'L']]);
  assert.deepStrictEqual(cp.parseScript('R30 U5'), [[0, 'R'], [30, 'U'], [35, '']]);
  const tl = timeline('R30 UR60');
  assert.strictEqual(cp.keysToString(keysAt(tl, 0)), 'R');
  assert.strictEqual(cp.keysToString(keysAt(tl, 29)), 'R');
  assert.strictEqual(cp.keysToString(keysAt(tl, 30)), 'UR');
  assert.strictEqual(cp.keysToString(keysAt(tl, 90)), '');
  assert.strictEqual(cp.keysToString(keysAt(timeline([[10, 'down left']]), 5)), '');
  assert.strictEqual(cp.keysToString(keysAt(timeline('up left'), 500)), 'UL');
  assert.strictEqual(cp.keysToString(cp.parseKeys({ up: 1, right: true })), 'UR');
  assert.throws(() => cp.parseScript('R UR30'));
});

test('ascii maps: marks, 45s, round trip', () => {
  const m = cp.fromAscii('#####\n#◤c◥#\n#.r.#\n#####');
  assert.deepStrictEqual(m.marks.c, [{ x: 2, y: 1 }]);
  assert.strictEqual(m.tiles[1][1], 1.2);
  assert.strictEqual(cp.toAscii(m), '#####\n#◤.◥#\n#...#\n#####');
});

test('example scenarios all run', async () => {
  const dir = path.join(__dirname, '../scenarios');
  for (const f of require('fs').readdirSync(dir).filter((f) => /\.(js|json)$/.test(f))) {
    const scn = require(path.join(dir, f));
    const r = await cp.runScenario(path.join(dir, f), { trace: false });
    assert.ok(r.ticks > 0, f);
  }
});

test('a bot function steers its ball: a greedy chaser catches a ball that stands still', async () => {
  const r = await cp.runScenario({
    map: { generate: { seed: 2 } }, ticks: 1800, stopWhen: 'tag', seed: 3,
    balls: [{ id: 'runner', team: 2 }, { id: 'chaser', team: 1, minDistance: 8, bot: ({ me, target }) => (target.x > me.x ? 'R' : 'L') + (target.y > me.y ? 'D' : 'U') }],
  }, { trace: false });
  assert.strictEqual(r.stopped, 'tag', 'chaser never reached the runner');
});
