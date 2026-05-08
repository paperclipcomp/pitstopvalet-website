const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

const rateLimitMap = new Map();
const RL_WINDOW_MS = 15 * 60 * 1000;
const RL_MAX = 5;

function rateOK(ip) {
  const now = Date.now();
  const r = rateLimitMap.get(ip) || { count: 0, resetAt: now + RL_WINDOW_MS };
  if (now > r.resetAt) { r.count = 1; r.resetAt = now + RL_WINDOW_MS; }
  else { r.count += 1; }
  rateLimitMap.set(ip, r);
  return r.count <= RL_MAX;
}

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.set('trust proxy', true);

app.post('/api/booking', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!rateOK(ip)) return res.status(429).json({ error: 'Too many requests, please try again later.' });
  const { name, phone, email, service, message } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required.' });
  const entry = {
    ts: new Date().toISOString(), ip, name, phone, email: email || '',
    service: service || '', message: message || ''
  };
  let all = [];
  try { all = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8')); } catch {}
  all.push(entry);
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(all, null, 2));
  console.log('[booking]', entry.ts, name, phone, service || '(no service)');
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.listen(PORT, () => console.log(`Pitstop Valet website on :${PORT}`));
