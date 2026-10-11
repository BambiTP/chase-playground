// parity.test.js - runs the playground and tagpro-local's real game server (engine/game.js
// GameRoom) side by side on the same map with the same key presses, and checks every ball's
// position, velocity, angle and spin are bit-for-bit identical on every tick.
//
// Needs a tagpro-local checkout: $TAGPRO_LOCAL, or ../tagpro-local next to this repo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Playground, generateMap, fromAscii, loadMapFile } = require('..');
const { makeRng } = require('../src/rng');

const TPL = process.env.TAGPRO_LOCAL || path.resolve(__dirname, '../../tagpro-local');
const have = fs.existsSync(path.join(TPL, 'engine/game.js'));
const skip = have ? false : `tagpro-local not found at ${TPL} (set TAGPRO_LOCAL)`;

// the real GameRoom on a map with only walls and floor, everything else stubbed out
// (same harness as tagpro-local's own tools/repro/repro.js)
function realRoom(map, settings = {}) {
  const { GameRoom } = require(path.join(TPL, 'engine/game'));
  const C = require(path.join(TPL, 'engine/constants'));
  const tiles = map.tiles.map((col) => col.map((t) => (Math.floor(t) === 1 || t === 0 ? t : 2)));
  const room = new GameRoom({
    id: 'parity', map: { tiles, info: {}, switches: {}, fields: {}, portals: {}, spawnPoints: {}, marsballs: [] },
    settings, isPrivate: true, now: () => 0,
  });
  room.later = () => null; room.broadcast = () => {}; room.send = () => {}; room.spawnPlayer = () => {}; room.end = () => {};
  room.state = C.STATES.ACTIVE;
  return room;
}

function realBall(room, team, x, y, vx, vy) {
  const V = require(path.join(TPL, 'engine/box2d')).Common.Math.b2Vec2;
  const p = room.newPlayer({ id: 's' + room.nextPlayerId, name: 'p', auth: false }, team);
  room.players[p.id] = p;
  // GameRoom.spawnPlayer's done()
  p.dead = false;
  p.body.SetActive(true);
  p.body.SetPosition(new V(x, y));
  p.body.SetLinearVelocity(new V(0, 0));
  p.body.SetAngularVelocity(0);
  if (vx || vy) p.body.SetLinearVelocity(new V(vx, vy));
  return p;
}

// random key changes: each ball holds a random combo for 1-40 ticks
function keyPlan(n, ticks, seed) {
  const rng = makeRng(seed), plan = [];
  for (let i = 0; i < n; i++) {
    const ev = new Map();
    for (let t = 0; t < ticks;) {
      ev.set(t, { up: rng() < 0.35, down: rng() < 0.35, left: rng() < 0.35, right: rng() < 0.35 });
      t += 1 + Math.floor(rng() * 40);
    }
    plan.push(ev);
  }
  return plan;
}

function compare(map, { balls = 6, ticks = 3600, seed = 1, ballCollisions = true, spawn, minHits = 0 } = {}) {
  const pg = new Playground({ map, seed, ballCollisions });
  for (let i = 0; i < balls; i++) pg.addBall(spawn ? spawn(i) : {});
  const room = realRoom(map, ballCollisions ? {} : { ghostMode: 'noPlayerCollisions' });
  const real = pg.balls.map((b) => {
    const p = b.body.GetPosition(), v = b.body.GetLinearVelocity();
    return realBall(room, b.team, p.x, p.y, v.x, v.y);
  });
  const plan = keyPlan(balls, ticks, seed + 100);
  let hits = 0;
  for (let t = 0; t < ticks; t++) {
    pg.balls.forEach((b, i) => {
      const k = plan[i].get(t);
      if (k) { b.keys = { ...k }; Object.assign(real[i].keys, k); }
    });
    pg.step();
    room.step();
    hits += pg.contacts().length;
    pg.balls.forEach((b, i) => {
      const A = b.body, B = real[i].body;
      const a = [A.GetPosition().x, A.GetPosition().y, A.GetLinearVelocity().x, A.GetLinearVelocity().y, A.GetAngle(), A.GetAngularVelocity()];
      const r = [B.GetPosition().x, B.GetPosition().y, B.GetLinearVelocity().x, B.GetLinearVelocity().y, B.GetAngle(), B.GetAngularVelocity()];
      if (a.some((v, j) => !Object.is(v, r[j]))) {
        assert.fail(`tick ${t + 1}, ball ${b.id}: playground ${JSON.stringify(a)} != tagpro-local ${JSON.stringify(r)}`);
      }
    });
  }
  assert.ok(hits >= minHits, `expected the balls to bump into each other (${hits} contact-ticks)`);
  return { hits, moved: pg.balls.map((b) => b.body.GetPosition()) };
}

test('box2d.js is byte-identical to tagpro-local', { skip }, () => {
  const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  assert.strictEqual(h(path.join(__dirname, '../engine/box2d.js')), h(path.join(TPL, 'engine/box2d.js')));
});

test('physics constants match tagpro-local', { skip }, () => {
  const real = require(path.join(TPL, 'engine/constants')).PHYSICS;
  const ours = require('../src/physics').PHYSICS;
  for (const k of Object.keys(ours)) assert.strictEqual(ours[k], real[k], k);
});

test('generated map (with 45s): identical every tick, 6 balls x 1 minute', { skip }, () => {
  compare(generateMap({ seed: 3, diagonals: 0.9 }), { balls: 6, seed: 3 });
});

test('generated small map, crowded: identical with lots of ball-ball collisions', { skip }, () => {
  compare(generateMap({ seed: 11, width: 25, height: 25, diagonals: 0.9 }), { balls: 10, seed: 11, minHits: 200 });
});

test('ascii box with 45s, balls launched at each other: identical', { skip }, () => {
  const map = fromAscii(`
##########
#◤......◥#
#........#
#...a....#
#........#
#....b...#
#◣......◢#
##########`);
  compare(map, {
    balls: 2, seed: 5, ticks: 1200, minHits: 1,
    spawn: (i) => (i === 0 ? { tile: [3, 3], vel: [3, 2.5] } : { tile: [5, 5], vel: [-4, -3] }),
  });
});

test('ballCollisions: false matches TagPro ghost mode "noPlayerCollisions"', { skip }, () => {
  compare(generateMap({ seed: 21, width: 25, height: 25 }), { balls: 8, seed: 21, ballCollisions: false });
});

const fmDir = path.join(TPL, 'maps');
const fmMaps = have && fs.existsSync(fmDir) ? fs.readdirSync(fmDir).filter((f) => f.endsWith('.png')).sort().slice(0, 3) : [];
for (const f of fmMaps) {
  test(`real TagPro map ${f} (from tagpro-local/maps): identical every tick`, { skip }, () => {
    compare(loadMapFile(path.join(fmDir, f)), { balls: 8, seed: 7, ticks: 2400 });
  });
}
