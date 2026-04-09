import { useState } from 'react';
import { api } from '../api';

export default function ThreadList({ threads, onSelect, selectedId, onDeleted }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this thread and all its media?')) return;
    setDeleting(id);
    try {
      await api.deleteThread(id);
      if (onDeleted) onDeleted(id);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (!threads || threads.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No crawled threads yet. Paste a thread URL above to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((t) => (
        <div
          key={t.id}
          onClick={() => onSelect && onSelect(t)}
          className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 cursor-pointer border transition-colors ${
            selectedId === t.id
              ? 'border-purple-500 bg-purple-900/20'
              : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-100 truncate">
              {t.title || t.url}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-purple-400 truncate max-w-xs"
              >
                {t.url}
              </a>
              <span className="text-purple-400">{t.image_count} imgs</span>
              <span className="text-blue-400">{t.video_count} vids</span>
            </div>
          </div>
          <button
            onClick={(e) => handleDelete(e, t.id)}
            disabled={deleting === t.id}
            title="Delete thread"
            className="shrink-0 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
