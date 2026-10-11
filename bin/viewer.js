#!/usr/bin/env node
// Serves the browser viewer at http://localhost:8060 (PORT to change). It also lists the
// scenarios/ folder for the page.
//   node bin/viewer.js
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8060;
const SERVED = ['engine', 'src', 'viewer', 'scenarios', 'maps'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const send = (code, body, type = 'text/plain') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  try {
    if (url === '/') return send(200, fs.readFileSync(path.join(ROOT, 'viewer/index.html')), TYPES['.html']);
    if (url === '/api/scenarios') {
      const dir = path.join(ROOT, 'scenarios');
      return send(200, JSON.stringify(fs.readdirSync(dir).filter((f) => /\.(js|json)$/.test(f)).sort()), TYPES['.json']);
    }
    const file = path.normalize(path.join(ROOT, url));
    const top = path.relative(ROOT, file).split(path.sep)[0];
    if (!file.startsWith(ROOT + path.sep) || !SERVED.includes(top) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, 'not found');
    send(200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) { send(500, e.message); }
});
server.listen(PORT, () => console.log(`chase-playground viewer: http://localhost:${PORT}`));
