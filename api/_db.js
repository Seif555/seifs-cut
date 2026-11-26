// Where the Upstash Redis database is: Vercel adds its address and token as environment variables when the database is
// connected to the project. Their names depend on how it was connected (KV_REST_API_URL, UPSTASH_REDIS_REST_URL, or either
// with a prefix such as STORAGE_), so any of those is found. Only names are ever reported, never the values.
function env() {
  const keys = Object.keys(process.env);
  for (const [u, t] of [['KV_REST_API_URL', 'KV_REST_API_TOKEN'], ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']]) {
    for (const k of keys) {
      if (k !== u && !k.endsWith('_' + u)) continue;
      const tk = k.slice(0, k.length - u.length) + t;
      if (process.env[k] && process.env[tk]) return { URL_: process.env[k], TOKEN: process.env[tk], urlVar: k, tokenVar: tk };
    }
  }
  return { URL_: '', TOKEN: '', urlVar: null, tokenVar: null };
}
module.exports = { env };
