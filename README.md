# Xamvn Crawler

A full-stack Node.js + React web app that crawls [xamvn.bond](https://xamvn.bond) forum threads, extracts and deduplicates all images and videos, and presents them in a searchable, filterable gallery — similar to [hayho.org/subscriptions](https://hayho.org/subscriptions).

![Xamvn Crawler UI](https://github.com/user-attachments/assets/9f220dea-2b0d-4de0-b13a-c841b393e407)

## Features

- **Crawl any thread** — paste a `https://xamvn.bond/threads/<id>/` URL and crawl all pages automatically
- **Image gallery** — lazy-loaded responsive grid with lightbox links
- **Video gallery** — click-to-play inline modal; YouTube uses embed, direct files use HTML5 player
- **Deduplication** — duplicate media URLs are silently dropped at crawl time
- **Filter** — switch between All / Images / Videos with one click
- **Search** — filter media or threads by keyword
- **Thread management** — sidebar lists all crawled threads; click to scope the gallery; delete to cascade-remove all data
- **Live progress** — real-time crawl progress log while a thread is being crawled
- **Stats bar** — running totals of threads, images, and videos in the header

## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, Cheerio (HTML parsing), Axios, SQLite (`better-sqlite3`) |
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Database | SQLite (file at `backend/data/crawler.db`) |

## Getting Started

### 1. Backend

```bash
cd backend
npm install
npm start        # API on http://localhost:3001
# or for hot-reload:
npm run dev
```

### 2. Frontend (development)

```bash
cd frontend
npm install
npm run dev      # UI on http://localhost:5173  (proxies /api → :3001)
```

### 3. Frontend (production build)

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

The backend serves `frontend/dist` as static files when `NODE_ENV=production`.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/crawl` | Start crawling `{ url, cookie?, parallel?, maxPages?, pageDelayMs? }` |
| `GET` | `/api/crawl/status?url=` | Poll crawl job status |
| `GET` | `/api/threads` | List crawled threads (`page`, `limit`, `search`) |
| `DELETE` | `/api/threads/:id` | Delete thread + all media |
| `GET` | `/api/media` | Get media (`type`, `thread_id`, `platform`, `search`, `page`, `limit`) |
| `GET` | `/api/media/proxy?media_id=` | Stream stored remote video through backend proxy for restrictive CORS hosts |
| `GET` | `/api/stats` | Aggregate counts |

## Example

Paste `https://xamvn.bond/threads/91770/` into the input field and click **Crawl**. The sidebar will update with the thread once complete and the media grid will populate with all images and videos found in the thread.

## Deploying to Render (Free Tier)

Render's free tier has a shared CPU (~0.1 vCPU). Use these environment variables:

| Variable | Recommended | Description |
|----------|-------------|-------------|
| `NODE_ENV` | `production` | Enables static-file serving of the frontend build |
| `FRONTEND_ORIGIN` | your Render URL | CORS allowed origin |
| `XAMVN_COOKIE` | *(optional)* | Default cookie for Cloudflare bypass |
| `MEDIA_PROXY_ALLOWLIST` | *(optional)* | Comma-separated extra host/domain allowlist for `/api/media/proxy` (default includes `files.catbox.moe`) |
| `MEDIA_PROXY_TIMEOUT_MS` | `15000` | Upstream timeout for video proxy requests |

> Crawl behavior is now configured from the UI per job:
> - **Parallel** defaults to `3`
> - **Page cap** is optional (unset by default)
> - **Page delay (ms)** is optional (unset by default)
>
> The backend still queues jobs when active crawls reach the configured parallel limit.

## Troubleshooting 403 (Cloudflare)

If crawl fails with `403` and Cloudflare challenge:

1. Open the target thread in your normal browser and ensure it loads.
2. Open DevTools -> Network -> select the thread document request.
3. Copy the `Cookie` value from Request Headers.
4. Paste it into the optional Cookie input in the crawler UI and retry.

Notes:
- Cookie value is stored in browser localStorage for convenience.
- Backend also supports `XAMVN_COOKIE` environment variable.
- When axios is blocked by Cloudflare, backend automatically retries with Playwright fallback.
