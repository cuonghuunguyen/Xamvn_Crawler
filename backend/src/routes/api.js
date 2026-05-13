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

function isDirectVideoUrl(url) {
  return DIRECT_VIDEO_PATTERN.test(url || '');
}

function normalizeVideoMedia(item) {
  const safeUrl = item.url || '';
  const proxyUrl = `/api/media/proxy?url=${encodeURIComponent(safeUrl)}`;
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
  if (!normalized) return false;
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true; // fe80::/10
  }
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice(7);
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
  const raw = process.env.MEDIA_PROXY_ALLOWLIST || '';
  const allowlist = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) return true;

  const h = String(hostname || '').toLowerCase();
  return allowlist.some((entry) => h === entry || h.endsWith(`.${entry}`));
}

function isVideoLike(contentType, url) {
  const type = String(contentType || '').toLowerCase();
  if (type.startsWith('video/')) return true;
  if (type.includes('application/octet-stream') && isDirectVideoUrl(url)) return true;
  return false;
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

// Job queue — limits concurrent crawls to avoid CPU starvation on Render free tier
const MAX_CONCURRENT = parseInt(process.env.CRAWL_CONCURRENCY || '3', 10);
let activeCrawls = 0;
const crawlQueue = []; // [{ normUrl, cookie, job, threadRowIdResolver }]

function dequeueAndRun() {
  while (activeCrawls < MAX_CONCURRENT && crawlQueue.length > 0) {
    const next = crawlQueue.shift();
    // Update queue positions for remaining items
    crawlQueue.forEach((item, idx) => {
      item.job.queuePosition = idx + 1;
    });
    next.job.queuePosition = null;
    next.run();
  }
}

function runCrawlJob(normUrl, cookie, job, threadRowId) {
  activeCrawls++;
  job.status = 'running';

  (async () => {
    try {
      const result = await crawlThread(normUrl, (msg) => {
        job.progress.push(msg);
        if (job.progress.length > 100) job.progress.shift();
      }, { cookie: cookie || undefined }, async (pagePosts) => {
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
  const { url, cookie } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  if (cookie != null && typeof cookie !== 'string') {
    return res.status(400).json({ error: 'cookie must be a string when provided' });
  }

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

  if (activeCrawls < MAX_CONCURRENT) {
    // Start immediately
    runCrawlJob(normUrl, cookie, job, threadRow.id);
  } else {
    // Enqueue and report position
    job.queuePosition = crawlQueue.length + 1;
    crawlQueue.push({
      normUrl,
      cookie,
      job,
      run: () => runCrawlJob(normUrl, cookie, job, threadRow.id),
    });
  }

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

// GET /api/media/proxy?url=... — stream remote video through backend for restrictive CORS hosts
router.get('/media/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query param required' });
  }

  let target;
  try {
    target = new URL(url);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL' });
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
    const timeout = parseInt(process.env.MEDIA_PROXY_TIMEOUT_MS || '15000', 10);
    const upstream = await axios.get(target.href, {
      responseType: 'stream',
      timeout,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: {
        Range: req.headers.range,
        'User-Agent': 'XamvnCrawlerMediaProxy/1.0',
      },
    });

    if (upstream.status >= 400) {
      if (upstream.data && upstream.data.destroy) upstream.data.destroy();
      return res.status(upstream.status).json({ error: `Upstream returned HTTP ${upstream.status}` });
    }

    const contentType = upstream.headers['content-type'] || 'application/octet-stream';
    if (!isVideoLike(contentType, target.href)) {
      if (upstream.data && upstream.data.destroy) upstream.data.destroy();
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

    upstream.data.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.end();
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
