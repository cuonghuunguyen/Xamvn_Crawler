import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import CrawlForm from './components/CrawlForm';
import ThreadList from './components/ThreadList';
import MediaGrid from './components/MediaGrid';
import Pagination from './components/Pagination';
import StatsBar from './components/StatsBar';

const MEDIA_LIMIT = 60;
const THREAD_LIMIT = 10;

export default function App() {
  const [stats, setStats] = useState(null);

  // Threads list
  const [threads, setThreads] = useState([]);
  const [threadsTotal, setThreadsTotal] = useState(0);
  const [threadSearch, setThreadSearch] = useState('');
  const [threadPage, setThreadPage] = useState(1);

  // Media panel
  const [selectedThread, setSelectedThread] = useState(null);
  const [mediaType, setMediaType] = useState('all'); // 'all' | 'image' | 'video'
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaSearchInput, setMediaSearchInput] = useState('');
  const [mediaPage, setMediaPage] = useState(1);
  const [media, setMedia] = useState([]);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);

  const searchTimer = useRef(null);

  const loadStats = useCallback(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  const loadThreads = useCallback(() => {
    api
      .getThreads({ page: threadPage, limit: THREAD_LIMIT, search: threadSearch })
      .then((data) => {
        setThreads(data.threads);
        setThreadsTotal(data.total);
      })
      .catch(() => {});
  }, [threadPage, threadSearch]);

  const loadMedia = useCallback(() => {
    setMediaLoading(true);
    const params = { page: mediaPage, limit: MEDIA_LIMIT, search: mediaSearch };
    if (selectedThread) params.thread_id = selectedThread.id;
    if (mediaType !== 'all') params.type = mediaType;

    api
      .getMedia(params)
      .then((data) => {
        setMedia(data.media);
        setMediaTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setMediaLoading(false));
  }, [mediaPage, mediaSearch, selectedThread, mediaType]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { loadMedia(); }, [loadMedia]);

  const handleMediaSearchChange = (val) => {
    setMediaSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setMediaSearch(val);
      setMediaPage(1);
    }, 400);
  };

  const handleCrawlDone = () => {
    loadStats();
    loadThreads();
    loadMedia();
  };

  const handleThreadSelect = (t) => {
    setSelectedThread((prev) => (prev && prev.id === t.id ? null : t));
    setMediaPage(1);
  };

  const handleThreadDeleted = (id) => {
    if (selectedThread && selectedThread.id === id) setSelectedThread(null);
    loadStats();
    loadThreads();
    loadMedia();
  };

  const handleMediaTypeChange = (type) => {
    setMediaType(type);
    setMediaPage(1);
  };

  const tabClass = (active) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
      active
        ? 'bg-purple-600 text-white'
        : 'text-gray-400 hover:text-gray-200'
    }`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-gray-800 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl select-none">🕷</span>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Xamvn Crawler</h1>
              <p className="text-xs text-gray-500">Crawl &amp; browse forum media</p>
            </div>
          </div>
          <div className="flex-1">
            <CrawlForm onDone={handleCrawlDone} />
          </div>
          <div className="shrink-0">
            <StatsBar stats={stats} />
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden max-w-screen-2xl w-full mx-auto">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800">
            <input
              type="text"
              placeholder="Search threads…"
              onChange={(e) => {
                setThreadSearch(e.target.value);
                setThreadPage(1);
              }}
              className="w-full rounded-md px-3 py-1.5 bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* All threads option */}
            <div
              onClick={() => { setSelectedThread(null); setMediaPage(1); }}
              className={`flex items-center justify-between rounded-md px-3 py-2 cursor-pointer text-sm transition-colors ${
                !selectedThread
                  ? 'bg-purple-900/30 text-white border border-purple-700/50'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
              }`}
            >
              <span>All threads</span>
              <span className="text-xs text-gray-500">{threadsTotal}</span>
            </div>

            <ThreadList
              threads={threads}
              selectedId={selectedThread ? selectedThread.id : null}
              onSelect={handleThreadSelect}
              onDeleted={handleThreadDeleted}
            />
          </div>

          {/* Thread pagination */}
          {threadsTotal > THREAD_LIMIT && (
            <div className="flex justify-center gap-1 py-2 border-t border-gray-800">
              <button
                onClick={() => setThreadPage((p) => Math.max(1, p - 1))}
                disabled={threadPage <= 1}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span className="px-2 py-1 text-xs text-gray-500">
                {threadPage}/{Math.ceil(threadsTotal / THREAD_LIMIT)}
              </span>
              <button
                onClick={() => setThreadPage((p) => p + 1)}
                disabled={threadPage >= Math.ceil(threadsTotal / THREAD_LIMIT)}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Toolbar */}
          <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-2 flex flex-wrap items-center gap-3">
            {/* Type filter tabs */}
            <div className="flex gap-1 bg-gray-800/60 rounded-full px-1 py-1">
              {['all', 'image', 'video'].map((t) => (
                <button key={t} onClick={() => handleMediaTypeChange(t)} className={tabClass(mediaType === t)}>
                  {t === 'all' ? 'All' : t === 'image' ? '🖼 Images' : '🎬 Videos'}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              value={mediaSearchInput}
              onChange={(e) => handleMediaSearchChange(e.target.value)}
              placeholder="Search media / thread title…"
              className="flex-1 min-w-0 max-w-sm rounded-lg px-3 py-1.5 bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />

            {/* Selected thread indicator */}
            {selectedThread && (
              <div className="flex items-center gap-2 text-sm text-purple-300 bg-purple-900/20 border border-purple-700/40 rounded-full px-3 py-1">
                <span className="truncate max-w-xs">{selectedThread.title || selectedThread.url}</span>
                <button
                  onClick={() => { setSelectedThread(null); setMediaPage(1); }}
                  className="text-gray-500 hover:text-white text-base leading-none"
                >
                  ×
                </button>
              </div>
            )}

            {/* Count */}
            <span className="ml-auto text-xs text-gray-500 shrink-0">
              {mediaTotal} {mediaType === 'all' ? 'items' : mediaType + 's'}
            </span>
          </div>

          <div className="p-4">
            {mediaLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
                Loading…
              </div>
            ) : (
              <MediaGrid media={media} type={mediaType} />
            )}

            <Pagination
              page={mediaPage}
              total={mediaTotal}
              limit={MEDIA_LIMIT}
              onChange={setMediaPage}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

