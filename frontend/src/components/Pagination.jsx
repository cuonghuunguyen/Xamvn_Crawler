export default function Pagination({ page, total, limit, onChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ‹
      </button>
      {start > 1 && (
        <>
          <button
            onClick={() => onChange(1)}
            className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700"
          >
            1
          </button>
          {start > 2 && <span className="text-gray-600 px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded border text-sm transition-colors ${
            p === page
              ? 'bg-purple-600 border-purple-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-gray-600 px-1">…</span>}
          <button
            onClick={() => onChange(totalPages)}
            className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700"
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ›
      </button>
      <span className="ml-2 text-xs text-gray-500">
        {total} items
      </span>
    </div>
  );
}
