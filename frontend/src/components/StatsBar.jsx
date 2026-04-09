export default function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="flex gap-6 text-sm text-gray-400">
      <span>
        <span className="text-white font-semibold">{stats.threads}</span> threads
      </span>
      <span>
        <span className="text-purple-400 font-semibold">{stats.images}</span> images
      </span>
      <span>
        <span className="text-blue-400 font-semibold">{stats.videos}</span> videos
      </span>
    </div>
  );
}
