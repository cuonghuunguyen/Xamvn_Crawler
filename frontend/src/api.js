const API_BASE = import.meta.env.VITE_API_URL || '/api';
const HEALTH_TIMEOUT_MS = 8000;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  crawl: (url, cookie, crawlOptions = {}) =>
    request('/crawl', {
      method: 'POST',
      body: JSON.stringify({
        url,
        ...(cookie ? { cookie } : {}),
        ...(crawlOptions.parallel != null ? { parallel: crawlOptions.parallel } : {}),
        ...(crawlOptions.maxPages != null ? { maxPages: crawlOptions.maxPages } : {}),
        ...(crawlOptions.pageDelayMs != null ? { pageDelayMs: crawlOptions.pageDelayMs } : {}),
      }),
    }),

  crawlStatus: (url) =>
    request(`/crawl/status?url=${encodeURIComponent(url)}`),

  getThreads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/threads?${qs}`);
  },

  deleteThread: (id) =>
    request(`/threads/${id}`, { method: 'DELETE' }),

  getMedia: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/media?${qs}`);
  },

  getMediaProxyUrl: (mediaId) =>
    `${API_BASE}/media/proxy?media_id=${encodeURIComponent(mediaId)}`,

  getStats: () => request('/stats'),

  health: () => {
    const healthUrl = API_BASE.replace(/\/api$/, '') + '/health';
    return fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  },
};
