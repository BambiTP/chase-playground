// bots.js - built-in controllers. A controller is a function called before every tick:
//   (ctx) => keys      ctx = { tick, me, target, balls, pg, rng, opts }
// me / target / balls[id] are ballState() objects ({ x, y, vx, vy, ... } in metres and m/s).
// keys: anything parseKeys takes ('UR', { up: true }, ['up', 'right'], '' for none).
(function () {

// press toward a point, with a deadzone so it doesn't jitter on top of it
function toward(me, x, y, dead = 0.02) {
  const dx = x - me.x, dy = y - me.y;
  return { left: dx < -dead, right: dx > dead, up: dy < -dead, down: dy > dead };
}

const bots = {
  idle: () => '',

  // straight at the target's current position
  chase: (ctx) => ctx.target ? toward(ctx.me, ctx.target.x, ctx.target.y) : '',

  // at where the target will be in `lead` seconds (opts.lead, default 0.3)
  lead: (ctx) => {
    const t = ctx.target; if (!t) return '';
    const s = ctx.opts.lead ?? 0.3;
    return toward(ctx.me, t.x + t.vx * s, t.y + t.vy * s);
  },

  // straight away from the target
  flee: (ctx) => {
    const t = ctx.target; if (!t) return '';
    return toward(ctx.me, 2 * ctx.me.x - t.x, 2 * ctx.me.y - t.y);
  },

  // a random key combo (including none), held for opts.hold ticks (default 20)
  random: (ctx) => {
    const hold = ctx.opts.hold || 20;
    if (ctx.tick % hold === 0 || !ctx.state.keys) {
      const h = Math.floor(ctx.rng() * 3), v = Math.floor(ctx.rng() * 3);
      ctx.state.keys = (h === 1 ? 'L' : h === 2 ? 'R' : '') + (v === 1 ? 'U' : v === 2 ? 'D' : '');
    }
    return ctx.state.keys;
  },
};

const api = { bots, toward };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.CPBots = api;
})();
