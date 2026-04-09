import { useState } from 'react';

function ImageCard({ item }) {
  const [imgError, setImgError] = useState(false);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      className="block rounded-lg overflow-hidden bg-gray-800 border border-gray-700 hover:border-purple-500 transition-colors group"
    >
      {imgError ? (
        <div className="aspect-square flex items-center justify-center text-gray-600 text-xs p-2 text-center">
          Image unavailable
        </div>
      ) : (
        <img
          src={item.url}
          alt=""
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
        />
      )}
      <div className="px-2 py-1.5 text-xs text-gray-500 truncate">{item.thread_title}</div>
    </a>
  );
}

function VideoCard({ item }) {
  const isYoutube = item.platform === 'youtube';
  const thumbnail = item.thumbnail;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      className="block rounded-lg overflow-hidden bg-gray-800 border border-gray-700 hover:border-blue-500 transition-colors group"
    >
      <div className="aspect-video bg-gray-900 relative flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="text-gray-600 text-sm">Video</div>
        )}
        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
            <svg
              viewBox="0 0 24 24"
              fill="white"
              className="w-5 h-5 ml-0.5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {isYoutube && (
          <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            YT
          </span>
        )}
      </div>
      <div className="px-2 py-1.5 text-xs text-gray-500 truncate">{item.thread_title}</div>
    </a>
  );
}

export default function MediaGrid({ media, type }) {
  if (!media || media.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12 text-sm">
        {type === 'image'
          ? 'No images found.'
          : type === 'video'
          ? 'No videos found.'
          : 'No media found.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {media.map((item) =>
        item.type === 'image' ? (
          <ImageCard key={item.id} item={item} />
        ) : (
          <VideoCard key={item.id} item={item} />
        ),
      )}
    </div>
  );
}
