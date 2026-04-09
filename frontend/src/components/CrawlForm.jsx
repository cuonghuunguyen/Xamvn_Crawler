import { useState } from 'react';
import { useCrawl } from '../hooks/useCrawl';

export default function CrawlForm({ onDone }) {
  const [url, setUrl] = useState('');
  const { status, progress, error, startCrawl } = useCrawl();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const result = await startCrawl(trimmed);
    if (result && onDone) onDone(trimmed);
  };

  const isRunning = status === 'running';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://xamvn.bond/threads/91770/"
          disabled={isRunning}
          className="flex-1 rounded-lg px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
        />
        <button
          type="submit"
          disabled={isRunning || !url.trim()}
          className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {isRunning ? 'Crawling…' : 'Crawl'}
        </button>
      </form>

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
