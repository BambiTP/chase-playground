// maps-node.js - Node-only map loading: PNG files and Fortunate Maps.
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const { fromImage, fromAscii } = require('./maps');
const { generateMap } = require('./mapgen');

const FM_BASE = process.env.FM_BASE || 'https://fortunatemaps.herokuapp.com';
const FM_CACHE = process.env.FM_CACHE || path.join(__dirname, '..', '.fm-cache');

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

// a map from fortunatemaps.herokuapp.com by its id (the number in /map/<id>), cached in .fm-cache/
async function loadFortunateMap(id, opts = {}) {
  id = String(id).replace(/\D/g, '');
  if (!id) throw new Error('Fortunate Maps id must be a number');
  const dir = opts.cacheDir || FM_CACHE;
  const png = path.join(dir, id + '.png'), json = path.join(dir, id + '.json');
  if (!fs.existsSync(png) || opts.refresh) {
    fs.mkdirSync(dir, { recursive: true });
    for (const [kind, file] of [['png', png], ['json', json]]) {
      let r;
      try { r = await fetch(`${FM_BASE}/${kind}/${id}`); } catch (e) { throw new Error(`Fortunate Maps: couldn't reach ${FM_BASE} (${e.cause ? e.cause.message || e.cause.code : e.message})`); }
      if (!r.ok) { if (kind === 'json') continue; throw new Error(`Fortunate Maps: map ${id} -> HTTP ${r.status}`); }
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
  }
  const map = loadMapFile(png, fs.existsSync(json) ? json : null);
  map.fm = Number(id);
  return map;
}

// scenario map spec -> map. baseDir resolves relative file paths (the scenario file's folder).
//   { generate: { seed, width, height, randLeft, randRight, diagonals } }
//   { ascii: '...' | [rows] }
//   { fm: 12345 }                       Fortunate Maps id
//   { png: 'maps/x.png', json? }        a TagPro map PNG (Fortunate Maps, BuildAMapWorkshop download, ...)
//   a map object ({ width, height, tiles }) as is
async function resolveMap(spec, baseDir = process.cwd()) {
  if (!spec) return generateMap({ seed: 1 });
  if (spec.tiles && spec.width) return spec;
  if (spec.generate) return generateMap(spec.generate === true ? {} : spec.generate);
  if (spec.ascii) return fromAscii(spec.ascii, spec.name);
  if (spec.fm) return loadFortunateMap(spec.fm, spec);
  if (spec.png) return loadMapFile(path.resolve(baseDir, spec.png), spec.json && path.resolve(baseDir, spec.json));
  throw new Error('map: want one of { generate }, { ascii }, { fm }, { png }');
}

module.exports = { loadMapFile, loadFortunateMap, mapFromPngBuffer, resolveMap, trimPng, FM_BASE };
