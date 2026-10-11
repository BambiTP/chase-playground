// maps.js - map grids for the playground. A map is
//   { name, width, height, tiles }   tiles[x][y] = TagPro tile id (column-major, like the real "map" packet)
// Only walls matter to the physics: 1 (square) and 1.1-1.4 (45 degree). Everything else that isn't
// empty space (0) is open floor here: boosts, spikes, gates, flags... do nothing.
// Isomorphic (Node + browser). Node-only file/network loading lives in maps-node.js.
(function () {

// PNG colour -> tile id, same table as tagpro-local engine/mapLoader.js
const COLOR_TO_TILE = {
  '000000': 0, '787878': 1, '408050': 1.2, '405080': 1.3, '807040': 1.1, '804070': 1.4,
  'd4d4d4': 2, 'ff0000': 3, '0000ff': 4, 'ffff00': 5, '00ff00': 6, '373737': 7, 'b97a57': 8,
  '007500': 9, 'ff8000': 10, 'dcbaba': 11, 'bbb8dd': 12, 'cac000': 13, 'ff7373': 14, '7373ff': 15,
  '808000': 16, 'b90000': 17, '190094': 18, 'ff8080': 19, '8080ff': 20, '656500': 21, '202020': 22,
  'dcdcba': 23, 'cc3300': 24, '0066cc': 25,
};
const WALL_SHAPES = [1, 1.1, 1.2, 1.3, 1.4];
const isWall = (t) => WALL_SHAPES.includes(t);

function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }

// image: { width, height, data: RGBA bytes } (pngjs in Node, canvas ImageData in the browser)
function fromImage(image, name) {
  const W = image.width, H = image.height, d = image.data;
  const tiles = [];
  const unknownColors = {};
  for (let x = 0; x < W; x++) {
    tiles[x] = [];
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) { tiles[x][y] = 0; continue; }
      const hex = hex2(d[i]) + hex2(d[i + 1]) + hex2(d[i + 2]);
      let t = COLOR_TO_TILE[hex];
      if (t === undefined) { unknownColors[hex] = (unknownColors[hex] || 0) + 1; t = 0; }
      tiles[x][y] = t;
    }
  }
  return { name: name || 'png', width: W, height: H, tiles, unknownColors };
}

// ASCII maps, one string per row:
//   '#' wall   '.' floor   ' ' or '-' empty space
//   45 degree walls (the wall half is where the corner points):  '◣' or '1'  '◤' or '2'  '◥' or '3'  '◢' or '4'
//   any letter: floor, and its tiles are listed in map.marks[letter] (handy as spawn spots)
const ASCII_TILES = { '#': 1, '.': 2, ' ': 0, '-': 0, '◣': 1.1, '◤': 1.2, '◥': 1.3, '◢': 1.4, 1: 1.1, 2: 1.2, 3: 1.3, 4: 1.4 };
function fromAscii(rows, name) {
  if (typeof rows === 'string') rows = rows.replace(/^\n+|\n+\s*$/g, '').split('\n');
  rows = rows.map((r) => Array.from(r));
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const tiles = [], marks = {};
  for (let x = 0; x < W; x++) {
    tiles[x] = [];
    for (let y = 0; y < H; y++) {
      const c = rows[y][x] === undefined ? ' ' : rows[y][x];
      if (c in ASCII_TILES) tiles[x][y] = ASCII_TILES[c];
      else if (/\p{L}/u.test(c)) { tiles[x][y] = 2; (marks[c] = marks[c] || []).push({ x, y }); }
      else throw new Error(`ascii map: unknown character '${c}' at ${x},${y}`);
    }
  }
  return { name: name || 'ascii', width: W, height: H, tiles, marks };
}

function toAscii(map) {
  const ch = { 0: ' ', 1: '#', 1.1: '◣', 1.2: '◤', 1.3: '◥', 1.4: '◢' };
  const out = [];
  for (let y = 0; y < map.height; y++) {
    let s = '';
    for (let x = 0; x < map.width; x++) { const t = map.tiles[x][y]; s += t in ch ? ch[t] : '.'; }
    out.push(s);
  }
  return out.join('\n');
}

// row-major grid (grid[y][x]) of tile ids -> map
function fromGrid(grid, name) {
  const H = grid.length, W = grid[0].length, tiles = [];
  for (let x = 0; x < W; x++) { tiles[x] = []; for (let y = 0; y < H; y++) tiles[x][y] = grid[y][x]; }
  return { name: name || 'grid', width: W, height: H, tiles };
}

// where balls spawn: the largest connected region of open tiles (not wall, not empty space), so
// every ball can reach every other. Returned as [{x, y}] in tile coordinates.
function interiorTiles(map) {
  const W = map.width, H = map.height, t = map.tiles;
  const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && t[x][y] !== 0 && !isWall(t[x][y]);
  const seen = Array.from({ length: W }, () => new Uint8Array(H));
  let best = [];
  for (let sx = 0; sx < W; sx++) for (let sy = 0; sy < H; sy++) {
    if (seen[sx][sy] || !open(sx, sy)) continue;
    const region = [], stack = [[sx, sy]];
    seen[sx][sy] = 1;
    while (stack.length) {
      const [x, y] = stack.pop();
      region.push({ x, y });
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (open(nx, ny) && !seen[nx][ny]) { seen[nx][ny] = 1; stack.push([nx, ny]); }
      }
    }
    if (region.length > best.length) best = region;
  }
  return best.sort((a, b) => a.x - b.x || a.y - b.y);
}

const api = { COLOR_TO_TILE, isWall, fromImage, fromAscii, toAscii, fromGrid, interiorTiles };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.CPMaps = api;
})();
