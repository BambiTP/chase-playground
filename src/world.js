// world.js - the playground: TagPro balls moving on a map's walls, nothing else.
//
// The physics is tagpro-local's GameRoom (engine/game.js) with everything but movement cut out,
// kept in the same order so it stays bit-for-bit identical (test/parity.test.js checks that):
//   - same Box2D build as the official client (engine/box2d.js, vendored unchanged)
//   - walls: one static body per wall tile, square or 45 degree triangle, built column by column
//   - balls: radius 0.19 m circles, created inactive at (-100, -100), then activated where they spawn
//   - each tick: wake every ball, world.Step(1/60, 8, 3), THEN add key acceleration (the real server
//     accelerates after the step; tagpro-local matched replays 99.7% that way vs 94% before it)
//   - a held key adds ac (0.025 m/s) on its axis while the speed on that axis is below ms (2.5 m/s)
//
// Units are Box2D's: metres, m/s, radians. Tile (tx, ty) is centred on (tx * 0.4, ty * 0.4).
// TagPro pixels are metres * 100.
(function () {
const isNode = typeof module !== 'undefined' && module.exports;
const Box2D = isNode ? require('../engine/box2d') : globalThis.Box2D;
const { PHYSICS: PH, ballFilter } = isNode ? require('./physics') : globalThis.CPPhysics;
const { makeRng } = isNode ? require('./rng') : globalThis.CPRng;
const { interiorTiles } = isNode ? require('./maps') : globalThis.CPMaps;
const V = Box2D.Common.Math.b2Vec2;
const KEYS = ['up', 'down', 'left', 'right'];

// keys: { up, down, left, right } | 'UL' | 'up left' | ['up', 'left'] | '' / null (nothing held)
function parseKeys(k) {
  const out = { up: false, down: false, left: false, right: false };
  if (!k) return out;
  if (Array.isArray(k)) { for (const n of k) out[keyName(n)] = true; return out; }
  if (typeof k === 'object') { for (const n of KEYS) out[n] = !!k[n]; return out; }
  const s = String(k).trim();
  if (!s || s === '_' || s === '-') return out;
  const parts = /[\s,+]/.test(s) || s.length > 4 || /^(up|down|left|right)$/i.test(s) ? s.split(/[\s,+]+/) : Array.from(s);
  for (const n of parts) if (n) out[keyName(n)] = true;
  return out;
}
function keyName(n) {
  const k = String(n).toLowerCase();
  const m = { u: 'up', d: 'down', l: 'left', r: 'right', w: 'up', s: 'down', a: 'left' }[k] || k;
  if (!KEYS.includes(m)) throw new Error(`unknown key '${n}' (use up/down/left/right or U/D/L/R)`);
  return m;
}
function keysToString(k) { return (k.up ? 'U' : '') + (k.down ? 'D' : '') + (k.left ? 'L' : '') + (k.right ? 'R' : ''); }

class Playground {
  // opts: { map, ballCollisions: true, seed }
  constructor(opts = {}) {
    if (!opts.map) throw new Error('Playground needs a map');
    this.map = opts.map;
    this.ballCollisions = opts.ballCollisions !== false;
    this.rng = makeRng(opts.seed ?? 1);
    this.tick = 0;
    this.balls = [];
    this.byId = {};
    this.interior = interiorTiles(this.map);
    this.buildWorld();
  }

  buildWorld() {
    this.world = new Box2D.Dynamics.b2World(new V(0, 0), true);
    const fd = new Box2D.Dynamics.b2FixtureDef();
    const bd = new Box2D.Dynamics.b2BodyDef();
    fd.density = 1; fd.friction = PH.WALL_FRICTION; fd.restitution = PH.WALL_RESTITUTION;
    fd.filter.categoryBits = -1;
    bd.type = Box2D.Dynamics.b2Body.b2_staticBody;
    const tiles = this.map.tiles;
    for (let x = 0; x < this.map.width; x++) for (let y = 0; y < this.map.height; y++) {
      const t = tiles[x][y];
      if (Math.floor(t) !== 1) continue;
      fd.shape = new Box2D.Collision.Shapes.b2PolygonShape();
      if (t === 1.1) fd.shape.SetAsArray([new V(-0.2, 0.2), new V(-0.2, -0.2), new V(0.2, 0.2)]);
      else if (t === 1.2) fd.shape.SetAsArray([new V(-0.2, -0.2), new V(0.2, -0.2), new V(-0.2, 0.2)]);
      else if (t === 1.3) fd.shape.SetAsArray([new V(0.2, -0.2), new V(0.2, 0.2), new V(-0.2, -0.2)]);
      else if (t === 1.4) fd.shape.SetAsArray([new V(0.2, 0.2), new V(-0.2, 0.2), new V(0.2, -0.2)]);
      else fd.shape.SetAsBox(0.2, 0.2);
      bd.position.Set(PH.TILE * x, PH.TILE * y);
      this.world.CreateBody(bd).CreateFixture(fd);
    }
  }

  // spec: {
  //   id: 'chaser',                 default 'ball<n>'
  //   team: 1 | 2,                  red/blue; only changes the colour (and the collision category)
  //   tile: [tx, ty]                spawn on a tile's centre, or
  //   pos: [x, y]                   exact position in metres, or neither for a random interior tile
  //   vel: [vx, vy]                 starting velocity, m/s (default 0)
  //   keys: 'UR'                    keys held from the start
  //   minDistance: tiles            random spawn: at least this far from every other ball
  //   ac, ms                        override acceleration / max speed (defaults are TagPro's)
  // }
  addBall(spec = {}) {
    const id = spec.id || 'ball' + (this.balls.length + 1);
    if (this.byId[id]) throw new Error(`duplicate ball id '${id}'`);
    const team = spec.team || (this.balls.length % 2 ? 2 : 1);
    const fd = new Box2D.Dynamics.b2FixtureDef();
    const bd = new Box2D.Dynamics.b2BodyDef();
    fd.density = PH.BALL_DENSITY; fd.friction = PH.BALL_FRICTION; fd.restitution = PH.BALL_RESTITUTION;
    fd.shape = new Box2D.Collision.Shapes.b2CircleShape(PH.BALL_RADIUS);
    const f = ballFilter(team, this.ballCollisions);
    fd.filter.categoryBits = f.categoryBits; fd.filter.maskBits = f.maskBits;
    bd.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
    bd.linearDamping = PH.LINEAR_DAMPING; bd.angularDamping = PH.ANGULAR_DAMPING;
    const body = this.world.CreateBody(bd);
    body.CreateFixture(fd);
    body.SetPosition(new V(-100, -100));
    body.SetActive(false);
    const ball = {
      id, team, body,
      ac: spec.ac ?? PH.ACCEL, ms: spec.ms ?? PH.MAX_SPEED,
      keys: parseKeys(spec.keys),
    };
    body.ball = ball;
    this.balls.push(ball);
    this.byId[id] = ball;
    let at;
    if (spec.pos) at = { x: spec.pos[0] ?? spec.pos.x, y: spec.pos[1] ?? spec.pos.y };
    else if (spec.tile) at = { x: (spec.tile[0] ?? spec.tile.x) * PH.TILE, y: (spec.tile[1] ?? spec.tile.y) * PH.TILE };
    else at = this.randomSpot(ball, spec.minDistance || 0);
    this.place(id, at.x, at.y, spec.vel ? (spec.vel[0] ?? spec.vel.x) : 0, spec.vel ? (spec.vel[1] ?? spec.vel.y) : 0);
    return ball;
  }

  // a random interior tile centre, clear of the other balls and minDistance tiles from them
  // (if the map is too small for minDistance: the free tile farthest from them)
  randomSpot(self, minDistance = 0) {
    if (!this.interior.length) throw new Error('map has no interior floor to spawn on');
    const others = this.balls.filter((b) => b !== self && b.body.IsActive()).map((b) => b.body.GetPosition());
    const gap = (x, y) => Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - x, o.y - y)));
    const free = PH.BALL_RADIUS * 2 + 0.01;
    const want = Math.max(free, minDistance * PH.TILE);
    for (let i = 0; i < 1000; i++) {
      const t = this.interior[Math.floor(this.rng() * this.interior.length)];
      const x = t.x * PH.TILE, y = t.y * PH.TILE;
      if (gap(x, y) >= want) return { x, y };
    }
    let best = null, bestGap = free;
    for (const t of this.interior) {
      const x = t.x * PH.TILE, y = t.y * PH.TILE, d = gap(x, y);
      if (d >= bestGap) { best = { x, y }; bestGap = d; }
    }
    if (!best) throw new Error('no free interior tile left for a ball');
    return best;
  }

  // put a ball somewhere (like a TagPro respawn): stopped, unless a velocity is given
  place(id, x, y, vx = 0, vy = 0) {
    const b = this.ball(id).body;
    b.SetActive(true);
    b.SetPosition(new V(x, y));
    b.SetLinearVelocity(new V(0, 0));
    b.SetAngularVelocity(0);
    if (vx || vy) b.SetLinearVelocity(new V(vx, vy));
  }

  ball(id) {
    const b = typeof id === 'object' ? id : this.byId[id];
    if (!b) throw new Error(`no ball '${id}'`);
    return b;
  }

  setKeys(id, keys) { this.ball(id).keys = parseKeys(keys); }

  // one 60 Hz tick. keys (optional): { ballId: keys } to set before stepping; unlisted balls keep theirs
  step(keys) {
    if (keys) for (const id in keys) this.setKeys(id, keys[id]);
    this.tick++;
    for (const b of this.balls) b.body.SetAwake(true);
    this.world.Step(PH.STEP, PH.VELOCITY_ITERATIONS, PH.POSITION_ITERATIONS);
    for (const b of this.balls) {
      b.body.SetAwake(true);
      const v = b.body.GetLinearVelocity();
      const ms = b.ms, ac = b.ac, k = b.keys;
      if (k.left && v.x > -ms) v.x -= ac;
      if (k.right && v.x < ms) v.x += ac;
      if (k.up && v.y > -ms) v.y -= ac;
      if (k.down && v.y < ms) v.y += ac;
      b.body.SetLinearVelocity(v);
    }
    return this;
  }

  // run n ticks; control(pg) (optional) is called before each tick to set keys
  run(n, control) {
    for (let i = 0; i < n; i++) { if (control) control(this); this.step(); }
    return this;
  }

  ballState(id) {
    const b = this.ball(id), body = b.body, p = body.GetPosition(), v = body.GetLinearVelocity();
    return {
      id: b.id, team: b.team, x: p.x, y: p.y, vx: v.x, vy: v.y,
      angle: body.GetAngle(), spin: body.GetAngularVelocity(), keys: keysToString(b.keys),
    };
  }

  // pairs of balls touching right now, [[idA, idB], ...] (a "tag" in chase terms)
  contacts() {
    const out = [];
    if (this.ballCollisions) {
      for (let c = this.world.GetContactList(); c; c = c.GetNext()) {
        if (!c.IsTouching()) continue;
        const a = c.GetFixtureA().GetBody().ball, b = c.GetFixtureB().GetBody().ball;
        if (a && b) out.push([a.id, b.id]);
      }
      return out;
    }
    for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
      const a = this.balls[i].body.GetPosition(), b = this.balls[j].body.GetPosition();
      if (Math.hypot(a.x - b.x, a.y - b.y) <= PH.BALL_RADIUS * 2) out.push([this.balls[i].id, this.balls[j].id]);
    }
    return out;
  }

  touching(a, b) {
    a = this.ball(a).id; b = this.ball(b).id;
    return this.contacts().some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }

  state() {
    const balls = {};
    for (const b of this.balls) balls[b.id] = this.ballState(b);
    return { tick: this.tick, balls, contacts: this.contacts() };
  }
}

const api = { Playground, parseKeys, keysToString, KEYS };
if (isNode) module.exports = api;
else globalThis.CPWorld = api;
})();
