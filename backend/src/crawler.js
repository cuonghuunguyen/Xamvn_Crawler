const axios = require('axios');
const cheerio = require('cheerio');

// Delay helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Normalize a xamvn thread URL and extract thread_id
function parseThreadUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    // Accept any host for xamvn-like forums
    const match = url.pathname.match(/\/threads\/([^/]+)/);
    if (!match) throw new Error('Not a valid thread URL');
    const threadId = match[1].replace(/\/$/, '');
    const base = `${url.protocol}//${url.host}`;
    return { threadId, base };
  } catch (e) {
    throw new Error(`Invalid URL: ${e.message}`);
  }
}

// Build axios instance with browser-like headers
function buildClient() {
  return axios.create({
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    maxRedirects: 5,
  });
}

// Extract media (images + videos) from a cheerio-loaded page
function extractMedia($, baseUrl) {
  const media = [];
  const seen = new Set();

  function addMedia(url, type, extra = {}) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    media.push({ url, type, ...extra });
  }

  // --- Images ---
  // XenForo img tags inside post content
  $('article .bbWrapper img, .message-body img, .post-body img, .bbWrapper img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || '';
    if (!src) return;
    // Resolve relative URLs
    let absUrl = src;
    try {
      absUrl = new URL(src, baseUrl).href;
    } catch (_) {}
    // Skip tiny avatars / icons (typically < 100px)
    const width = parseInt($(el).attr('width') || '9999', 10);
    const height = parseInt($(el).attr('height') || '9999', 10);
    if (width < 80 || height < 80) return;
    // Skip smileys
    if (absUrl.includes('/smilies/') || absUrl.includes('emoji')) return;
    addMedia(absUrl, 'image');
  });

  // Lightbox / attachment images
  $('a[data-fancybox], a[data-lightbox], a.AttachmentLink').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)) {
      let absUrl = href;
      try { absUrl = new URL(href, baseUrl).href; } catch (_) {}
      addMedia(absUrl, 'image');
    }
  });

  // --- Videos ---
  // YouTube embeds
  $('iframe[src*="youtube"], iframe[src*="youtu.be"]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const videoId = extractYouTubeId(src);
    if (videoId) {
      addMedia(`https://www.youtube.com/watch?v=${videoId}`, 'video', {
        platform: 'youtube',
        video_id: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  });

  // YouTube links in text
  $('a[href*="youtube.com/watch"], a[href*="youtu.be/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const videoId = extractYouTubeId(href);
    if (videoId) {
      addMedia(`https://www.youtube.com/watch?v=${videoId}`, 'video', {
        platform: 'youtube',
        video_id: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  });

  // XenForo [MEDIA=youtube] bbcode rendered as divs
  $('[data-media-type="youtube"], .bbMediaWrapper[data-media-key]').each((_, el) => {
    const mediaKey = $(el).attr('data-media-key') || $(el).attr('data-content-url') || '';
    const videoId = extractYouTubeId(mediaKey) || mediaKey;
    if (videoId) {
      addMedia(`https://www.youtube.com/watch?v=${videoId}`, 'video', {
        platform: 'youtube',
        video_id: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  });

  // Generic video tags
  $('video source, video[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src) return;
    let absUrl = src;
    try { absUrl = new URL(src, baseUrl).href; } catch (_) {}
    addMedia(absUrl, 'video', { platform: 'direct' });
  });

  // Streamable / other common platforms
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('streamable.com')) {
      addMedia(src, 'video', { platform: 'streamable' });
    } else if (src.includes('xvideos.com') || src.includes('xhamster.com') || src.includes('pornhub.com')) {
      addMedia(src, 'video', { platform: 'adult' });
    }
  });

  return media;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Extract posts and media from a single page HTML
function parsePage($, baseUrl) {
  const posts = [];

  // XenForo 2.x article-based structure
  const articleSel = 'article.message, .message, .post';
  $(articleSel).each((_, el) => {
    const postId =
      $(el).attr('data-content') ||
      $(el).attr('id') ||
      $(el).attr('data-post-id') ||
      String(Math.random());
    const author =
      $(el).find('[itemprop="name"], .username, .author').first().text().trim() || 'Unknown';
    const content = $(el).find('.bbWrapper, .message-body, .post-body').html() || '';
    const postMedia = extractMedia(cheerio.load(content), baseUrl);

    posts.push({ postId, author, content, media: postMedia });
  });

  return posts;
}

// Get total page count for a thread
function getPageCount($) {
  // XenForo pagination
  let max = 1;
  $('ul.pageNav-main li a, .pageNav a[href]').each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  // Also check nav-page attribute
  $('[data-page]').each((_, el) => {
    const n = parseInt($(el).attr('data-page') || '1', 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

// Get title from page
function getTitle($) {
  return (
    $('h1.p-title-value').text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().trim().split('|')[0].trim() ||
    'Unknown Title'
  );
}

// Main crawl function
async function crawlThread(rawUrl, onProgress) {
  const { threadId, base } = parseThreadUrl(rawUrl);
  const client = buildClient();
  const report = (msg) => onProgress && onProgress(msg);

  report(`Fetching first page of thread ${threadId}…`);

  // Fetch page 1
  let page1Html;
  try {
    const resp = await client.get(`${base}/threads/${threadId}/`);
    page1Html = resp.data;
  } catch (err) {
    const status = err.response ? err.response.status : 'network error';
    throw new Error(`Failed to fetch thread (${status}): ${err.message}`);
  }

  const $1 = cheerio.load(page1Html);
  const title = getTitle($1);
  const pageCount = getPageCount($1);

  report(`Title: "${title}" | Pages: ${pageCount}`);

  const allPosts = parsePage($1, base);

  // Fetch remaining pages
  for (let p = 2; p <= pageCount; p++) {
    report(`Fetching page ${p}/${pageCount}…`);
    await sleep(800); // Polite delay
    try {
      const resp = await client.get(`${base}/threads/${threadId}/page-${p}`);
      const $p = cheerio.load(resp.data);
      const pagePosts = parsePage($p, base);
      allPosts.push(...pagePosts);
    } catch (err) {
      report(`Warning: failed to fetch page ${p}: ${err.message}`);
    }
  }

  // Deduplicate media across all posts
  const mediaUrlsSeen = new Set();
  for (const post of allPosts) {
    post.media = post.media.filter((m) => {
      if (mediaUrlsSeen.has(m.url)) return false;
      mediaUrlsSeen.add(m.url);
      return true;
    });
  }

  return { threadId, title, pageCount, posts: allPosts };
}

module.exports = { crawlThread, parseThreadUrl };
