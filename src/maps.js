// maps.js - a map is { name, width, height, tiles } with tiles[x][y] = TagPro tile id
// (column-major, like TagPro's own map packet). Only walls matter: 1 (square) and 1.1-1.4
// (45 degree). 0 is empty space, anything else is open floor.
const WALLS = [1, 1.1, 1.2, 1.3, 1.4];
const isWall = (t) => WALLS.includes(t);

// One string per row:
//   '#' wall   '.' floor   ' ' empty space
//   45 degree walls, the wall half is the corner it points to:  '◣' or '1'  '◤' or '2'  '◥' or '3'  '◢' or '4'
//   any letter: floor, listed in map.marks[letter] as [{x, y}] (handy spawn spots)
const ASCII = { '#': 1, '.': 2, ' ': 0, '◣': 1.1, '◤': 1.2, '◥': 1.3, '◢': 1.4, 1: 1.1, 2: 1.2, 3: 1.3, 4: 1.4 };
function fromAscii(rows, name = 'ascii') {
  if (typeof rows === 'string') rows = rows.replace(/^\n+|\n+\s*$/g, '').split('\n');
  rows = rows.map((r) => Array.from(r));
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const tiles = [], marks = {};
  for (let x = 0; x < W; x++) {
    tiles[x] = [];
    for (let y = 0; y < H; y++) {
      const c = rows[y][x] ?? ' ';
      if (c in ASCII) tiles[x][y] = ASCII[c];
      else if (/\p{L}/u.test(c)) { tiles[x][y] = 2; (marks[c] = marks[c] || []).push({ x, y }); }
      else throw new Error(`ascii map: unknown character '${c}' at ${x},${y}`);
    }
  }
  return { name, width: W, height: H, tiles, marks };
}

function toAscii(map) {
  const ch = { 0: ' ', 1: '#', 1.1: '◣', 1.2: '◤', 1.3: '◥', 1.4: '◢' };
  const rows = [];
  for (let y = 0; y < map.height; y++) {
    let s = '';
    for (let x = 0; x < map.width; x++) { const t = map.tiles[x][y]; s += t in ch ? ch[t] : '.'; }
    rows.push(s);
  }
  return rows.join('\n');
}

// row-major grid (grid[y][x]) of tile ids -> map
function fromGrid(grid, name = 'grid') {
  const H = grid.length, W = grid[0].length, tiles = [];
  for (let x = 0; x < W; x++) { tiles[x] = []; for (let y = 0; y < H; y++) tiles[x][y] = grid[y][x]; }
  return { name, width: W, height: H, tiles };
}

// where random spawns go: the largest connected area of open tiles, so every ball can reach
// every other one. [{x, y}] in tiles.
function spawnTiles(map) {
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

module.exports = { fromAscii, toAscii, fromGrid, spawnTiles, isWall };
