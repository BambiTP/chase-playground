// mapgen.js - the BuildAMapWorkshop wall generator (github.com/BambiTP/BuildAMapWorkshop,
// index.html: generateWalls, highlightTilesBetweenMatchingYs, Random45sSym), ported line for line
// with Math.random swapped for a seeded RNG and the canvas drawing removed.
//
//   generateMap({ seed, width: 45, height: 45, randLeft: 0.5, randRight: 0.5, diagonals: 0.5 })
//
// width/height must be odd (the workshop's own inputs step by 2). diagonals is the workshop's
// "rand45s" slider; 0 = no 45 degree walls (the workshop only adds them when you press "45's").
const { makeRng } = require('./rng');
const { fromGrid } = require('./maps');

// workshop tile ids (its tileColors) -> TagPro tile ids, matched by PNG colour
const WORKSHOP_TO_TAGPRO = { 0: 0, 1: 1, 2: 2, 3: 10, 4: 14, 5: 15, 6: 5, 7: 11, 8: 12, 9: 23, 10: 3, 11: 4, 12: 16, 13: 6, 14: 1.4, 15: 1.1, 16: 1.3, 17: 1.2 };

function generateWorkshopGrid(opts = {}) {
  const random = makeRng(opts.seed);
  const sizex = opts.width || 45, sizey = opts.height || 45;
  if (sizex % 2 !== 1 || sizey % 2 !== 1 || sizex < 5 || sizey < 5) throw new Error('mapgen: width and height must be odd and at least 5');
  const randLeft = opts.randLeft ?? 0.5, randRight = opts.randRight ?? 0.5;
  const r45 = opts.diagonals ?? 0.5;
  const Xo = -1, Xn = -1, Yo = -1, Yn = -1;

  // ---- generateWalls ----
  const grid = Array(sizey).fill().map(() => Array(sizex).fill(0));
  const insideWalls = [];
  let leftX = (sizex + 1) / 2 - 1;
  let rightX = (sizex + 1) / 2 + 1;
  let leftY = sizey - 1;
  let rightY = sizey - 1;

  grid[sizey - 1][(sizex - 1) / 2] = 1;
  grid[0][(sizex - 1) / 2] = 1;
  insideWalls.push({ x: (sizex - 1) / 2, y: 0 });
  insideWalls.push({ x: (sizex - 1) / 2, y: sizey - 1 });

  grid[sizey - 1][(sizex - 1) / 2 + 1] = 1;
  grid[0][(sizex - 1) / 2 - 1] = 1;
  insideWalls.push({ x: (sizex - 1) / 2 - 1, y: 0 });
  insideWalls.push({ x: (sizex - 1) / 2 + 1, y: sizey - 1 });

  grid[sizey - 1][(sizex - 1) / 2 + 2] = 1;
  grid[0][(sizex - 1) / 2 - 2] = 1;
  insideWalls.push({ x: (sizex - 1) / 2 - 2, y: 0 });
  insideWalls.push({ x: (sizex - 1) / 2 + 2, y: sizey - 1 });

  // left wall
  while (leftX > 0 && leftY > (sizey - 1) / 2) {
    if (random() <= randLeft) {
      leftY--;
      insideWalls.push({ x: leftX, y: leftY });
      insideWalls.push({ x: sizex - leftX + Xo, y: sizey - leftY + Yo });
    } else {
      leftX--;
      insideWalls.push({ x: leftX, y: leftY });
      insideWalls.push({ x: sizex - leftX + Xo, y: sizey - leftY + Yo });
    }
    grid[leftY][leftX] = 1;
    grid[sizey - leftY + Yo][sizex - leftX + Xo] = 1;
  }
  while (leftY > (sizey - 1) / 2) {
    leftY--;
    insideWalls.push({ x: leftX, y: leftY });
    insideWalls.push({ x: sizex - leftX + Xo, y: sizey - leftY + Yo });
    grid[leftY][leftX] = 1;
    grid[sizey - leftY + Yo][sizex - leftX + Xo] = 1;
  }
  while (leftX > 0 && leftY === (sizey - 1) / 2) {
    leftX--;
    insideWalls.push({ x: leftX, y: leftY });
    insideWalls.push({ x: sizex - leftX + Xo, y: sizey - leftY + Yo });
    grid[leftY][leftX] = 1;
    grid[sizey - leftY + Yo][sizex - leftX + Xo] = 1;
  }

  // right wall
  while (rightX < sizex - 1 && rightY > Math.floor((sizey - 1) / 2)) {
    if (random() <= randRight) {
      rightY--;
      insideWalls.push({ x: rightX, y: rightY });
      insideWalls.push({ x: sizex - rightX + Xn, y: sizey - rightY + Yn });
    } else {
      rightX++;
      insideWalls.push({ x: rightX, y: rightY });
      insideWalls.push({ x: sizex - rightX + Xn, y: sizey - rightY + Yn });
    }
    grid[rightY][rightX] = 1;
    grid[sizey - rightY + Yn][sizex - rightX + Xn] = 1;
  }
  if (rightX === sizex - 1 && rightY > Math.floor((sizey - 1) / 2)) {
    while (rightY > Math.floor((sizey + 1) / 2)) {
      rightY--;
      insideWalls.push({ x: rightX, y: rightY });
      insideWalls.push({ x: sizex - rightX + Xn, y: sizey - rightY + Yn });
      grid[rightY][rightX] = 1;
      grid[sizey - rightY + Yn][sizex - rightX + Xn] = 1;
    }
  }
  if (rightY === Math.floor((sizey - 1) / 2) && rightX < sizex - 1) {
    while (rightX < sizex - 1) {
      rightX++;
      insideWalls.push({ x: rightX, y: rightY });
      insideWalls.push({ x: sizex - rightX + Xn, y: sizey - rightY + Yn });
      grid[rightY][rightX] = 1;
      grid[sizey - rightY + Yn][sizex - rightX + Xn] = 1;
    }
  }

  // ---- highlightTilesBetweenMatchingYs: floor between walls on the same row ----
  const wallSet = new Set(insideWalls.map((w) => w.x + ',' + w.y));
  for (let i = 0; i < insideWalls.length; i++) {
    for (let j = i + 1; j < insideWalls.length; j++) {
      if (insideWalls[i].y === insideWalls[j].y) {
        const y = insideWalls[i].y;
        const x1 = Math.min(insideWalls[i].x, insideWalls[j].x);
        const x2 = Math.max(insideWalls[i].x, insideWalls[j].x);
        for (let x = x1 + 1; x < x2; x++) if (!wallSet.has(x + ',' + y)) grid[y][x] = 2;
      }
    }
  }

  // ---- Random45sSym: 45s in the top half, mirrored by 180 degree rotation ----
  if (r45 > 0) {
    const mapping180 = { 17: 14, 14: 17, 16: 15, 15: 16 };
    const half = Math.floor(sizey / 2);
    for (let i = 1; i < half; i++) {
      for (let j = 1; j < sizex - 1; j++) {
        if (grid[i][j] === 2) {
          if (grid[i + 1] && grid[i + 1][j] === 1 && grid[i][j + 1] === 1 && grid[i + 1][j + 1] === 1) {
            if (random() <= r45) grid[i][j] = 14;
          } else if (grid[i + 1] && grid[i + 1][j] === 1 && grid[i + 1][j - 1] === 1 && grid[i][j - 1] === 1) {
            if (random() <= r45) grid[i][j] = 15;
          } else if (grid[i - 1][j] === 1 && grid[i - 1][j - 1] === 1 && grid[i][j - 1] === 1) {
            if (random() <= r45) grid[i][j] = 17;
          } else if (grid[i][j + 1] === 1 && grid[i - 1] && grid[i - 1][j + 1] === 1 && grid[i - 1][j] === 1) {
            if (random() <= r45) grid[i][j] = 16;
          }
        }
      }
    }
    for (let i = 0; i < half; i++) {
      for (let j = 0; j < sizex; j++) {
        if ([14, 15, 16, 17].includes(grid[i][j])) grid[sizey - 1 - i][sizex - 1 - j] = mapping180[grid[i][j]];
      }
    }
  }
  return grid; // grid[y][x], workshop tile ids
}

function generateMap(opts = {}) {
  const grid = generateWorkshopGrid(opts).map((row) => row.map((t) => WORKSHOP_TO_TAGPRO[t]));
  const map = fromGrid(grid, `workshop seed=${opts.seed}`);
  map.generator = Object.assign({ width: 45, height: 45, randLeft: 0.5, randRight: 0.5, diagonals: 0.5 }, opts);
  return map;
}

module.exports = { generateMap };
