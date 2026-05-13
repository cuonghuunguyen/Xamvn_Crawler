import { useCallback, useState } from 'react';
import { api } from '../api';

export function useCrawl() {
  const [status, setStatus] = useState(null); // null | 'queued' | 'running' | 'done' | 'error' | 'cached'
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState(null);
  const [crawledUrl, setCrawledUrl] = useState(null);
  const [queuePosition, setQueuePosition] = useState(null);

  const startCrawl = useCallback(async (url, cookie, { onTick, crawlOptions } = {}) => {
    setStatus('running');
    setProgress([]);
    setError(null);
    setQueuePosition(null);
    setCrawledUrl(url);

    try {
      const result = await api.crawl(url, cookie, crawlOptions || {});
      if (result.cached) {
        setStatus('done');
        return result;
      }
      if (result.queuePosition != null) {
        setStatus('queued');
        setQueuePosition(result.queuePosition);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
      return null;
    }

    // Poll for completion — allow up to 10 min for queued + long threads
    let attempts = 0;
    const maxAttempts = 400; // 10 min at 1.5 s intervals
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500));
      attempts++;
      try {
        const jobStatus = await api.crawlStatus(url);
        setProgress(jobStatus.progress || []);
        if (onTick) onTick();
        if (jobStatus.queuePosition != null) {
          setStatus('queued');
          setQueuePosition(jobStatus.queuePosition);
        } else if (jobStatus.status === 'running') {
          setStatus('running');
          setQueuePosition(null);
        }
        if (jobStatus.status === 'done') {
          setStatus('done');
          setQueuePosition(null);
          return jobStatus;
        }
        if (jobStatus.status === 'error') {
          setStatus('error');
          setError(jobStatus.error || 'Crawl failed');
          setQueuePosition(null);
          return null;
        }
      } catch {
        // polling error, keep trying
      }
    }
    setStatus('error');
    setError('Crawl timed out');
    setQueuePosition(null);
    return null;
  }, []);

  return { status, progress, error, crawledUrl, queuePosition, startCrawl };
}
