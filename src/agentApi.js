import express from 'express';

export function createAgentRouter({ readJson, writeJson, getAggregatedFeeds }) {
  const router = express.Router();

  function normalizePanel(p, idx, existing = {}) {
    return {
      id: String(p.id || existing.id || `panel-${Date.now()}-${idx}`),
      title: String(p.title ?? existing.title ?? 'PANEL').trim() || 'PANEL',
      badge: String(p.badge ?? existing.badge ?? 'FEED').trim() || 'FEED',
      badgeColor: ['red', 'green', 'amber', 'kraft'].includes(p.badgeColor ?? existing.badgeColor)
        ? p.badgeColor ?? existing.badgeColor
        : 'amber',
      category: ['youtube', 'audio', 'text'].includes(p.category ?? existing.category)
        ? p.category ?? existing.category
        : 'text',
      backing: (p.backing ?? existing.backing) === 'parchment' ? 'parchment' : 'lined',
      order: idx,
      colSpan: [1, 2, 3].includes(Number(p.colSpan ?? existing.colSpan))
        ? Number(p.colSpan ?? existing.colSpan)
        : 1,
      windowSize: Math.max(1, Math.min(30, Number(p.windowSize ?? existing.windowSize) || 6)),
      feedIds: Array.isArray(p.feedIds ?? existing.feedIds)
        ? (p.feedIds ?? existing.feedIds).map(String)
        : [],
    };
  }

  // Self-documenting API manifest
  router.get('/', (_req, res) => {
    res.json({
      service: 'gettysburg-beacon-agent-api',
      baseUrl: 'https://edit.gettysburgbeacon.com/api/agent',
      auth: 'Gated by Cloudflare Access (Bypass Home Network / hatiroth@gmail.com) + edit.gettysburgbeacon.com host check',
      endpoints: {
        'GET /api/agent/site': 'Full snapshot: layout, feeds, feedStatus, dispatches, about',
        'GET /api/agent/panels': 'List ordered RSS panels',
        'POST /api/agent/panels': 'Create panel { title, badge?, badgeColor?, category, backing?, colSpan?, windowSize?, feedIds? }',
        'PATCH /api/agent/panels/:id': 'Update panel fields partially',
        'DELETE /api/agent/panels/:id': 'Delete panel by id',
        'PUT /api/agent/panels/reorder': 'Reorder panels { ids: string[] }',
        'GET /api/agent/feeds': 'List feeds + live feedStatus',
        'POST /api/agent/feeds': 'Add feed { id?, title, category, url, siteUrl?, enabled? } and refresh',
        'PATCH /api/agent/feeds/:id': 'Update feed fields and refresh',
        'DELETE /api/agent/feeds/:id': 'Delete feed by id',
        'POST /api/agent/feeds/refresh': 'Force refresh all RSS feeds',
        'GET /api/agent/dispatches': 'List dispatches',
        'POST /api/agent/dispatches': 'Create dispatch { kind: "micro"|"post"|"review", title, body, tags?, refItem? }',
        'PATCH /api/agent/dispatches/:id': 'Update dispatch fields',
        'DELETE /api/agent/dispatches/:id': 'Delete dispatch by id',
        'GET /api/agent/about': 'Read calling card / about.json',
        'PATCH /api/agent/about': 'Merge-update fields on about.json',
      },
    });
  });

  // Full snapshot
  router.get('/site', async (_req, res) => {
    const feedData = await getAggregatedFeeds(false);
    const layout = readJson('layout.json');
    if (Array.isArray(layout?.panels)) {
      layout.panels.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    res.json({
      updatedAt: feedData.updatedAt,
      layout,
      feeds: readJson('feeds.json'),
      feedStatus: feedData.status,
      dispatches: readJson('dispatches.json'),
      about: readJson('about.json'),
    });
  });

  // Panels
  router.get('/panels', (_req, res) => {
    const layout = readJson('layout.json');
    const panels = (layout.panels || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    res.json({ panels });
  });

  router.post('/panels', (req, res) => {
    const layout = readJson('layout.json');
    const panels = (layout.panels || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const created = normalizePanel(req.body || {}, panels.length);
    panels.push(created);
    const normalized = panels.map((p, i) => ({ ...p, order: i }));
    writeJson('layout.json', { panels: normalized });
    res.status(201).json({ ok: true, panel: created, panels: normalized });
  });

  router.put('/panels/reorder', (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'Expected { ids: string[] }' });
    }
    const layout = readJson('layout.json');
    const byId = new Map((layout.panels || []).map((p) => [p.id, p]));
    const reordered = [];
    for (const id of ids) {
      if (byId.has(id)) {
        reordered.push(byId.get(id));
        byId.delete(id);
      }
    }
    for (const leftover of byId.values()) {
      reordered.push(leftover);
    }
    const normalized = reordered.map((p, idx) => ({ ...p, order: idx }));
    writeJson('layout.json', { panels: normalized });
    res.json({ ok: true, panels: normalized });
  });

  router.patch('/panels/:id', (req, res) => {
    const layout = readJson('layout.json');
    const panels = (layout.panels || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = panels.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Panel not found' });

    const updated = normalizePanel(req.body || {}, idx, panels[idx]);
    panels[idx] = updated;
    if (req.body?.order !== undefined && Number.isFinite(Number(req.body.order))) {
      const targetIdx = Math.max(0, Math.min(panels.length - 1, Number(req.body.order)));
      const [moved] = panels.splice(idx, 1);
      panels.splice(targetIdx, 0, moved);
    }
    const normalized = panels.map((p, i) => ({ ...p, order: i }));
    writeJson('layout.json', { panels: normalized });
    res.json({ ok: true, panel: updated, panels: normalized });
  });

  router.delete('/panels/:id', (req, res) => {
    const layout = readJson('layout.json');
    const panels = (layout.panels || []).filter((p) => p.id !== req.params.id);
    if (panels.length === (layout.panels || []).length) {
      return res.status(404).json({ error: 'Panel not found' });
    }
    const normalized = panels.map((p, i) => ({ ...p, order: i }));
    writeJson('layout.json', { panels: normalized });
    res.json({ ok: true, panels: normalized });
  });

  // Feeds
  router.get('/feeds', async (_req, res) => {
    const data = await getAggregatedFeeds(false);
    res.json({ feeds: readJson('feeds.json'), feedStatus: data.status, updatedAt: data.updatedAt });
  });

  router.post('/feeds/refresh', async (_req, res) => {
    const data = await getAggregatedFeeds(true);
    res.json({ ok: true, updatedAt: data.updatedAt, feedStatus: data.status, count: data.items.length });
  });

  router.post('/feeds', async (req, res) => {
    const { id, title, category = 'text', url, siteUrl = '', enabled = true } = req.body || {};
    if (!title || !url) {
      return res.status(400).json({ error: 'title and url are required' });
    }
    const feeds = readJson('feeds.json');
    const entry = {
      id: String(id || `feed-${Date.now()}`),
      title: String(title).trim(),
      category: ['youtube', 'audio', 'text'].includes(category) ? category : 'text',
      url: String(url).trim(),
      siteUrl: String(siteUrl || url).trim(),
      enabled: enabled !== false,
    };
    feeds.push(entry);
    writeJson('feeds.json', feeds);
    const data = await getAggregatedFeeds(true);
    res.status(201).json({ ok: true, feed: entry, feedStatus: data.status[entry.id] || null });
  });

  router.patch('/feeds/:id', async (req, res) => {
    const feeds = readJson('feeds.json');
    const idx = feeds.findIndex((f) => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Feed not found' });

    const cur = feeds[idx];
    const body = req.body || {};
    feeds[idx] = {
      ...cur,
      title: body.title !== undefined ? String(body.title).trim() : cur.title,
      category:
        body.category && ['youtube', 'audio', 'text'].includes(body.category)
          ? body.category
          : cur.category,
      url: body.url !== undefined ? String(body.url).trim() : cur.url,
      siteUrl: body.siteUrl !== undefined ? String(body.siteUrl).trim() : cur.siteUrl,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : cur.enabled,
    };
    writeJson('feeds.json', feeds);
    const data = await getAggregatedFeeds(true);
    res.json({ ok: true, feed: feeds[idx], feedStatus: data.status[feeds[idx].id] || null });
  });

  router.delete('/feeds/:id', async (req, res) => {
    const feeds = readJson('feeds.json');
    const next = feeds.filter((f) => f.id !== req.params.id);
    if (next.length === feeds.length) return res.status(404).json({ error: 'Feed not found' });
    writeJson('feeds.json', next);
    const data = await getAggregatedFeeds(true);
    res.json({ ok: true, count: next.length, updatedAt: data.updatedAt });
  });

  // Dispatches
  router.get('/dispatches', (_req, res) => {
    const items = readJson('dispatches.json').sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ items });
  });

  router.post('/dispatches', (req, res) => {
    const { kind = 'micro', title, body, tags = [], refItem = null } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }
    const dispatches = readJson('dispatches.json');
    const entry = {
      id: `disp-${Date.now()}`,
      kind: ['micro', 'post', 'review'].includes(kind) ? kind : 'micro',
      title: String(title).trim(),
      body: String(body),
      createdAt: new Date().toISOString(),
      tags: Array.isArray(tags) ? tags.map(String) : [],
      ...(refItem ? { refItem } : {}),
    };
    dispatches.unshift(entry);
    writeJson('dispatches.json', dispatches);
    res.status(201).json({ ok: true, dispatch: entry });
  });

  router.patch('/dispatches/:id', (req, res) => {
    const dispatches = readJson('dispatches.json');
    const idx = dispatches.findIndex((d) => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Dispatch not found' });

    const cur = dispatches[idx];
    const b = req.body || {};
    dispatches[idx] = {
      ...cur,
      kind: b.kind && ['micro', 'post', 'review'].includes(b.kind) ? b.kind : cur.kind,
      title: b.title !== undefined ? String(b.title).trim() : cur.title,
      body: b.body !== undefined ? String(b.body) : cur.body,
      tags: Array.isArray(b.tags) ? b.tags.map(String) : cur.tags,
      ...(b.refItem !== undefined ? { refItem: b.refItem } : {}),
    };
    writeJson('dispatches.json', dispatches);
    res.json({ ok: true, dispatch: dispatches[idx] });
  });

  router.delete('/dispatches/:id', (req, res) => {
    const dispatches = readJson('dispatches.json');
    const next = dispatches.filter((d) => d.id !== req.params.id);
    if (next.length === dispatches.length) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }
    writeJson('dispatches.json', next);
    res.json({ ok: true, count: next.length });
  });

  // About / Calling card
  router.get('/about', (_req, res) => {
    res.json(readJson('about.json'));
  });

  router.patch('/about', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Expected JSON object' });
    }
    const cur = readJson('about.json');
    const updated = { ...cur, ...req.body };
    writeJson('about.json', updated);
    res.json({ ok: true, about: updated });
  });

  return router;
}
