const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CACHE_KEY = 'space:current:weather';
const TTL_SECONDS = 60;

async function getCached() {
  const raw = await redis.get(CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function setCached(payload) {
  await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', TTL_SECONDS);
}

module.exports = { redis, getCached, setCached, CACHE_KEY, TTL_SECONDS };
