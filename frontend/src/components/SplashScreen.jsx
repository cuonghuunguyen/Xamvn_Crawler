import { useEffect, useState } from 'react';
import { api } from '../api';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export default function SplashScreen({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setStatus('checking');
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          await api.health();
          if (!cancelled) setStatus('ready');
          return;
        } catch {
          if (cancelled) return;
          if (i < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
      if (!cancelled) setStatus('error');
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (status === 'ready') return children;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl select-none">🕷</span>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">Xamvn Crawler</h1>
          <p className="text-sm text-gray-500">Crawl &amp; browse forum media</p>
        </div>
      </div>

      {status === 'checking' && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Connecting to service…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="rounded-full bg-red-900/30 border border-red-700/50 px-4 py-2 text-red-400 text-sm">
            ✗ Service is not reachable right now
          </div>
          <p className="text-xs text-gray-500">
            The backend API could not be reached. Make sure the server is running and try again.
          </p>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
