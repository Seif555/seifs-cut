// Where the Upstash Redis database is: Vercel adds its address and token as environment variables when the database is
// connected to the project. Their names depend on how it was connected: KV_REST_API_URL and KV_REST_API_TOKEN, the same
// with a custom prefix instead of KV (STORAGE_REST_API_URL...), or UPSTASH_REDIS_REST_URL and _TOKEN. Any of those is
// found. Only names are ever reported, never the values.
function env() {
  const keys = Object.keys(process.env).sort((a, b) => a.length - b.length);
  const pairs = [];
  for (const k of keys) {
    for (const [u, t] of [['REST_API_URL', 'REST_API_TOKEN'], ['REDIS_REST_URL', 'REDIS_REST_TOKEN']]) {
      if (!k.endsWith(u)) continue;
      const tk = k.slice(0, k.length - u.length) + t;
      if (/^https?:\/\//.test(process.env[k] || '') && process.env[tk]) pairs.push({ URL_: process.env[k], TOKEN: process.env[tk], urlVar: k, tokenVar: tk });
    }
  }
  // an Upstash address first, if there are several
  pairs.sort((a, b) => (/upstash\.io/.test(b.URL_) ? 1 : 0) - (/upstash\.io/.test(a.URL_) ? 1 : 0));
  return pairs[0] || { URL_: '', TOKEN: '', urlVar: null, tokenVar: null };
}
// one Redis command through Upstash's REST API (`e`: the variables as read when the function started)
async function redis(cmd, e) {
  e = e || env();
  const r = await fetch(e.URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + e.TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'redis ' + r.status);
  return j.result;
}
module.exports = { env, redis };
