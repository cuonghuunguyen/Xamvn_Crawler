import { useEffect, useState } from 'react';
import { useCrawl } from '../hooks/useCrawl';

const COOKIE_STORAGE_KEY = 'xamvn_cookie_header';
const DEFAULT_PARALLEL = 3;
const MAX_PARALLEL = 10;
const MAX_PAGE_DELAY_MS = 60000;

export default function CrawlForm({ onDone, onTick }) {
  const [url, setUrl] = useState('');
  const [cookie, setCookie] = useState('');
  const [parallel, setParallel] = useState(String(DEFAULT_PARALLEL));
  const [maxPages, setMaxPages] = useState('');
  const [pageDelayMs, setPageDelayMs] = useState('');
  const { status, progress, error, queuePosition, startCrawl } = useCrawl();

  useEffect(() => {
    const saved = window.localStorage.getItem(COOKIE_STORAGE_KEY);
    if (saved) setCookie(saved);
  }, []);

  useEffect(() => {
    if (cookie.trim()) {
      window.localStorage.setItem(COOKIE_STORAGE_KEY, cookie.trim());
    } else {
      window.localStorage.removeItem(COOKIE_STORAGE_KEY);
    }
  }, [cookie]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const parsedParallel = Number.parseInt(parallel, 10);
    const parsedMaxPages = maxPages.trim() ? Number.parseInt(maxPages, 10) : null;
    const parsedPageDelayMs = pageDelayMs.trim() ? Number.parseInt(pageDelayMs, 10) : null;
    const crawlOptions = {
      parallel: Number.isInteger(parsedParallel) && parsedParallel > 0 && parsedParallel <= MAX_PARALLEL
        ? parsedParallel
        : DEFAULT_PARALLEL,
      ...(Number.isInteger(parsedMaxPages) && parsedMaxPages > 0 ? { maxPages: parsedMaxPages } : {}),
      ...(Number.isInteger(parsedPageDelayMs) && parsedPageDelayMs >= 0 && parsedPageDelayMs <= MAX_PAGE_DELAY_MS
        ? { pageDelayMs: parsedPageDelayMs }
        : {}),
    };
    const result = await startCrawl(trimmed, cookie.trim() || undefined, { onTick, crawlOptions });
    if (result && onDone) onDone(trimmed);
  };

  const isRunning = status === 'running';
  const isQueued = status === 'queued';
  const isActive = isRunning || isQueued;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xamvn.bond/threads/91770/"
            disabled={isActive}
            className="flex-1 rounded-lg px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
          />
          <button
            type="submit"
            disabled={isActive || !url.trim()}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {isQueued ? `Queued #${queuePosition}` : isRunning ? 'Crawling…' : 'Crawl'}
          </button>
        </div>

        <input
          type="text"
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          placeholder="Optional: browser Cookie header value for xamvn.bond"
          disabled={isActive}
          className="w-full rounded-lg px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-xs"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="number"
            min="1"
            max="10"
            value={parallel}
            onChange={(e) => setParallel(e.target.value)}
            disabled={isActive}
            placeholder="Parallel (default 3)"
            className="w-full rounded-lg px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-xs"
          />
          <input
            type="number"
            min="1"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            disabled={isActive}
            placeholder="Page cap (optional)"
            className="w-full rounded-lg px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-xs"
          />
          <input
            type="number"
            min="0"
            max="60000"
            value={pageDelayMs}
            onChange={(e) => setPageDelayMs(e.target.value)}
            disabled={isActive}
            placeholder="Page delay ms (optional)"
            className="w-full rounded-lg px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-xs"
          />
        </div>

        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer select-none">How to copy Cookie from browser</summary>
          <p className="mt-1">Open xamvn thread in your browser, then DevTools - Network - open thread request - Headers - copy Request Headers Cookie value.</p>
        </details>
      </form>

      {/* Queue notice */}
      {isQueued && (
        <p className="mt-2 text-xs text-yellow-400">
          ⏳ Waiting in queue (position #{queuePosition}) — another crawl is in progress
        </p>
      )}

      {/* Progress */}
      {isRunning && progress.length > 0 && (
        <div className="mt-3 bg-gray-800/60 rounded-lg p-3 text-xs text-gray-400 max-h-24 overflow-y-auto">
          {progress.map((msg, i) => (
            <div key={i} className="leading-relaxed">{msg}</div>
          ))}
        </div>
      )}

      {/* Status */}
      {status === 'done' && (
        <p className="mt-2 text-xs text-green-400">✓ Crawl complete</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-400">✗ {error}</p>
      )}
    </div>
  );
}
