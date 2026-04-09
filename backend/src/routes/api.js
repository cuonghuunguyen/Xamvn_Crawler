const express = require('express');
const router = express.Router();
const db = require('../db');
const { crawlThread } = require('../crawler');

// In-memory crawl job status (per thread URL)
const crawlJobs = new Map(); // url -> { status, progress, error }

// POST /api/crawl — start crawling a thread
router.post('/crawl', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  // Normalise URL
  let normUrl = url.trim();
  if (!normUrl.startsWith('http')) normUrl = 'https://' + normUrl;

  // Check if already running
  const existing = crawlJobs.get(normUrl);
  if (existing && existing.status === 'running') {
    return res.status(409).json({ error: 'Crawl already in progress for this URL', job: existing });
  }

  // Check if thread already exists and finished
  const existingThread = db.prepare('SELECT * FROM threads WHERE url = ?').get(normUrl);
  if (existingThread && existingThread.status === 'done') {
    return res.json({ message: 'Thread already crawled', thread: existingThread, cached: true });
  }

  // Start crawl job
  const job = { status: 'running', progress: [], error: null };
  crawlJobs.set(normUrl, job);

  // Upsert thread record
  db.prepare(`
    INSERT INTO threads (url, thread_id, status)
    VALUES (?, '', 'running')
    ON CONFLICT(url) DO UPDATE SET status='running'
  `).run(normUrl);

  const threadRow = db.prepare('SELECT id FROM threads WHERE url = ?').get(normUrl);

  // Run crawl asynchronously
  (async () => {
    try {
      const result = await crawlThread(normUrl, (msg) => {
        job.progress.push(msg);
        if (job.progress.length > 100) job.progress.shift();
      });

      // Persist to DB
      const saveThread = db.transaction(() => {
        // Update thread
        db.prepare(`
          UPDATE threads
          SET thread_id = ?, title = ?, page_count = ?, status = 'done', crawled_at = datetime('now')
          WHERE id = ?
        `).run(result.threadId, result.title, result.pageCount, threadRow.id);

        const insertPost = db.prepare(`
          INSERT OR IGNORE INTO posts (thread_id, post_id, author, content)
          VALUES (?, ?, ?, ?)
        `);
        const insertMedia = db.prepare(`
          INSERT OR IGNORE INTO media (thread_id, post_id, url, type, thumbnail, platform, video_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const post of result.posts) {
          insertPost.run(threadRow.id, post.postId, post.author, post.content);
          const postRow = db.prepare('SELECT id FROM posts WHERE thread_id = ? AND post_id = ?')
            .get(threadRow.id, post.postId);
          const postDbId = postRow ? postRow.id : null;

          for (const m of post.media) {
            insertMedia.run(
              threadRow.id,
              postDbId,
              m.url,
              m.type,
              m.thumbnail || null,
              m.platform || null,
              m.video_id || null,
            );
          }
        }
      });

      saveThread();
      job.status = 'done';
      job.result = { threadId: result.threadId, title: result.title };
    } catch (err) {
      job.status = 'error';
      job.error = err.message;
      db.prepare("UPDATE threads SET status = 'error' WHERE id = ?").run(threadRow.id);
    }
  })();

  res.json({ message: 'Crawl started', url: normUrl, jobId: normUrl });
});

// GET /api/crawl/status?url=... — poll job status
router.get('/crawl/status', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  const job = crawlJobs.get(url);
  if (!job) {
    // Check DB
    const t = db.prepare('SELECT status FROM threads WHERE url = ?').get(url);
    if (t) return res.json({ status: t.status, progress: [] });
    return res.status(404).json({ error: 'No crawl job found for this URL' });
  }
  res.json(job);
});

// GET /api/threads — list all crawled threads
router.get('/threads', (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const like = `%${search}%`;

  const threads = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM media WHERE thread_id = t.id AND type = 'image') AS image_count,
      (SELECT COUNT(*) FROM media WHERE thread_id = t.id AND type = 'video') AS video_count
    FROM threads t
    WHERE t.status = 'done' AND (t.title LIKE ? OR t.url LIKE ?)
    ORDER BY t.crawled_at DESC
    LIMIT ? OFFSET ?
  `).all(like, like, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as cnt FROM threads
    WHERE status = 'done' AND (title LIKE ? OR url LIKE ?)
  `).get(like, like).cnt;

  res.json({ threads, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/threads/:id — thread detail
router.get('/threads/:id', (req, res) => {
  const thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json(thread);
});

// DELETE /api/threads/:id — remove a thread and its data
router.delete('/threads/:id', (req, res) => {
  const thread = db.prepare('SELECT id FROM threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  db.prepare('DELETE FROM threads WHERE id = ?').run(req.params.id);
  res.json({ message: 'Thread deleted' });
});

// GET /api/media — get media with filters
router.get('/media', (req, res) => {
  const {
    thread_id,
    type,
    search = '',
    page = 1,
    limit = 50,
    platform,
  } = req.query;

  const conditions = ["t.status = 'done'"];
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

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const media = db.prepare(`
    SELECT m.*, t.title AS thread_title, t.url AS thread_url
    FROM media m
    JOIN threads t ON m.thread_id = t.id
    ${where}
    ORDER BY m.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM media m
    JOIN threads t ON m.thread_id = t.id
    ${where}
  `).get(...params).cnt;

  res.json({ media, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/stats — overall stats
router.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM threads WHERE status = 'done') AS threads,
      (SELECT COUNT(*) FROM media WHERE type = 'image') AS images,
      (SELECT COUNT(*) FROM media WHERE type = 'video') AS videos,
      (SELECT COUNT(*) FROM posts) AS posts
  `).get();
  res.json(stats);
});

module.exports = router;
