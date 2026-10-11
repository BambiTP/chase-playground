// physics.js - TagPro's default ball physics. Every value is copied from tagpro-local
// (engine/constants.js), which took them from the official client's prediction code.
// Units: metres, seconds, m/s. 1 tile = 0.4 m = 40 px; 1 m = 100 px.
(function () {
const PHYSICS = {
  SCALE: 100,            // px per metre
  TILE: 0.4,             // metres per tile
  STEP: 1 / 60,          // one tick
  VELOCITY_ITERATIONS: 8,
  POSITION_ITERATIONS: 3,
  BALL_RADIUS: 0.19,
  BALL_DENSITY: 1,
  BALL_FRICTION: 0.5,
  BALL_RESTITUTION: 0.2,
  LINEAR_DAMPING: 0.5,
  ANGULAR_DAMPING: 0.5,
  WALL_FRICTION: 0.5,
  WALL_RESTITUTION: 0.2,
  MAX_SPEED: 2.5,        // "ms": a key only adds speed on an axis while |v| on it is below this
  ACCEL: 0.025,          // "ac": m/s added per tick per held key
};

// collision filters (tagpro-local engine/constants.js, from the official client's sharedConstants)
const BITS = { RED_PLAYER: 32, BLUE_PLAYER: 64, ALL_PLAYERS: 96, DEFAULT_OBJECTS: 126 };
function ballFilter(team, ballCollisions) {
  const categoryBits = team === 2 ? BITS.BLUE_PLAYER : BITS.RED_PLAYER;
  // ballCollisions false = TagPro's "noPlayerCollisions" ghost mode
  const maskBits = BITS.DEFAULT_OBJECTS & ~(ballCollisions === false ? BITS.ALL_PLAYERS : 0);
  return { categoryBits, maskBits };
}

const api = { PHYSICS, BITS, ballFilter };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.CPPhysics = api;
})();
