/**
 * SERVER.JS — runs the invitation on your own server (e.g. a Hostinger VPS).
 *
 *  - Serves the built site from ../dist
 *  - Runs the shared wishes wall at /api/wishes:
 *      GET  → every wish, newest first, as JSON [{ name, message, at }]
 *      POST → { name, message } adds one wish
 *    Wishes are saved in ../data/wishes.json, so every guest sees every wish.
 *
 * No extra packages needed: only Node.js 18 or newer.
 *
 *   npm run build     (makes ../dist)
 *   npm start         (starts this server on port 3000)
 *
 * Settings (optional environment variables):
 *   PORT=3000   HOST=127.0.0.1   DATA_FILE=/path/to/wishes.json
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'wishes.json');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// The site's share tags (for the WhatsApp preview) were written for this address;
// they are rewritten on the fly to whatever domain the site is opened on.
const BUILT_FOR = 'https://dona-jithin-engagement-invitation.vercel.app';

const MAX_KEPT = 500;          // wishes kept
const MAX_SENT = 300;          // wishes sent to each guest
const MAX_BODY = 4 * 1024;     // bytes accepted in one wish request
const RATE_LIMIT = 5;          // wishes per visitor ...
const RATE_WINDOW = 10 * 60 * 1000; // ... per 10 minutes

/* ------------------------------------------------------------ wishes store */

let wishes = [];
try {
  const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (Array.isArray(saved)) wishes = saved;
} catch { /* first run: no file yet */ }

// writes go one after another, to a temporary file that then replaces the real one,
// so the file is never left half-written
let writing = Promise.resolve();
function saveWishes() {
  const snapshot = JSON.stringify(wishes);
  writing = writing.then(async () => {
    await fsp.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fsp.writeFile(tmp, snapshot);
    await fsp.rename(tmp, DATA_FILE);
  }).catch((err) => console.error('could not save wishes:', err));
  return writing;
}

const clean = (value, max) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, max);

const hits = new Map(); // visitor → { count, resetAt }
function tooMany(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return false; }
  h.count += 1;
  return h.count > RATE_LIMIT;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (now > h.resetAt) hits.delete(ip); }, RATE_WINDOW).unref();

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleWishes(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') return sendJson(res, 200, wishes.slice(0, MAX_SENT));

  if (req.method === 'POST') {
    let body;
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return sendJson(res, 400, { error: 'Invalid request.' }); }
    const name = clean(body.name, 60) || 'A well-wisher';
    const message = clean(body.message, 500);
    if (!message) return sendJson(res, 400, { error: 'Please write a few words first.' });

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    if (tooMany(ip)) return sendJson(res, 429, { error: 'You have sent lots of love already! Please try again in a few minutes.' });

    const wish = { name, message, at: Date.now() };
    wishes.unshift(wish);
    if (wishes.length > MAX_KEPT) wishes.length = MAX_KEPT;
    await saveWishes();
    return sendJson(res, 201, wish);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

/* ------------------------------------------------------------- the website */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mpeg': 'audio/mpeg',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

async function serveIndex(req, res) {
  let html = await fsp.readFile(path.join(DIST, 'index.html'), 'utf8');
  // WhatsApp needs full addresses for the preview: use the domain the guest opened
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (host) html = html.split(BUILT_FOR).join(`${proto}://${host}`);
  res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : html);
}

async function serveFile(req, res, urlPath) {
  // stay inside dist/ whatever the address asks for
  const file = path.normalize(path.join(DIST, decodeURIComponent(urlPath)));
  if (!file.startsWith(DIST + path.sep)) { res.writeHead(403); return res.end(); }

  let stat;
  try { stat = await fsp.stat(file); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    // addresses without a file extension get the invitation itself
    if (!path.extname(urlPath)) return serveIndex(req, res);
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
  }
  if (path.basename(file) === 'index.html') return serveIndex(req, res);

  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  // built files have a content hash in their name and never change
  const cache = /\/assets\/index-[\w-]+\.(js|css)$/.test(urlPath) ? 'public, max-age=31536000, immutable' : 'public, max-age=604800';
  const headers = { 'Content-Type': type, 'Cache-Control': cache, 'Accept-Ranges': 'bytes', 'Last-Modified': stat.mtime.toUTCString() };

  // phones (iPhone especially) fetch the song in pieces: answer range requests
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : stat.size - 1;
    if (isNaN(start) || start < 0 || start >= stat.size || end < start) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end();
    }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ server */

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = new URL(req.url, 'http://x').pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (urlPath === '/api/wishes') return await handleWishes(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (urlPath === '/') return await serveIndex(req, res);
    return await serveFile(req, res, urlPath);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong.' });
    else res.end();
  }
});

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html not found: run "npm run build" first.');
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.log(`Invitation running at http://${HOST}:${PORT}  (wishes saved in ${DATA_FILE})`);
});

// let the last wish finish saving before stopping
const stop = () => { server.close(); writing.finally(() => process.exit(0)); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
