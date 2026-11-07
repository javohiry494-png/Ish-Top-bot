// IshTop Mini App serveri. Tashqi kutubxona kerak emas.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const TOKEN = process.env.BOT_TOKEN || '';
const PORT = process.env.PORT || 8000;
const DB = process.env.DB_PATH || path.join(__dirname, 'posts.json');
let posts = [];
try { posts = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) {}

function valid(init) {
  try {
    const p = new URLSearchParams(init);
    const h = p.get('hash');
    p.delete('hash');
    const s = [...p.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + '=' + v).join('\n');
    const key = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const c = crypto.createHmac('sha256', key).update(s).digest('hex');
    if (!h || c.length !== h.length || !crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h))) return null;
    return JSON.parse(p.get('user')).id;
  } catch (e) { return null; }
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'index.html'), (e, d) =>
      e ? send(res, 500, 'index.html topilmadi', 'text/plain') : send(res, 200, d, 'text/html; charset=utf-8'));
  }
  if (req.method === 'GET' && url === '/api/posts') {
    return send(res, 200, posts.slice(0, 200).map(x => x.body));
  }
  if (req.method === 'POST' && url === '/api/posts') {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 20000) req.destroy(); });
    req.on('end', () => {
      let j = {};
      try { j = JSON.parse(b); } catch (e) {}
      const uid = valid(j.initData || '');
      if (!uid) return send(res, 401, { error: 'auth' });
      const p = j.post || {};
      const body = {};
      ['t', 'n', 'c', 'g', 'p', 's', 'ct', 'a'].forEach(k => { body[k] = String(p[k] == null ? '' : p[k]).slice(0, 140); });
      body.k = p.k === 1 ? 1 : 0;
      const day = Date.now() - 86400000;
      if (posts.filter(x => x.uid === uid && x.ts > day).length >= 5) return send(res, 429, { error: 'limit' });
      posts.unshift({ uid, ts: Date.now(), body });
      posts = posts.slice(0, 1000);
      try { fs.writeFileSync(DB, JSON.stringify(posts)); } catch (e) {}
      send(res, 200, { ok: true });
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('IshTop ishga tushdi: ' + PORT));
