// scenario.js - scenarios: a map, some balls, and what each ball presses.
//
// {
//   name: 'my scenario',
//   seed: 1,                            random spawns / random bots
//   map: { generate: { seed: 7, width: 45, height: 45 } }   (or { ascii }, { png, json }, a map)
//   ticks: 600,                         60 ticks = 1 second
//   stopWhen: 'tag',                    optional: 'tag' (any two balls touch) or (pg) => boolean
//   ballCollisions: true,               false = balls pass through each other
//   balls: [
//     { id: 'runner', team: 2, tile: [20, 22], keys: 'R30 UR60 _10 L' },
//     { id: 'chaser', team: 1, bot: 'chase', target: 'runner' },
//   ],
// }
//
// Where a ball starts: tile: [tx, ty] | pos: [x, y] (metres) | mark: 'c' (an ASCII map letter) |
// nothing (random interior tile; minDistance: tiles from the other balls). vel: [vx, vy] m/s.
//
// What a ball presses (pick one):
//   keys: 'R30 UR60 _10 L'      key script: keys + how many ticks to hold them; '_' = nothing,
//                               the last group can leave the count off to hold until the end
//   keys: [[0, 'R'], [30, 'UR'], [90, '']]   from tick N on, hold these keys
//   bot: 'chase' | 'lead' | 'flee' | 'random' | 'idle' | (ctx) => keys   (see bots.js)
//   + any options the bot reads (target, lead, hold)
(function () {
const isNode = typeof module !== 'undefined' && module.exports;
const { Playground, parseKeys, keysToString } = isNode ? require('./world') : globalThis.CPWorld;
const { bots } = isNode ? require('./bots') : globalThis.CPBots;
const { makeRng } = isNode ? require('./rng') : globalThis.CPRng;

// 'R30 UR60 _10 L' -> [[0, 'R'], [30, 'UR'], [90, ''], [100, 'L']]
function parseScript(s) {
  const out = [];
  let t = 0;
  const parts = String(s).trim().split(/\s+/).filter(Boolean);
  parts.forEach((p, i) => {
    const m = /^([UDLRudlr_-]*)(?:[*x]?(\d+))?$/.exec(p);
    if (!m) throw new Error(`bad key script token '${p}' (want e.g. UR30, _10, L)`);
    if (m[2] === undefined && i !== parts.length - 1) throw new Error(`key script token '${p}' needs a tick count (only the last one may hold forever)`);
    out.push([t, m[1].replace(/[_-]/g, '')]);
    t += m[2] === undefined ? Infinity : Number(m[2]);
  });
  if (Number.isFinite(t)) out.push([t, '']);
  return out;
}

// any key timeline form -> sorted [[tick, keysObject], ...]
function timeline(keys) {
  let list;
  if (typeof keys === 'string') list = /^\s*(up|down|left|right)([\s,+]+(up|down|left|right))*\s*$/i.test(keys) ? [[0, keys]] : parseScript(keys);
  else if (Array.isArray(keys) && keys.length && Array.isArray(keys[0])) list = keys;
  else if (keys && typeof keys === 'object' && !Array.isArray(keys) && Object.keys(keys).every((k) => /^\d+$/.test(k))) list = Object.entries(keys).map(([t, k]) => [Number(t), k]);
  else list = [[0, keys]];
  return list.map(([t, k]) => [t, parseKeys(k)]).sort((a, b) => a[0] - b[0]);
}

function keysAt(tl, tick) {
  let cur = tl.length && tl[0][0] <= tick ? tl[0][1] : parseKeys('');
  for (const [t, k] of tl) { if (t <= tick) cur = k; else break; }
  return cur;
}

// scenario + resolved map -> { pg, control } ; control() sets every ball's keys for the coming tick
function createRun(scn, map) {
  const pg = new Playground({ map, ballCollisions: scn.ballCollisions, seed: scn.seed ?? 1 });
  const ctrls = [];
  (scn.balls || []).forEach((spec, i) => {
    const s = Object.assign({}, spec);
    delete s.keys; delete s.bot;
    if (spec.mark) {
      const spots = (map.marks || {})[spec.mark];
      if (!spots || !spots.length) throw new Error(`ball ${spec.id || i}: map has no '${spec.mark}' mark`);
      s.tile = [spots[0].x, spots[0].y];
    }
    const ball = pg.addBall(s);
    if (spec.bot && spec.keys) throw new Error(`ball ${ball.id}: give it keys or a bot, not both`);
    if (spec.bot) {
      const fn = typeof spec.bot === 'function' ? spec.bot : bots[spec.bot];
      if (!fn) throw new Error(`ball ${ball.id}: unknown bot '${spec.bot}' (have: ${Object.keys(bots).join(', ')})`);
      ctrls.push({ ball, bot: fn, opts: spec, rng: makeRng((scn.seed ?? 1) * 7919 + i), state: {} });
    } else if (spec.keys !== undefined) ctrls.push({ ball, tl: timeline(spec.keys) });
  });
  const targetOf = (c) => {
    if (c.opts.target) return c.opts.target;
    const other = pg.balls.find((b) => b !== c.ball && b.team !== c.ball.team) || pg.balls.find((b) => b !== c.ball);
    return other && other.id;
  };
  const control = () => {
    const balls = pg.state().balls;
    for (const c of ctrls) {
      if (c.tl) { c.ball.keys = keysAt(c.tl, pg.tick); continue; }
      const tid = targetOf(c);
      const ctx = { tick: pg.tick, me: balls[c.ball.id], target: tid ? balls[tid] : null, balls, pg, rng: c.rng, opts: c.opts, state: c.state };
      c.ball.keys = parseKeys(c.bot(ctx));
    }
  };
  return { pg, control };
}

// run to the end. opts: { onTick(pg), trace: true|false, every: 1 } -> { ticks, stopped, tag, trace, final }
function runPrepared(scn, map, opts = {}) {
  const { pg, control } = createRun(scn, map);
  const every = opts.every || 1;
  const trace = opts.trace === false ? null : [snap(pg)];
  const ticks = scn.ticks ?? 600;
  let stopped = null, tag = null;
  while (pg.tick < ticks) {
    control();
    pg.step();
    const c = pg.contacts();
    if (c.length && !tag) tag = { tick: pg.tick, balls: c[0] };
    if (trace && pg.tick % every === 0) trace.push(snap(pg));
    if (opts.onTick) opts.onTick(pg);
    if (scn.stopWhen === 'tag' && c.length) { stopped = 'tag'; break; }
    if (typeof scn.stopWhen === 'function' && scn.stopWhen(pg)) { stopped = 'stopWhen'; break; }
  }
  return { name: scn.name, ticks: pg.tick, stopped, tag, trace, final: pg.state(), pg };
}

function snap(pg) {
  const s = pg.state();
  return { tick: s.tick, balls: Object.values(s.balls).map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, keys: b.keys })) };
}

const api = { parseScript, timeline, keysAt, createRun, runPrepared, keysToString };
if (isNode) module.exports = api;
else globalThis.CPScenario = api;
})();
