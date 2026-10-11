#!/usr/bin/env node
// JSON lines over stdin/stdout, for driving the playground from another language (see
// examples/python_client.py). One request per line, one reply per line.
//
//   {"cmd": "reset", "scenario": {...}}        a scenario object (key scripts; bots need a file), or
//   {"cmd": "reset", "file": "scenarios/x.js"} a scenario file
//        -> {"ok": true, "state": {...}, "map": {"width", "height", "tiles"}}
//   {"cmd": "step", "keys": {"chaser": "UR"}, "n": 1}
//        sets those balls' keys (others follow their script/bot), runs n ticks (default 1)
//        -> {"ok": true, "state": {...}, "tagged": true|false}
//   {"cmd": "state"}  -> {"ok": true, "state": {...}}
//
// state: {"tick", "balls": {id: {"x", "y", "vx", "vy", "angle", "spin", "keys"}}, "contacts": [[a, b]]}
// in metres and m/s; tile (tx, ty) is centred on (tx * 0.4, ty * 0.4). Errors: {"ok": false, "error"}.
const path = require('path');
const readline = require('readline');
const cp = require('..');

let run = null;
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');

async function handle(req) {
  if (req.cmd === 'reset') {
    const scn = req.file ? path.resolve(req.file) : req.scenario;
    if (!scn) throw new Error('reset needs "scenario" or "file"');
    run = await cp.prepareScenario(scn);
    const m = run.pg.map;
    return { state: run.pg.state(), map: { name: m.name, width: m.width, height: m.height, tiles: m.tiles } };
  }
  if (!run) throw new Error('send "reset" first');
  if (req.cmd === 'step') {
    let tagged = false;
    for (let i = 0; i < (req.n || 1); i++) {
      run.control();
      if (req.keys) for (const id in req.keys) run.pg.setKeys(id, req.keys[id]);
      run.pg.step();
      if (run.pg.contacts().length) tagged = true;
    }
    return { state: run.pg.state(), tagged };
  }
  if (req.cmd === 'state') return { state: run.pg.state() };
  throw new Error(`unknown cmd '${req.cmd}'`);
}

const rl = readline.createInterface({ input: process.stdin });
let chain = Promise.resolve();
rl.on('line', (line) => {
  if (!line.trim()) return;
  chain = chain.then(async () => {
    try { out(Object.assign({ ok: true }, await handle(JSON.parse(line)))); } catch (e) { out({ ok: false, error: e.message }); }
  });
});
