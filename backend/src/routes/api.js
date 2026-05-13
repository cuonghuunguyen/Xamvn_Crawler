const express = require('express');
const router = express.Router();
const { run, get, all, ready } = require('../db');
const { crawlThread } = require('../crawler');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');

// In-memory crawl job status (per thread URL)
const crawlJobs = new Map(); // url -> { status, progress, error, queuePosition? }

const DIRECT_VIDEO_PATTERN = /\.(mp4|webm|ogg|m3u8|mov|m4v)(\?|#|$)/i;
const DEFAULT_MEDIA_PROXY_ALLOWLIST = ['files.catbox.moe'];
const MAX_MEDIA_PROXY_TIMEOUT_MS = 60000;
const MEDIA_PROXY_TIMEOUT_MS = (() => {
  const timeoutRaw = parseInt(process.env.MEDIA_PROXY_TIMEOUT_MS || '15000', 10);
  return Number.isFinite(timeoutRaw)
    ? Math.min(Math.max(timeoutRaw, 1000), MAX_MEDIA_PROXY_TIMEOUT_MS)
    : 15000;
})();
const MEDIA_PROXY_ALLOWLIST = (() => {
  const configured = String(process.env.MEDIA_PROXY_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_MEDIA_PROXY_ALLOWLIST, ...configured])];
})();

function isDirectVideoUrl(url) {
  return DIRECT_VIDEO_PATTERN.test(url || '');
}

function normalizeVideoMedia(item) {
  const safeUrl = item.url || '';
  const proxyUrl = item.id ? `/api/media/proxy?media_id=${item.id}` : null;
  const isYoutube = item.platform === 'youtube' && item.video_id;
  const isIframePlatform = ['streamable', 'adult'].includes(item.platform);
  const direct = item.platform === 'direct' || item.platform === 'catbox' || isDirectVideoUrl(safeUrl);

  if (isYoutube) {
    return {
      ...item,
      playback_mode: 'youtube',
      embed_url: `https://www.youtube.com/embed/${item.video_id}`,
      proxy_url: null,
      is_direct_video: false,
    };
  }

  if (isIframePlatform) {
    return {
      ...item,
      playback_mode: 'iframe',
      embed_url: safeUrl,
      proxy_url: proxyUrl,
      is_direct_video: false,
    };
  }

  return {
    ...item,
    playback_mode: 'direct',
    embed_url: null,
    proxy_url: proxyUrl,
    is_direct_video: direct,
  };
}

function normalizeMediaItem(item) {
  if (item.type !== 'video') {
    return {
      ...item,
      playback_mode: null,
      embed_url: null,
      proxy_url: null,
      is_direct_video: false,
    };
  }
  return normalizeVideoMedia(item);
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  const inRange = (start, end) => n >= ipv4ToInt(start) && n <= ipv4ToInt(end);
  return (
    inRange('0.0.0.0', '0.255.255.255') ||
    inRange('10.0.0.0', '10.255.255.255') ||
    inRange('127.0.0.0', '127.255.255.255') ||
    inRange('169.254.0.0', '169.254.255.255') ||
    inRange('172.16.0.0', '172.31.255.255') ||
    inRange('192.168.0.0', '192.168.255.255')
  );
}

function isPrivateIPv6(ip) {
  const normalized = String(ip || '').toLowerCase();
  if (net.isIP(normalized) !== 6) return false;
  const expanded = expandIpv6(normalized);
  if (!expanded) return false;

  if (expanded.value === 1n) return true; // ::1
  if ((expanded.value >> 121n) === 0x7en) return true; // fc00::/7
  if ((expanded.value >> 118n) === 0x3fan) return true; // fe80::/10

  const mappedPrefix = expanded.value >> 32n;
  if (mappedPrefix === 0xffffn) {
    const v4Int = Number(expanded.value & 0xffffffffn);
    const v4 = [
      (v4Int >>> 24) & 255,
      (v4Int >>> 16) & 255,
      (v4Int >>> 8) & 255,
      v4Int & 255,
    ].join('.');
    if (net.isIP(v4) === 4) return isPrivateIPv4(v4);
  }
  return false;
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return false;
}

function isBlockedHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h === '0.0.0.0' ||
    h === '::1'
  );
}

function isAllowedByAllowlist(hostname) {
  const h = String(hostname || '').toLowerCase();
  return MEDIA_PROXY_ALLOWLIST.some((entry) => h === entry || h.endsWith(`.${entry}`));
}

function isVideoLike(contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.startsWith('video/')) return true;
  return false;
}

function cleanupStream(stream) {
  if (!stream) return;
  if (typeof stream.unpipe === 'function') stream.unpipe();
  if (typeof stream.destroy === 'function') stream.destroy();
}

function normalizeIpv4MappedSegment(seg) {
  if (!seg || !seg.includes('.')) return [seg];
  if (net.isIP(seg) !== 4) return null;
  const parts = seg.split('.').map((n) => parseInt(n, 10));
  const high = ((parts[0] << 8) | parts[1]).toString(16);
  const low = ((parts[2] << 8) | parts[3]).toString(16);
  return [high, low];
}

function expandIpv6(input) {
  const raw = String(input || '').split('%')[0];
  const parts = raw.split('::');
  if (parts.length > 2) return null;

  const leftRaw = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const rightRaw = parts[1] ? parts[1].split(':').filter(Boolean) : [];

  const left = [];
  for (const seg of leftRaw) {
    const mapped = normalizeIpv4MappedSegment(seg);
    if (!mapped) return null;
    left.push(...mapped);
  }

  const right = [];
  for (const seg of rightRaw) {
    const mapped = normalizeIpv4MappedSegment(seg);
    if (!mapped) return null;
    right.push(...mapped);
  }

  const hasCompressed = parts.length === 2;
  const zerosToInsert = hasCompressed ? 8 - (left.length + right.length) : 0;
  if (zerosToInsert < 0) return null;

  const hextets = hasCompressed
    ? [...left, ...Array(zerosToInsert).fill('0'), ...right]
    : [...left, ...right];
  if (hextets.length !== 8) return null;

  let value = 0n;
  for (const h of hextets) {
    if (!/^[0-9a-f]{1,4}$/i.test(h)) return null;
    value = (value << 16n) + BigInt(parseInt(h, 16));
  }
  return { value };
}

// Persist a batch of posts (and their media) for a given thread row id
async function savePagePosts(threadRowId, posts) {
  for (const post of posts) {
    try {
      await run(
        `INSERT OR IGNORE INTO posts (thread_id, post_id, author, content) VALUES (?, ?, ?, ?)`,
        [threadRowId, post.postId, post.author, post.content]
      );
      const postRow = await get(
        'SELECT id FROM posts WHERE thread_id = ? AND post_id = ?',
        [threadRowId, post.postId]
      );
      const postDbId = postRow ? postRow.id : null;

      for (const m of post.media) {
        await run(
          `INSERT OR IGNORE INTO media (thread_id, post_id, url, type, thumbnail, platform, video_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [threadRowId, postDbId, m.url, m.type, m.thumbnail || null, m.platform || null, m.video_id || null]
        );
      }
    } catch (_) {
      // skip individual post errors
    }
  }
}

const DEFAULT_CRAWL_PARALLEL = 3;
const MAX_CRAWL_PARALLEL = 10;
let activeCrawls = 0;
const crawlQueue = []; // [{ normUrl, cookie, job, run, parallel }]

function dequeueAndRun() {
  while (crawlQueue.length > 0) {
    const nextParallel = crawlQueue[0].parallel;
    if (activeCrawls >= nextParallel) break;
    const next = crawlQueue.shift();
    // Update queue positions for remaining items
    crawlQueue.forEach((item, idx) => {
      item.job.queuePosition = idx + 1;
    });
    next.job.queuePosition = null;
    next.run();
  }
}

function runCrawlJob(normUrl, cookie, job, threadRowId, crawlOptions = {}) {
  activeCrawls++;
  job.status = 'running';

  (async () => {
    try {
      const options = {
        ...(cookie ? { cookie } : {}),
        ...(Number.isInteger(crawlOptions.maxPages) ? { maxPages: crawlOptions.maxPages } : {}),
        ...(Number.isInteger(crawlOptions.pageDelayMs) ? { pageDelayMs: crawlOptions.pageDelayMs } : {}),
      };
      const result = await crawlThread(normUrl, (msg) => {
        job.progress.push(msg);
        if (job.progress.length > 100) job.progress.shift();
      }, options, async (pagePosts) => {
        await savePagePosts(threadRowId, pagePosts);
      });

      await run(
        `UPDATE threads SET thread_id = ?, title = ?, page_count = ?, status = 'done', crawled_at = datetime('now') WHERE id = ?`,
        [result.threadId, result.title, result.pageCount, threadRowId]
      );

      job.status = 'done';
      job.result = { threadId: result.threadId, title: result.title };
    } catch (err) {
      job.status = 'error';
      job.error = err.message;
      await run("UPDATE threads SET status = 'error' WHERE id = ?", [threadRowId]);
    } finally {
      activeCrawls--;
      dequeueAndRun();
    }
  })();
}

// POST /api/crawl — start crawling a thread
router.post('/crawl', async (req, res) => {
  await ready;
  const { url, cookie, parallel, maxPages, pageDelayMs } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  if (cookie != null && typeof cookie !== 'string') {
    return res.status(400).json({ error: 'cookie must be a string when provided' });
  }
  if (parallel != null && (!Number.isInteger(parallel) || parallel < 1 || parallel > MAX_CRAWL_PARALLEL)) {
    return res.status(400).json({ error: `parallel must be an integer between 1 and ${MAX_CRAWL_PARALLEL}` });
  }
  if (maxPages != null && (!Number.isInteger(maxPages) || maxPages < 1)) {
    return res.status(400).json({ error: 'maxPages must be a positive integer when provided' });
  }
  if (pageDelayMs != null && (!Number.isInteger(pageDelayMs) || pageDelayMs < 0 || pageDelayMs > 60000)) {
    return res.status(400).json({ error: 'pageDelayMs must be an integer between 0 and 60000 when provided' });
  }

  const effectiveParallel = parallel ?? DEFAULT_CRAWL_PARALLEL;

  // Normalise URL
  let normUrl = url.trim();
  if (!normUrl.startsWith('http')) normUrl = 'https://' + normUrl;

  // Check if already running or queued
  const existing = crawlJobs.get(normUrl);
  if (existing && (existing.status === 'running' || existing.status === 'queued')) {
    return res.status(409).json({ error: 'Crawl already in progress for this URL', job: existing });
  }

  // Check if thread already exists and finished
  const existingThread = await get('SELECT * FROM threads WHERE url = ?', [normUrl]);
  if (existingThread && existingThread.status === 'done') {
    return res.json({ message: 'Thread already crawled', thread: existingThread, cached: true });
  }

  // Create job entry
  const job = { status: 'queued', progress: [], error: null, queuePosition: null };
  crawlJobs.set(normUrl, job);

  // Upsert thread record
  await run(
    `INSERT INTO threads (url, thread_id, status) VALUES (?, '', 'running')
     ON CONFLICT(url) DO UPDATE SET status='running'`,
    [normUrl]
  );

  const threadRow = await get('SELECT id FROM threads WHERE url = ?', [normUrl]);

  const crawlOptions = {
    ...(maxPages != null ? { maxPages } : {}),
    ...(pageDelayMs != null ? { pageDelayMs } : {}),
  };

  if (activeCrawls < effectiveParallel) {
    // Start immediately
    runCrawlJob(normUrl, cookie, job, threadRow.id, crawlOptions);
  } else {
    // Enqueue and report position
    job.queuePosition = crawlQueue.length + 1;
    crawlQueue.push({
      normUrl,
      cookie,
      job,
      parallel: effectiveParallel,
      run: () => runCrawlJob(normUrl, cookie, job, threadRow.id, crawlOptions),
    });
  }

  if (activeCrawls < effectiveParallel) dequeueAndRun();

  res.json({ message: job.status === 'running' ? 'Crawl started' : 'Crawl queued', url: normUrl, ...(job.status === 'queued' ? { queuePosition: job.queuePosition } : {}) });
});

// GET /api/crawl/status?url=... — poll job status
router.get('/crawl/status', async (req, res) => {
  await ready;
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  const job = crawlJobs.get(url);
  if (!job) {
    const t = await get('SELECT status FROM threads WHERE url = ?', [url]);
    if (t) return res.json({ status: t.status, progress: [] });
    return res.status(404).json({ error: 'No crawl job found for this URL' });
  }
  res.json({
    status: job.status,
    progress: job.progress || [],
    error: job.error || null,
    queuePosition: job.queuePosition ?? null,
    result: job.result || null,
  });
});

// GET /api/threads — list all crawled threads
router.get('/threads', async (req, res) => {
  await ready;
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const like = `%${search}%`;

  const threads = await all(
    `SELECT t.*,
      (SELECT COUNT(*) FROM media WHERE thread_id = t.id AND type = 'image') AS image_count,
      (SELECT COUNT(*) FROM media WHERE thread_id = t.id AND type = 'video') AS video_count
     FROM threads t
     WHERE t.status = 'done' AND (t.title LIKE ? OR t.url LIKE ?)
     ORDER BY t.crawled_at DESC
     LIMIT ? OFFSET ?`,
    [like, like, parseInt(limit), offset]
  );

  const countRow = await get(
    `SELECT COUNT(*) as cnt FROM threads WHERE status = 'done' AND (title LIKE ? OR url LIKE ?)`,
    [like, like]
  );

  res.json({ threads, total: countRow.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/threads/:id — thread detail
router.get('/threads/:id', async (req, res) => {
  await ready;
  const thread = await get('SELECT * FROM threads WHERE id = ?', [req.params.id]);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json(thread);
});

// DELETE /api/threads/:id — remove a thread and its data
router.delete('/threads/:id', async (req, res) => {
  await ready;
  const thread = await get('SELECT id FROM threads WHERE id = ?', [req.params.id]);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  await run('DELETE FROM threads WHERE id = ?', [req.params.id]);
  res.json({ message: 'Thread deleted' });
});

// GET /api/media — get media with filters
router.get('/media', async (req, res) => {
  await ready;
  const { thread_id, type, search = '', page = 1, limit = 50, platform } = req.query;

  const conditions = ["t.status IN ('done', 'running')"];
  const params = [];

  if (thread_id) {
    conditions.push('m.thread_id = ?');
    params.push(parseInt(thread_id));
  }
  if (type && ['image', 'video'].includes(type)) {
    conditions.push('m.type = ?');
    params.push(type);
  }
  if (platform) {
    conditions.push('m.platform = ?');
    params.push(platform);
  }
  if (search) {
    conditions.push('(m.url LIKE ? OR t.title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const media = await all(
    `SELECT m.*, t.title AS thread_title, t.url AS thread_url
     FROM media m
     JOIN threads t ON m.thread_id = t.id
     ${where}
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const countRow = await get(
    `SELECT COUNT(*) AS cnt FROM media m JOIN threads t ON m.thread_id = t.id ${where}`,
    params
  );

  const normalizedMedia = media.map(normalizeMediaItem);
  res.json({ media: normalizedMedia, total: countRow.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/media/proxy?media_id=... — stream stored remote video through backend for restrictive CORS hosts
router.get('/media/proxy', async (req, res) => {
  await ready;

  const mediaId = parseInt(req.query.media_id, 10);
  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    return res.status(400).json({ error: 'media_id query param required' });
  }

  const mediaRow = await get('SELECT id, url, type FROM media WHERE id = ?', [mediaId]);
  if (!mediaRow || mediaRow.type !== 'video') {
    return res.status(404).json({ error: 'Video media not found' });
  }

  let target;
  try {
    target = new URL(mediaRow.url);
  } catch (_) {
    return res.status(400).json({ error: 'Stored media URL is invalid' });
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }

  if (isBlockedHostname(target.hostname)) {
    return res.status(400).json({ error: 'Blocked hostname' });
  }

  if (!isAllowedByAllowlist(target.hostname)) {
    return res.status(403).json({ error: 'Host is not in MEDIA_PROXY_ALLOWLIST' });
  }

  try {
    const resolved = await dns.lookup(target.hostname, { all: true, verbatim: true });
    if (!resolved || resolved.length === 0) {
      return res.status(400).json({ error: 'Could not resolve target host' });
    }
    if (resolved.some((r) => isPrivateIp(r.address))) {
      return res.status(400).json({ error: 'Target resolves to a private IP' });
    }
  } catch (_) {
    return res.status(400).json({ error: 'Could not resolve target host' });
  }

  try {
    const upstream = await axios.get(target.href, {
      responseType: 'stream',
      timeout: MEDIA_PROXY_TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: {
        Range: req.headers.range,
        'User-Agent': 'XamvnCrawlerMediaProxy/1.0',
      },
    });

    if (upstream.status >= 400) {
      cleanupStream(upstream.data);
      return res.status(upstream.status).json({ error: `Upstream returned HTTP ${upstream.status}` });
    }

    const contentType = upstream.headers['content-type'] || 'application/octet-stream';
    if (!isVideoLike(contentType)) {
      cleanupStream(upstream.data);
      return res.status(415).json({ error: 'Upstream content is not a supported video type' });
    }

    const passthroughHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];

    for (const header of passthroughHeaders) {
      const val = upstream.headers[header];
      if (val != null) res.setHeader(header, val);
    }
    res.setHeader('Cache-Control', 'public, max-age=300');

    upstream.data.on('error', (streamErr) => {
      console.error('Media proxy upstream stream error:', streamErr.message);
      cleanupStream(upstream.data);
      if (!res.headersSent) return res.status(502).end();
      if (!res.writableEnded) res.end();
    });
    res.status(upstream.status);
    upstream.data.pipe(res);
  } catch (err) {
    return res.status(502).json({ error: `Proxy request failed: ${err.message}` });
  }
});

// GET /api/stats — overall stats
router.get('/stats', async (req, res) => {
  await ready;
  const stats = await get(`
    SELECT
      (SELECT COUNT(*) FROM threads WHERE status = 'done') AS threads,
      (SELECT COUNT(*) FROM media WHERE type = 'image') AS images,
      (SELECT COUNT(*) FROM media WHERE type = 'video') AS videos,
      (SELECT COUNT(*) FROM posts) AS posts
  `);
  res.json(stats);
});

module.exports = router;
