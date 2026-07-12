// api/_kv.js — drop-in replacement for `@vercel/kv`, backed by a standard
// Redis connection (Redis Cloud) via ioredis using LOCKER_REDIS_REDIS_URL.
//
// Why this exists: the old Upstash "quartz-kv" store is a REST API reached
// through @vercel/kv. It hit the free-tier 500k requests/month cap, so every
// locker tablet sync started failing with 500 → the panel showed "offline".
// The new database is a real Redis (redis:// connection string), which needs a
// real Redis client, not the REST client.
//
// @vercel/kv (Upstash) automatically JSON-serialises values on write and parses
// them on read. This shim reproduces that behaviour on top of ioredis so every
// existing handler keeps calling kv.get / set / lpush / hset / zadd / … with no
// changes at all. The exported object is named `kv` to match the old import.
//
// The underscore filename prefix keeps Vercel from treating this as its own
// serverless route — it is only ever imported by the real api/* functions.

import Redis from 'ioredis';

const REDIS_URL =
  process.env.LOCKER_REDIS_REDIS_URL ||
  process.env.LOCKER_REDIS_URL ||
  process.env.REDIS_URL ||
  '';

// Reuse a single connection across warm serverless invocations. Stored on
// globalThis so hot reloads / multiple imports share the same socket.
function client() {
  if (globalThis.__qmRedis) return globalThis.__qmRedis;
  if (!REDIS_URL) throw new Error('[kv] LOCKER_REDIS_REDIS_URL is not set');
  const c = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 8000,
    // ioredis reads redis:// vs rediss:// (TLS) straight from the URL scheme,
    // so Redis Cloud endpoints work with no extra options.
  });
  c.on('error', (e) => console.error('[kv] redis error:', e && e.message));
  globalThis.__qmRedis = c;
  return c;
}

// --- serialisation (identical semantics to @vercel/kv) ---
const enc = (v) => JSON.stringify(v);
const dec = (s) => {
  if (s === null || s === undefined) return null;
  try { return JSON.parse(s); } catch { return s; }
};

export const kv = {
  // strings / json
  async get(key) { return dec(await client().get(key)); },
  async set(key, value, opts) {
    const args = [key, enc(value)];
    if (opts) {
      if (opts.ex != null) args.push('EX', opts.ex);
      if (opts.px != null) args.push('PX', opts.px);
      if (opts.exat != null) args.push('EXAT', opts.exat);
      if (opts.pxat != null) args.push('PXAT', opts.pxat);
      if (opts.nx) args.push('NX');
      if (opts.xx) args.push('XX');
    }
    return client().set(...args); // 'OK' when set, null when NX/XX prevents it
  },
  async del(...keys) { return client().del(...keys); },
  async expire(key, seconds) { return client().expire(key, seconds); },
  async incr(key) { return client().incr(key); },

  // lists
  async lpush(key, ...vals) { return client().lpush(key, ...vals.map(enc)); },
  async rpush(key, ...vals) { return client().rpush(key, ...vals.map(enc)); },
  async lpop(key) { return dec(await client().lpop(key)); },
  async rpop(key) { return dec(await client().rpop(key)); },
  async lrange(key, start, stop) {
    return (await client().lrange(key, start, stop)).map(dec);
  },
  async ltrim(key, start, stop) { return client().ltrim(key, start, stop); },
  async lrem(key, count, value) { return client().lrem(key, count, enc(value)); },
  async llen(key) { return client().llen(key); },

  // hashes
  async hset(key, obj) {
    const flat = [];
    for (const [f, v] of Object.entries(obj)) flat.push(f, enc(v));
    return client().hset(key, ...flat);
  },
  async hget(key, field) { return dec(await client().hget(key, field)); },
  async hgetall(key) {
    const raw = await client().hgetall(key);
    if (!raw || Object.keys(raw).length === 0) return null;
    const out = {};
    for (const [f, v] of Object.entries(raw)) out[f] = dec(v);
    return out;
  },
  async hdel(key, ...fields) { return client().hdel(key, ...fields); },

  // sets
  async sadd(key, ...members) { return client().sadd(key, ...members.map(enc)); },
  async srem(key, ...members) { return client().srem(key, ...members.map(enc)); },
  async smembers(key) { return (await client().smembers(key)).map(dec); },
  async scard(key) { return client().scard(key); },

  // sorted sets
  async zadd(key, ...entries) {
    // supports zadd(key, {score, member}) and zadd(key, {score,member}, {score,member}, …)
    const flat = [];
    for (const e of entries) flat.push(e.score, enc(e.member));
    return client().zadd(key, ...flat);
  },
  async zcard(key) { return client().zcard(key); },
  async zremrangebyscore(key, min, max) {
    return client().zremrangebyscore(key, min, max);
  },

  // key ops (used by migration)
  async exists(...keys) { return client().exists(...keys); },
  async keys(pattern) { return client().keys(pattern); },
  async type(key) { return client().type(key); },
  async ttl(key) { return client().ttl(key); },
};

export default kv;
