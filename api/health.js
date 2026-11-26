// GET /api/health: is the database connected, and does it answer? (names of the variables only, never their values)
const { env } = require('./_db');
module.exports = async function handler(req, res) {
  const e = env();
  const out = { ok: false, db: !!e.URL_, urlVar: e.urlVar, tokenVar: e.tokenVar, redis: null };
  if (e.URL_) {
    try {
      const r = await fetch(e.URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + e.TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(['PING']) });
      const j = await r.json().catch(() => ({}));
      out.redis = r.ok && j.result === 'PONG' ? 'ok' : 'error ' + r.status + (j.error ? ': ' + String(j.error).slice(0, 80) : '');
      out.ok = out.redis === 'ok';
    } catch (err) { out.redis = 'error: ' + String(err && err.message || err).slice(0, 80); }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out));
};
