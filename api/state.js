// Seif's Cut, the web copy: the one copy of the progress that everyone who opens the site sees, kept in Upstash Redis
// (Vercel → the project's Storage tab → Upstash for Redis, connected to this project).
//   GET /api/state   → { v, data }   (v 0 and data null: nothing saved yet)
//   PUT /api/state   { base, data }  → { v }
//                    409 { v } when another device saved after `base`: the page reads that, merges, and saves again
//   A one-time transfer put there by api/import.js comes with GET as `import`; the page merges it in, and its next save
//   says importDone, which clears it.
// No packages: Upstash's REST API through fetch (Node 18 and later).
const DB = require('./_db'), E = DB.env(), { URL_, TOKEN } = E;
const redis = cmd => DB.redis(cmd, E);
const MAX = 512 * 1024;
const KD = 'seifcut:plan', KV = 'seifcut:ver', KI = 'seifcut:import';
// compare-and-set: the write lands only on top of the version the page last read
const CAS = "local v = redis.call('GET', KEYS[2]) or '0' " +
  "if v ~= ARGV[1] then return {0, v} end " +
  "local nv = tostring(tonumber(v) + 1) " +
  "redis.call('SET', KEYS[1], ARGV[2]) redis.call('SET', KEYS[2], nv) return {1, nv}";

function readBody(req) {
  if (req.body !== undefined && req.body !== null) return Promise.resolve(typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body));
  return new Promise((ok, no) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', c => { s += c; if (s.length > MAX + 1024) { no(new Error('too_big')); req.destroy(); } });
    req.on('end', () => ok(s));
    req.on('error', no);
  });
}
module.exports = async function handler(req, res) {
  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  if (!URL_ || !TOKEN) return send(503, { error: 'no_db' });
  try {
    if (req.method === 'GET') {
      const [raw, v, imp] = await redis(['MGET', KD, KV, KI]);
      return send(200, { v: Number(v || 0), data: raw ? JSON.parse(raw) : null, import: imp ? JSON.parse(imp) : null });
    }
    if (req.method === 'PUT') {
      const text = await readBody(req);
      if (text.length > MAX) return send(413, { error: 'too_big' });
      let body;
      try { body = JSON.parse(text); } catch (e) { return send(400, { error: 'bad_json' }); }
      if (!body || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return send(400, { error: 'no_data' });
      const r = await redis(['EVAL', CAS, '2', KD, KV, String(Number(body.base) || 0), JSON.stringify(body.data)]);
      if (Number(r[0]) !== 1) return send(409, { error: 'conflict', v: Number(r[1]) });
      if (body.importDone) await redis(['DEL', KI]);
      return send(200, { v: Number(r[1]) });
    }
    res.setHeader('Allow', 'GET, PUT');
    return send(405, { error: 'method' });
  } catch (e) {
    return send(e && e.message === 'too_big' ? 413 : 502, { error: 'store' });
  }
};
