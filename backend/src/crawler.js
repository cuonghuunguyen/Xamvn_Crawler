const axios = require('axios');
const cheerio = require('cheerio');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
function buildClient(baseUrl, options = {}) {
  const cookie = options.cookie || process.env.XAMVN_COOKIE || '';
  return axios.create({
    timeout: 20000,
    headers: {
      'User-Agent':
        DEFAULT_USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      Referer: `${baseUrl}/`,
      Origin: baseUrl,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    maxRedirects: 5,
  });
}

function isCloudflareChallenge(err) {
  const status = err && err.response ? err.response.status : null;
  if (status !== 403) return false;
  const headers = (err.response && err.response.headers) || {};
  return String(headers['cf-mitigated'] || '').toLowerCase() === 'challenge';
}

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return null;
      return {
        name: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
      };
    })
    .filter(Boolean);
}

async function fetchHtmlWithPlaywright(url, baseUrl, cookie, report) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (_) {
    return {
      ok: false,
      error:
        'Cloudflare challenge detected and Playwright is not installed. Run "npm i playwright" in backend and retry with a valid cookie.',
    };
  }

  const base = new URL(baseUrl);
  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Accept:
          'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const parsedCookies = parseCookieHeader(cookie || process.env.XAMVN_COOKIE || '');
    if (parsedCookies.length > 0) {
      report(`Playwright: adding ${parsedCookies.length} cookie(s) to context`);
      await context.addCookies(
        parsedCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: base.hostname,
          path: '/',
          secure: true,
          httpOnly: false,
          sameSite: 'Lax',
        }))
      );
    } else {
      report('Playwright: no cookies provided; attempting without authentication');
    }

    const page = await context.newPage();
    report(`Playwright: navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    report('Playwright: page loaded, waiting for dynamic content...');
    await page.waitForTimeout(3000);
    const html = await page.content();
    const title = (await page.title()) || '';

    report(`Playwright: page title = "${title}"`);

    if (/just a moment/i.test(title) || /cf-challenge|challenge-platform/i.test(html)) {
      report('Playwright: Cloudflare challenge detected on page');
      return {
        ok: false,
        error:
          'Cloudflare challenge is still active after Playwright. Either: (1) your cookie is expired/invalid, (2) your xamvn account has access restrictions, or (3) Cloudflare requires additional verification. Try refreshing your browser session and copying a fresh Cookie header.',
      };
    }

    report('Playwright: page loaded successfully, no Cloudflare challenge detected');

    report('Playwright fallback succeeded. Continuing crawl...');
    return { ok: true, html };
  } catch (err) {
    const rawMessage = String(err && err.message ? err.message : err);
    const firstLine = rawMessage.split('\n')[0].trim();
    const missingLib = /error while loading shared libraries: ([^\s:]+)/i.exec(rawMessage);
    if (missingLib) {
      return {
        ok: false,
        error: `Playwright fallback failed due to missing system library (${missingLib[1]}). Install Playwright runtime deps in the container and retry.`,
      };
    }
    return {
      ok: false,
      error: `Playwright fallback failed: ${firstLine}`,
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function fetchHtml(client, url, baseUrl, options, report, label) {
  try {
    const resp = await client.get(url);
    return resp.data;
  } catch (err) {
    if (!isCloudflareChallenge(err)) throw err;
    report(`Cloudflare challenge detected while ${label}. Trying Playwright fallback...`);
    const fallback = await fetchHtmlWithPlaywright(url, baseUrl, options.cookie, report);
    if (fallback.ok) return fallback.html;
    throw new Error(fallback.error);
  }
}

// Returns true for URLs that point to icons, smilies, or reaction images
// rather than actual content images.
function isIconOrEmojiUrl(url) {
  return (
    /\/smilies\//i.test(url) ||
    /\/data\/smilies\//i.test(url) ||
    /\bemoji\b/i.test(url) ||
    /\/emojis?\//i.test(url) ||
    /\/emoticons?\//i.test(url) ||
    /\/reactions?\//i.test(url) ||
    /reaction_sprite/i.test(url) ||
    /spritesheet/i.test(url) ||
    /\/icons?\//i.test(url)
  );
}

// Extract media (images + videos) from a cheerio-loaded page
function extractMedia($, baseUrl) {
  const media = [];
  const seen = new Set();
  const directVideoPattern = /\.(mp4|webm|ogg|m3u8|mov|m4v)(\?|#|$)/i;

  function addMedia(url, type, extra = {}) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    media.push({ url, type, ...extra });
  }

  // --- Images ---
  // XenForo img tags inside post content
  $('article .bbWrapper img, .message-body img, .post-body img, .bbWrapper img, img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || '';
    if (!src) return;
    // Skip smilie / reaction / icon elements by class or attribute
    if (
      $(el).attr('data-smilie') ||
      $(el).hasClass('smilie') ||
      $(el).hasClass('smilieText') ||
      $(el).hasClass('reaction-image') ||
      $(el).hasClass('smilieSprite') ||
      $(el).hasClass('mceSmilieSprite')
    ) return;
    // Resolve relative URLs
    let absUrl = src;
    try {
      absUrl = new URL(src, baseUrl).href;
    } catch (_) {}
    // Skip tiny avatars / icons (typically < 100px)
    const width = parseInt($(el).attr('width') || '9999', 10);
    const height = parseInt($(el).attr('height') || '9999', 10);
    if (width < 80 || height < 80) return;
    // Skip smileys and icon URLs
    if (isIconOrEmojiUrl(absUrl)) return;
    addMedia(absUrl, 'image');
  });

  // Lightbox / attachment images
  $('a[data-fancybox], a[data-lightbox], a.AttachmentLink').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)) {
      let absUrl = href;
      try { absUrl = new URL(href, baseUrl).href; } catch (_) {}
      if (isIconOrEmojiUrl(absUrl)) return;
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

  // Direct video links in post content
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!directVideoPattern.test(href)) return;
    let absUrl = href;
    try { absUrl = new URL(href, baseUrl).href; } catch (_) {}
    addMedia(absUrl, 'video', {
      platform: absUrl.includes('catbox.moe') ? 'catbox' : 'direct',
    });
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
async function crawlThread(rawUrl, onProgress, options = {}, onPage = null) {
  const { threadId, base } = parseThreadUrl(rawUrl);
  const client = buildClient(base, options);
  const report = (msg) => onProgress && onProgress(msg);

  report(`Fetching first page of thread ${threadId}…`);

  // Fetch page 1
  let page1Html;
  try {
    page1Html = await fetchHtml(
      client,
      `${base}/threads/${threadId}/`,
      base,
      options,
      report,
      `fetching first page of thread ${threadId}`
    );
  } catch (err) {
    const status = err.response ? err.response.status : 'network error';
    throw new Error(`Failed to fetch thread (${status}): ${err.message}`);
  }

  const $1 = cheerio.load(page1Html);
  const title = getTitle($1);
  const pageCount = getPageCount($1);

  report(`Title: "${title}" | Pages: ${pageCount}`);

  const allPosts = parsePage($1, base);
  if (onPage) await onPage(allPosts, 1);

  const maxPages = Number.isInteger(options.maxPages) && options.maxPages > 0
    ? options.maxPages
    : null;
  const effectivePageCount = maxPages ? Math.min(pageCount, maxPages) : pageCount;
  if (maxPages && effectivePageCount < pageCount) {
    report(`Page cap reached: crawling ${effectivePageCount} of ${pageCount} pages (maxPages=${maxPages})`);
  }

  const pageDelay = Number.isInteger(options.pageDelayMs) && options.pageDelayMs >= 0
    ? options.pageDelayMs
    : 0;

  // Fetch remaining pages
  for (let p = 2; p <= effectivePageCount; p++) {
    report(`Fetching page ${p}/${effectivePageCount}…`);
    if (pageDelay > 0) await sleep(pageDelay);
    try {
      const html = await fetchHtml(
        client,
        `${base}/threads/${threadId}/page-${p}`,
        base,
        options,
        report,
        `fetching page ${p}`
      );
      const $p = cheerio.load(html);
      const pagePosts = parsePage($p, base);
      allPosts.push(...pagePosts);
      if (onPage) await onPage(pagePosts, p);
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

  return { threadId, title, pageCount: effectivePageCount, posts: allPosts };
}

module.exports = { crawlThread, parseThreadUrl };
