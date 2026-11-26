import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateFeeds } from './rss.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SEED_DIR = path.join(ROOT_DIR, 'seed');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const PORT = Number(process.env.PORT || 8080);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CACHE_TTL_MS = 15 * 60 * 1000;

fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureDataFile(filename) {
  const target = path.join(DATA_DIR, filename);
  if (!fs.existsSync(target)) {
    const seedPath = path.join(SEED_DIR, filename);
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, target);
    } else {
      fs.writeFileSync(target, '[]', 'utf8');
    }
  }
  return target;
}

function readJson(filename) {
  const filePath = ensureDataFile(filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filename, data) {
  const filePath = ensureDataFile(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let feedCache = null;
let feedCacheTime = 0;
let refreshPromise = null;

async function getAggregatedFeeds(force = false) {
  const now = Date.now();
  if (!force && feedCache && now - feedCacheTime < CACHE_TTL_MS) {
    return feedCache;
  }
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const feeds = readJson('feeds.json');
      const result = await aggregateFeeds(feeds);
      // Merge with previous cache per feedId if an upstream feed temporarily failed
      if (feedCache?.items?.length) {
        const failedIds = new Set(
          Object.entries(result.status)
            .filter(([, s]) => !s.ok)
            .map(([id]) => id)
        );
        if (failedIds.size > 0) {
          const retained = feedCache.items.filter((it) => failedIds.has(it.feedId));
          result.items = [...result.items, ...retained].sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        }
      }
      feedCache = result;
      feedCacheTime = Date.now();
      writeJson('feed-cache.json', result);
      return result;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Warm cache from disk on boot if present
try {
  const cachePath = path.join(DATA_DIR, 'feed-cache.json');
  if (fs.existsSync(cachePath)) {
    feedCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
} catch {
  // ignore corrupt cache
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'ADMIN_TOKEN is not configured on server' });
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'gettysburg-beacon' });
});

// Public API: aggregated RSS feeds
app.get('/api/feeds', async (req, res) => {
  try {
    const force = req.query.refresh === '1';
    const data = await getAggregatedFeeds(force);
    const sources = readJson('feeds.json');
    res.json({
      updatedAt: data.updatedAt,
      sources,
      status: data.status,
      items: data.items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public API: dispatches (microblogs, reviews, blog posts)
app.get('/api/dispatches', (_req, res) => {
  const dispatches = readJson('dispatches.json');
  dispatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ items: dispatches });
});

// Public API: about / business card
app.get('/api/about', (_req, res) => {
  res.json(readJson('about.json'));
});

// Public RSS 2.0 feed of Dispatches
app.get('/rss.xml', (_req, res) => {
  const about = readJson('about.json');
  const dispatches = readJson('dispatches.json').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const siteUrl = about.website || 'https://gettysburgbeacon.com';

  const itemsXml = dispatches
    .map((d) => {
      const link = `${siteUrl}/#dispatch-${encodeURIComponent(d.id)}`;
      const pubDate = new Date(d.createdAt).toUTCString();
      const refHtml = d.refItem
        ? `<p><em>Ref: <a href="${xmlEscape(d.refItem.url)}">${xmlEscape(d.refItem.source)} — ${xmlEscape(d.refItem.title)}</a></em></p>`
        : '';
      return `    <item>
      <title>${xmlEscape(d.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="false">${xmlEscape(d.id)}</guid>
      <pubDate>${xmlEscape(pubDate)}</pubDate>
      <category>${xmlEscape(d.kind)}</category>
      <description>${xmlEscape(refHtml + d.body)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(about.name || 'Gettysburg Beacon')}</title>
    <link>${xmlEscape(siteUrl)}</link>
    <description>${xmlEscape(about.tagline || 'Dispatches and field notes from Gettysburg Beacon')}</description>
    <language>en-us</language>
${itemsXml}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

// Public OPML export of followed feeds
app.get('/opml.xml', (_req, res) => {
  const feeds = readJson('feeds.json').filter((f) => f.enabled !== false);
  const outlines = feeds
    .map(
      (f) =>
        `    <outline text="${xmlEscape(f.title)}" title="${xmlEscape(f.title)}" type="rss" xmlUrl="${xmlEscape(f.url)}" htmlUrl="${xmlEscape(f.siteUrl || '')}" category="${xmlEscape(f.category)}" />`
    )
    .join('\n');

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Gettysburg Beacon Feeds</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`;

  res.setHeader('Content-Type', 'text/x-opml; charset=utf-8');
  res.send(opml);
});

// Admin endpoints (protected by ADMIN_TOKEN)
app.post('/api/admin/dispatches', requireAdmin, (req, res) => {
  const { kind = 'micro', title, body, tags = [], refItem = null } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  const dispatches = readJson('dispatches.json');
  const entry = {
    id: `disp-${Date.now()}`,
    kind,
    title,
    body,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(tags) ? tags : [],
    ...(refItem ? { refItem } : {}),
  };
  dispatches.unshift(entry);
  writeJson('dispatches.json', dispatches);
  res.status(201).json(entry);
});

app.put('/api/admin/feeds', requireAdmin, async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected JSON array of feeds' });
  }
  writeJson('feeds.json', req.body);
  const data = await getAggregatedFeeds(true);
  res.json({ ok: true, count: req.body.length, items: data.items.length });
});

app.put('/api/admin/about', requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Expected JSON object' });
  }
  writeJson('about.json', req.body);
  res.json({ ok: true });
});

app.post('/api/admin/refresh', requireAdmin, async (_req, res) => {
  const data = await getAggregatedFeeds(true);
  res.json({ ok: true, updatedAt: data.updatedAt, count: data.items.length });
});

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gettysburg Beacon listening on :${PORT}`);
  // Background warm-up
  getAggregatedFeeds(false).catch((err) => console.error('Initial feed fetch failed:', err));
});
