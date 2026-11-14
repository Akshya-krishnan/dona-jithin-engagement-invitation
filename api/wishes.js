/**
 * /api/wishes — the shared wishes wall (a Vercel serverless function).
 *
 * GET  → the newest wishes, as a JSON array of { name, message, at }
 * POST → { name, message } adds one wish (saved with the server's time)
 *
 * Storage: Upstash Redis, connected to the Vercel project from the Vercel
 * dashboard (Storage → Upstash Redis). Vercel then provides the connection
 * details as environment variables, so there is nothing to paste into the code.
 */

const LIST_KEY = 'dj:wishes';
const MAX_KEPT = 500;          // wishes kept in the list
const MAX_SENT = 300;          // wishes sent to each guest
const RATE_LIMIT = 5;          // wishes per visitor ...
const RATE_WINDOW = 10 * 60;   // ... per 10 minutes

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

/** Runs several Redis commands in one round trip via the Upstash REST API. */
async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

const clean = (value, max) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, max);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: 'The wishes wall is not connected to storage yet.' });
  }

  try {
    if (req.method === 'GET') {
      const [items] = await redis([['LRANGE', LIST_KEY, '0', String(MAX_SENT - 1)]]);
      const wishes = (items || [])
        .map((s) => { try { return JSON.parse(s); } catch { return null; } })
        .filter(Boolean);
      return res.status(200).json(wishes);
    }

    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch { return res.status(400).json({ error: 'Invalid request.' }); }

      const name = clean(body.name, 60) || 'A well-wisher';
      const message = clean(body.message, 500);
      if (!message) return res.status(400).json({ error: 'Please write a few words first.' });

      // a few wishes per visitor every 10 minutes keeps the wall free of floods
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const rateKey = `dj:rate:${ip}`;
      const [count] = await redis([['INCR', rateKey], ['EXPIRE', rateKey, String(RATE_WINDOW), 'NX']]);
      if (Number(count) > RATE_LIMIT) {
        return res.status(429).json({ error: 'You have sent lots of love already! Please try again in a few minutes.' });
      }

      const wish = { name, message, at: Date.now() };
      await redis([
        ['LPUSH', LIST_KEY, JSON.stringify(wish)],
        ['LTRIM', LIST_KEY, '0', String(MAX_KEPT - 1)],
      ]);
      return res.status(201).json(wish);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('wishes api:', err);
    return res.status(500).json({ error: 'Could not reach the wishes wall. Please try again.' });
  }
}
