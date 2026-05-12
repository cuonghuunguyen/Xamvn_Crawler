# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- JavaScript (Node.js) - backend (`backend/`)
- JavaScript/JSX (React) - frontend (`frontend/`)

**Secondary:**
- Not detected

## Runtime

**Environment:**
- Node.js (version not pinned in repo)

**Package Manager:**
- npm (version not pinned)
- Lockfile: Not detected

## Frameworks

**Core:**
- Express (backend API) - `backend/package.json`
- React (frontend UI) - `frontend/package.json`

**Testing:**
- Not detected

**Build/Dev:**
- Vite (frontend build/dev) - `frontend/vite.config.js`
- Nodemon (backend dev) - `backend/package.json`

## Key Dependencies

**Critical:**
- express - Backend API server
- react, react-dom - Frontend UI

**Infrastructure:**
- sqlite3 - Embedded database (backend)
- axios, cheerio, playwright - Web crawling/scraping (backend)
- cors, express-rate-limit, https-proxy-agent, p-limit - Backend middleware/utilities
- tailwindcss, @tailwindcss/vite - Frontend styling

## Configuration

**Environment:**
- `.env` files: Not detected (but likely required for production)
- Backend and frontend configs in respective folders

**Build:**
- `frontend/vite.config.js` (Vite config)
- `frontend/eslint.config.js` (Lint config)

## Platform Requirements

**Development:**
- Node.js, npm

**Production:**
- Node.js server for backend
- Static hosting for frontend (Vite build output)

---

*Stack analysis: 2026-05-12*