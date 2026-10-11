// chase-playground: TagPro ball movement with the exact default physics, for writing bots.
(() => { // own scope, so ui/index.html can load these files as plain <script> tags
const { Playground, PHYSICS, parseKeys, keysToString } = require('./src/world');
const { fromAscii, toAscii, fromGrid } = require('./src/maps');
const { generateMap } = require('./src/mapgen');

module.exports = { Playground, PHYSICS, parseKeys, keysToString, generateMap, fromAscii, toAscii, fromGrid };
})();
