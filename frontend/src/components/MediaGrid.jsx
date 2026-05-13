import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

function ImageCard({ item, onOpen }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left rounded-lg overflow-hidden bg-gray-800 border border-gray-700 hover:border-purple-500 transition-colors group"
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
    </button>
  );
}

function ImageModal({ item, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const dragStartRef = useRef(null);
  const lastTouchRef = useRef(null);
  const pinchRef = useRef(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);

  // Keep refs in sync so event handlers always have the latest values
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Escape key to close
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setScale((s) => {
        const next = Math.min(Math.max(s * factor, 1), 10);
        if (next <= 1) setOffset({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const getDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        initialDist: getDistance(e.touches[0], e.touches[1]),
        initialScale: scaleRef.current,
      };
      lastTouchRef.current = null;
    } else if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pinchRef.current = null;
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      const newScale = Math.min(
        Math.max(pinchRef.current.initialScale * (dist / pinchRef.current.initialDist), 1),
        10
      );
      setScale(newScale);
      if (newScale <= 1) setOffset({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      if (scaleRef.current > 1) {
        setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      }
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = () => {
    lastTouchRef.current = null;
    pinchRef.current = null;
  };

  const handleMouseDown = (e) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="text-sm text-gray-300 truncate mr-3">{item.thread_title || 'Image'}</div>
        <div className="flex items-center gap-2">
          {scale > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
            >
              Reset zoom ({Math.round(scale * 100)}%)
            </button>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Open original
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Close
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center select-none"
        style={{ touchAction: 'none', cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {imgError ? (
          <div className="text-gray-500 text-sm text-center px-4">
            <p>Image could not be loaded.</p>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block mt-3 px-3 py-1.5 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white"
            >
              Open in new tab
            </a>
          </div>
        ) : (
          <img
            src={item.url}
            alt=""
            draggable={false}
            onError={() => setImgError(true)}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2 border-t border-gray-800 text-xs text-gray-400 flex items-center gap-3">
        <span className="truncate flex-1">{item.url}</span>
        <span className="text-gray-600 hidden sm:inline shrink-0">Scroll to zoom · Pinch on mobile</span>
      </div>
    </div>
  );
}

function VideoCard({ item, onOpen }) {
  const isYoutube = item.playback_mode === 'youtube' || item.platform === 'youtube';
  const thumbnail = item.thumbnail;

  return (
    <button
      type="button"
      onClick={onOpen}
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
      <div className="px-2 py-1.5 text-xs text-gray-500 truncate text-left">
        {item.thread_title}
      </div>
    </button>
  );
}

function VideoModal({ item, onClose }) {
  const [src, setSrc] = useState(item.url);
  const [usingProxy, setUsingProxy] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const mode = item.playback_mode || (item.platform === 'youtube' ? 'youtube' : 'direct');
  const youtubeEmbedUrl =
    item.embed_url ||
    (item.video_id ? `https://www.youtube.com/embed/${item.video_id}` : null);
  const iframeUrl = item.embed_url || item.url;
  const proxyUrl = item.proxy_url || (item.id ? api.getMediaProxyUrl(item.id) : null);

  const onVideoError = () => {
    if (!usingProxy && proxyUrl) {
      setSrc(proxyUrl);
      setUsingProxy(true);
      return;
    }
    setPlaybackFailed(true);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`video-modal-title-${item.id}`}
    >
      <div className="w-full max-w-5xl rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <div id={`video-modal-title-${item.id}`} className="text-sm text-gray-300 truncate mr-3">
            {item.thread_title || 'Video'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Close
          </button>
        </div>

        <div className="bg-black aspect-video w-full flex items-center justify-center">
          {mode === 'youtube' && youtubeEmbedUrl ? (
            <iframe
              title="YouTube player"
              src={youtubeEmbedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : mode === 'iframe' ? (
            <iframe
              title="Embedded video"
              src={iframeUrl}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : playbackFailed ? (
            <div className="text-center px-4 text-gray-300 text-sm">
              <p>Unable to play this video inline.</p>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-block mt-3 px-3 py-1.5 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white"
              >
                Open source link
              </a>
            </div>
          ) : (
            <video
              src={src}
              controls
              autoPlay
              className="w-full h-full"
              onError={onVideoError}
            />
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-400 flex flex-wrap items-center gap-2">
          <span className="truncate">{item.url}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Open source
          </a>
        </div>
      </div>
    </div>
  );
}

export default function MediaGrid({ media, type }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

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
    <>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {media.map((item) =>
          item.type === 'image' ? (
            <ImageCard key={item.id} item={item} onOpen={() => setSelectedImage(item)} />
          ) : (
            <VideoCard key={item.id} item={item} onOpen={() => setSelectedVideo(item)} />
          ),
        )}
      </div>
      {selectedImage && (
        <ImageModal key={selectedImage.id} item={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
      {selectedVideo && (
        <VideoModal key={selectedVideo.id} item={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}
    </>
  );
}
