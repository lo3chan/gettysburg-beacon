import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
});

function asArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function textOf(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val).trim();
  if (typeof val === 'object') {
    if ('#text' in val) return String(val['#text']).trim();
    if ('__cdata' in val) return String(val['__cdata']).trim();
  }
  return '';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAtomLink(linkNode) {
  const links = asArray(linkNode);
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate');
  return alt?.['@_href'] || links[0]?.['@_href'] || textOf(links[0]) || '';
}

function formatDuration(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) return str;
  const secs = Number(str);
  if (!Number.isFinite(secs) || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toIso(dateStr) {
  if (!dateStr) return new Date(0).toISOString();
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function normalizeYouTubeEntry(entry, feed) {
  const videoId = textOf(entry['yt:videoId']);
  const mediaGroup = entry['media:group'] || {};
  const thumbNode = asArray(mediaGroup['media:thumbnail'])[0];
  const thumbnailUrl =
    thumbNode?.['@_url'] ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
  const title = textOf(entry.title);
  const url = extractAtomLink(entry.link) || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : feed.siteUrl);
  const publishedAt = toIso(textOf(entry.published) || textOf(entry.updated));
  const excerpt = stripHtml(textOf(mediaGroup['media:description'])).slice(0, 220);

  return {
    id: `${feed.id}:${videoId || url || title}`,
    feedId: feed.id,
    source: feed.title,
    category: 'youtube',
    title,
    url,
    publishedAt,
    excerpt,
    thumbnailUrl,
    videoId,
    audioUrl: '',
    duration: '',
  };
}

function normalizeRssItem(item, feed) {
  const title = stripHtml(textOf(item.title));
  const url = textOf(item.link) || textOf(item.guid) || feed.siteUrl;
  const publishedAt = toIso(textOf(item.pubDate) || textOf(item['dc:date']));
  const rawDesc = textOf(item.description) || textOf(item['content:encoded']) || textOf(item['itunes:summary']);
  const excerpt = stripHtml(rawDesc).slice(0, 240);

  const enclosure = asArray(item.enclosure)[0];
  const encUrl = enclosure?.['@_url'] || '';
  const encType = enclosure?.['@_type'] || '';
  const isAudio = feed.category === 'audio' || encType.startsWith('audio/');
  const duration = formatDuration(textOf(item['itunes:duration']));

  const mediaThumb = asArray(item['media:thumbnail'])[0]?.['@_url'] || asArray(item['media:content'])[0]?.['@_url'] || '';

  return {
    id: `${feed.id}:${textOf(item.guid) || url || title}`,
    feedId: feed.id,
    source: feed.title,
    category: isAudio ? 'audio' : feed.category,
    title,
    url,
    publishedAt,
    excerpt,
    thumbnailUrl: mediaThumb,
    videoId: '',
    audioUrl: isAudio ? encUrl : '',
    duration,
  };
}

function normalizeAtomEntry(entry, feed) {
  if (entry['yt:videoId'] || feed.category === 'youtube') {
    return normalizeYouTubeEntry(entry, feed);
  }
  const title = stripHtml(textOf(entry.title));
  const url = extractAtomLink(entry.link) || feed.siteUrl;
  const publishedAt = toIso(textOf(entry.published) || textOf(entry.updated));
  const excerpt = stripHtml(textOf(entry.summary) || textOf(entry.content)).slice(0, 240);

  return {
    id: `${feed.id}:${textOf(entry.id) || url || title}`,
    feedId: feed.id,
    source: feed.title,
    category: feed.category,
    title,
    url,
    publishedAt,
    excerpt,
    thumbnailUrl: '',
    videoId: '',
    audioUrl: '',
    duration: '',
  };
}

export async function fetchSingleFeed(feed, limit = 8) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GettysburgBeacon/1.0 (+https://gettysburgbeacon.com)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${feed.url}`);
    }
    const xml = await res.text();
    const parsed = parser.parse(xml);

    let items = [];
    if (parsed?.rss?.channel) {
      items = asArray(parsed.rss.channel.item).map((item) => normalizeRssItem(item, feed));
    } else if (parsed?.feed) {
      items = asArray(parsed.feed.entry).map((entry) => normalizeAtomEntry(entry, feed));
    }

    return {
      ok: true,
      feedId: feed.id,
      items: items.slice(0, limit),
    };
  } catch (err) {
    return {
      ok: false,
      feedId: feed.id,
      error: err.message,
      items: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function aggregateFeeds(feeds) {
  const enabled = feeds.filter((f) => f.enabled !== false);
  const results = await Promise.all(enabled.map((f) => fetchSingleFeed(f, 8)));

  const items = [];
  const status = {};
  for (const r of results) {
    status[r.feedId] = { ok: r.ok, count: r.items.length, error: r.error || null };
    items.push(...r.items);
  }

  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return {
    updatedAt: new Date().toISOString(),
    status,
    items,
  };
}
