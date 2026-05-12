<!-- refreshed: 2026-05-12 -->
# Architecture

**Analysis Date:** 2026-05-12

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                    │
├────────────────────────────┬───────────────────────────────┤
│   UI Components           │   State/Logic (Hooks)         │
│  `frontend/src/components`│  `frontend/src/hooks`         │
└───────────────┬────────────┴───────────────┬───────────────┘
                │                            │
                ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Fetch)                        │
│         `frontend/src/api.js`                               │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express API)                    │
│         `backend/src/server.js`                             │
│         `backend/src/routes/api.js`                         │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (SQLite)                      │
│         `backend/src/db.js`                                 │
│         `backend/data/crawler.db`                           │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component         | Responsibility                        | File                                    |
|-------------------|---------------------------------------|-----------------------------------------|
| App               | Main UI, state, routing               | `frontend/src/App.jsx`                  |
| CrawlForm         | Crawl input, cookie management        | `frontend/src/components/CrawlForm.jsx` |
| MediaGrid         | Display images/videos                 | `frontend/src/components/MediaGrid.jsx` |
| Pagination        | Pagination controls                   | `frontend/src/components/Pagination.jsx`|
| StatsBar          | Stats display                         | `frontend/src/components/StatsBar.jsx`  |
| ThreadList        | Thread sidebar, delete, select        | `frontend/src/components/ThreadList.jsx`|
| useCrawl          | Crawl logic, polling, state           | `frontend/src/hooks/useCrawl.js`        |
| api               | API abstraction (fetch)               | `frontend/src/api.js`                   |
| server            | Express app, API routes, static serve | `backend/src/server.js`                 |
| apiRouter         | API endpoints, crawl, threads, media  | `backend/src/routes/api.js`             |
| crawler           | Thread crawling, HTML parsing         | `backend/src/crawler.js`                |
| db                | SQLite access, helpers                | `backend/src/db.js`                     |

## Pattern Overview

**Overall:** Layered (Frontend-API-Backend-DB)

**Key Characteristics:**
- Clear separation: UI, API, backend, DB
- RESTful API between frontend and backend
- Stateless API (except in-memory crawl jobs)

## Layers

**Frontend (React):**
- Purpose: User interface, state, API calls
- Location: `frontend/src/`
- Contains: Components, hooks, styles
- Depends on: API layer
- Used by: End users (browser)

**API Layer:**
- Purpose: Abstracts fetch to backend
- Location: `frontend/src/api.js`
- Contains: API methods
- Depends on: Backend API
- Used by: Components/hooks

**Backend (Express):**
- Purpose: Serve API, manage crawl, DB
- Location: `backend/src/server.js`, `backend/src/routes/api.js`
- Contains: Express app, routes
- Depends on: DB, crawler
- Used by: Frontend

**Data Layer:**
- Purpose: Persistent storage
- Location: `backend/src/db.js`, `backend/data/crawler.db`
- Contains: SQLite DB, helpers
- Depends on: Node.js sqlite3
- Used by: Backend

## Data Flow

### Primary Request Path

1. User action in UI (e.g., crawl) (`frontend/src/components/CrawlForm.jsx`)
2. API call via `api.js` (`frontend/src/api.js`)
3. Express route handles request (`backend/src/routes/api.js`)
4. Backend logic/crawler/db invoked (`backend/src/crawler.js`, `backend/src/db.js`)
5. Response returned to frontend
6. UI updates state/components

**State Management:**
- Frontend: React state/hooks
- Backend: In-memory job map (for crawl progress), persistent DB for threads/media

## Key Abstractions

**Crawl Job:**
- Purpose: Track crawl progress/status
- Examples: `backend/src/routes/api.js` (crawlJobs map)
- Pattern: In-memory job tracking

**API Abstraction:**
- Purpose: Unified fetch interface
- Examples: `frontend/src/api.js`
- Pattern: Function per endpoint

## Entry Points

**Frontend:**
- Location: `frontend/src/main.jsx`
- Triggers: Browser loads app
- Responsibilities: Mount React app

**Backend:**
- Location: `backend/src/server.js`
- Triggers: Node.js process start
- Responsibilities: Start Express server, serve API/static

## Architectural Constraints

- **Threading:** Node.js event loop (single-threaded)
- **Global state:** In-memory crawlJobs map (`backend/src/routes/api.js`)
- **Circular imports:** None detected

## Anti-Patterns

### In-Memory Job State
**What happens:** Crawl job status is kept in memory, not persisted
**Why it's wrong:** Lost on server restart, not scalable
**Do this instead:** Persist job state in DB (`backend/src/db.js`)

## Error Handling

**Strategy:**
- Try/catch in async functions, error responses via API

**Patterns:**
- API returns JSON error objects
- Frontend displays error messages

## Cross-Cutting Concerns

**Logging:** Console logging in backend (expandable)
**Validation:** Input validation in API routes
**Authentication:** None (open API)

---

*Architecture analysis: 2026-05-12*
