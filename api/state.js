// Seif's Cut, the web copy: the one copy of the progress that everyone who opens the site sees, kept in Upstash Redis
// (Vercel → the project's Storage tab → Upstash for Redis, connected to this project).
//   GET /api/state   → { v, data }   (v 0 and data null: nothing saved yet)
//   PUT /api/state   { base, data }  → { v }
//                    409 { v } when another device saved after `base`: the page reads that, merges, and saves again
// No packages: Upstash's REST API through fetch (Node 18 and later).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX = 512 * 1024;
const KD = 'seifcut:plan', KV = 'seifcut:ver';
// compare-and-set: the write lands only on top of the version the page last read
const CAS = "local v = redis.call('GET', KEYS[2]) or '0' " +
  "if v ~= ARGV[1] then return {0, v} end " +
  "local nv = tostring(tonumber(v) + 1) " +
  "redis.call('SET', KEYS[1], ARGV[2]) redis.call('SET', KEYS[2], nv) return {1, nv}";

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'redis ' + r.status);
  return j.result;
}
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
      const [raw, v] = await redis(['MGET', KD, KV]);
      return send(200, { v: Number(v || 0), data: raw ? JSON.parse(raw) : null });
    }
    if (req.method === 'PUT') {
      const text = await readBody(req);
      if (text.length > MAX) return send(413, { error: 'too_big' });
      let body;
      try { body = JSON.parse(text); } catch (e) { return send(400, { error: 'bad_json' }); }
      if (!body || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return send(400, { error: 'no_data' });
      const r = await redis(['EVAL', CAS, '2', KD, KV, String(Number(body.base) || 0), JSON.stringify(body.data)]);
      if (Number(r[0]) !== 1) return send(409, { error: 'conflict', v: Number(r[1]) });
      return send(200, { v: Number(r[1]) });
    }
    res.setHeader('Allow', 'GET, PUT');
    return send(405, { error: 'method' });
  } catch (e) {
    return send(e && e.message === 'too_big' ? 413 : 502, { error: 'store' });
  }
};
