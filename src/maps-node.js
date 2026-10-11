// maps-node.js - Node-only map loading: TagPro map PNG files.
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const { fromImage, fromAscii } = require('./maps');
const { generateMap } = require('./mapgen');

// some map PNGs carry extra bytes after IEND; browsers ignore them but pngjs throws
function trimPng(buf) {
  const i = buf.lastIndexOf('IEND');
  return i > 0 && i + 8 < buf.length ? buf.subarray(0, i + 8) : buf;
}

function mapFromPngBuffer(buf, json, name) {
  const map = fromImage(PNG.sync.read(trimPng(buf)), name);
  if (json && json.info && json.info.name) map.name = json.info.name;
  if (json && json.info) map.info = json.info;
  return map;
}

// a TagPro map from disk: the .png (and its .json next to it, if any; only the name is used)
function loadMapFile(pngPath, jsonPath) {
  if (!jsonPath) { const j = pngPath.replace(/\.png$/i, '.json'); if (j !== pngPath && fs.existsSync(j)) jsonPath = j; }
  const json = jsonPath ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
  return mapFromPngBuffer(fs.readFileSync(pngPath), json, path.basename(pngPath, '.png'));
}

// scenario map spec -> map. baseDir resolves relative file paths (the scenario file's folder).
//   { generate: { seed, width, height, randLeft, randRight, diagonals } }
//   { ascii: '...' | [rows] }
//   { png: 'maps/x.png', json? }        a TagPro map PNG (BuildAMapWorkshop download, ...)
//   a map object ({ width, height, tiles }) as is
async function resolveMap(spec, baseDir = process.cwd()) {
  if (!spec) return generateMap({ seed: 1 });
  if (spec.tiles && spec.width) return spec;
  if (spec.generate) return generateMap(spec.generate === true ? {} : spec.generate);
  if (spec.ascii) return fromAscii(spec.ascii, spec.name);
  if (spec.png) return loadMapFile(path.resolve(baseDir, spec.png), spec.json && path.resolve(baseDir, spec.json));
  throw new Error('map: want one of { generate }, { ascii }, { png }');
}

module.exports = { loadMapFile, mapFromPngBuffer, resolveMap, trimPng };
