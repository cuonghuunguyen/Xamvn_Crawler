const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
  crawl: (url, cookie) =>
    request('/crawl', {
      method: 'POST',
      body: JSON.stringify({
        url,
        ...(cookie ? { cookie } : {}),
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

  getStats: () => request('/stats'),
};
