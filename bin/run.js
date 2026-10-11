#!/usr/bin/env node
// Run a scenario and print what happened.
//   node bin/run.js scenarios/straight-chase.js
//   node bin/run.js scenarios/straight-chase.js --out trace.json    every tick's state (or .csv)
//   node bin/run.js scenarios/straight-chase.js --every 15 --out t.csv
//   node bin/run.js scenarios/straight-chase.js --ticks 300 --map
//   node bin/run.js --map fm:74431        just print a map (also gen:<seed>, file.png, scenario.js)
const fs = require('fs'), path = require('path');
const cp = require('..');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !['--out', '--every', '--ticks'].includes(args[i - 1]));

function mapSpec(s) {
  if (/^fm:\d+$/.test(s)) return { fm: Number(s.slice(3)) };
  if (/^gen:\d+$/.test(s)) return { generate: { seed: Number(s.slice(4)) } };
  if (/\.png$/i.test(s)) return { png: path.resolve(s) };
  return null;
}

(async () => {
  const target = positional[0];
  if (!target) { console.error('usage: node bin/run.js <scenario.js|.json> [--out trace.json|.csv] [--every n] [--ticks n] [--map]\n       node bin/run.js --map <fm:id | gen:seed | map.png>'); process.exit(1); }
  const spec = mapSpec(target);
  if (spec) {
    const map = await cp.resolveMap(spec);
    console.log(`${map.name}  ${map.width}x${map.height}  spawnable tiles: ${cp.interiorTiles(map).length}`);
    console.log(cp.toAscii(map));
    return;
  }
  const file = path.resolve(target);
  const scn = Object.assign({}, require(file));
  if (opt('--ticks')) scn.ticks = Number(opt('--ticks'));
  if (flag('--map')) {
    const map = await cp.resolveMap(scn.map, path.dirname(file));
    console.log(cp.toAscii(map));
  }
  const out = opt('--out');
  const t0 = Date.now();
  const r = await cp.runScenario(scn, { baseDir: path.dirname(file), trace: !!out, every: Number(opt('--every')) || 1 });
  const ms = Date.now() - t0;

  console.log(`${scn.name || path.basename(file)}: ${r.ticks} ticks (${(r.ticks / 60).toFixed(2)} s game time, ran in ${ms} ms)`);
  if (r.tag) console.log(`first touch: tick ${r.tag.tick} (${(r.tag.tick / 60).toFixed(2)} s) ${r.tag.balls.join(' + ')}`);
  else console.log('no touch');
  for (const b of Object.values(r.final.balls)) {
    console.log(`  ${b.id.padEnd(10)} tile (${(b.x / 0.4).toFixed(2)}, ${(b.y / 0.4).toFixed(2)})  v (${b.vx.toFixed(3)}, ${b.vy.toFixed(3)}) m/s  keys ${b.keys || '-'}`);
  }
  if (out) {
    if (/\.csv$/i.test(out)) {
      const rows = ['tick,id,x,y,vx,vy,keys'];
      for (const s of r.trace) for (const b of s.balls) rows.push([s.tick, b.id, b.x, b.y, b.vx, b.vy, b.keys].join(','));
      fs.writeFileSync(out, rows.join('\n') + '\n');
    } else fs.writeFileSync(out, JSON.stringify({ name: r.name, ticks: r.ticks, tag: r.tag, trace: r.trace }));
    console.log(`trace -> ${out} (${r.trace.length} snapshots)`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
