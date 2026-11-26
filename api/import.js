// One-time transfer (Nov 26): Seif's progress from the Claude version, encrypted in _import.enc.json (the key is not in
// the repo). With the key, this puts it where the page picks it up: the page merges it into the copy here (what the copy
// already has wins) and then clears it. The same transfer is never put there twice.
const crypto = require('crypto');
const { env, redis } = require('./_db');
module.exports = async function handler(req, res) {
  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  if (!env().URL_) return send(503, { error: 'no_db' });
  const k = new URL(req.url, 'http://x').searchParams.get('k') || '';
  if (!/^[a-f0-9]{64}$/.test(k)) return send(400, { error: 'bad_key' });
  let blob;
  try { blob = require('./_import.enc.json'); } catch (e) { return send(404, { error: 'nothing_to_import' }); }
  let json;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(k, 'hex'), Buffer.from(blob.iv, 'base64'));
    d.setAuthTag(Buffer.from(blob.tag, 'base64'));
    json = Buffer.concat([d.update(Buffer.from(blob.data, 'base64')), d.final()]).toString('utf8');
    JSON.parse(json);
  } catch (e) { return send(403, { error: 'bad_key' }); }
  try {
    if ((await redis(['GET', 'seifcut:import-id'])) === blob.id) return send(200, { ok: true, already: true });
    await redis(['SET', 'seifcut:import', json]);
    await redis(['SET', 'seifcut:import-id', blob.id]);
    return send(200, { ok: true, stored: true, bytes: json.length });
  } catch (e) {
    return send(502, { error: 'store' });
  }
};
