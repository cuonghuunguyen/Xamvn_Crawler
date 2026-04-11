import { useCallback, useState } from 'react';
import { api } from '../api';

export function useCrawl() {
  const [status, setStatus] = useState(null); // null | 'running' | 'done' | 'error' | 'cached'
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState(null);
  const [crawledUrl, setCrawledUrl] = useState(null);

  const startCrawl = useCallback(async (url, cookie) => {
    setStatus('running');
    setProgress([]);
    setError(null);
    setCrawledUrl(url);

    try {
      const result = await api.crawl(url, cookie);
      if (result.cached) {
        setStatus('done');
        return result;
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
      return null;
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 120; // 2 min
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500));
      attempts++;
      try {
        const jobStatus = await api.crawlStatus(url);
        setProgress(jobStatus.progress || []);
        if (jobStatus.status === 'done') {
          setStatus('done');
          return jobStatus;
        }
        if (jobStatus.status === 'error') {
          setStatus('error');
          setError(jobStatus.error || 'Crawl failed');
          return null;
        }
      } catch {
        // polling error, keep trying
      }
    }
    setStatus('error');
    setError('Crawl timed out');
    return null;
  }, []);

  return { status, progress, error, crawledUrl, startCrawl };
}
