// chase-playground: TagPro ball movement (exact default physics) for training chase bots.
const path = require('path');
const { Playground, parseKeys, keysToString, KEYS } = require('./src/world');
const { PHYSICS } = require('./src/physics');
const maps = require('./src/maps');
const { generateMap } = require('./src/mapgen');
const { loadMapFile, resolveMap } = require('./src/maps-node');
const { bots, toward } = require('./src/bots');
const scenario = require('./src/scenario');

// load a scenario (object or path to a .js / .json file), resolve its map, run it
// opts: { trace, every, onTick, baseDir (for relative map paths when scn is an object) }
async function runScenario(scn, opts = {}) {
  let baseDir = opts.baseDir || process.cwd();
  if (typeof scn === 'string') { const file = path.resolve(scn); baseDir = path.dirname(file); scn = require(file); }
  const map = await resolveMap(scn.map, baseDir);
  return scenario.runPrepared(scn, map, opts);
}

// a ready Playground for a scenario (map resolved, balls placed); drive it yourself with
// control() (sets scripted/bot keys) and pg.step()
async function prepareScenario(scn, opts = {}) {
  let baseDir = opts.baseDir || process.cwd();
  if (typeof scn === 'string') { const file = path.resolve(scn); baseDir = path.dirname(file); scn = require(file); }
  const map = await resolveMap(scn.map, baseDir);
  return scenario.createRun(scn, map);
}

module.exports = {
  Playground, PHYSICS, KEYS, parseKeys, keysToString,
  generateMap, loadMapFile, resolveMap,
  fromAscii: maps.fromAscii, toAscii: maps.toAscii, fromGrid: maps.fromGrid, interiorTiles: maps.interiorTiles,
  bots, toward,
  parseScript: scenario.parseScript, runScenario, prepareScenario,
};
