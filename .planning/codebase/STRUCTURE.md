# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```
[project-root]/
├── backend/           # Backend API, crawler, DB access
│   ├── data/          # SQLite database files
│   ├── src/           # Backend source code
│   │   ├── crawler.js # Thread crawling logic
│   │   ├── db.js      # SQLite helpers
│   │   ├── server.js  # Express app entry point
│   │   └── routes/    # API route handlers
│   │       └── api.js # Main API router
│   └── package.json   # Backend dependencies
├── frontend/          # Frontend React app
│   ├── public/        # Static assets (favicon, icons)
│   ├── src/           # Frontend source code
│   │   ├── api.js     # API abstraction
│   │   ├── App.jsx    # Main app component
│   │   ├── main.jsx   # React entry point
│   │   ├── components/# UI components
│   │   ├── hooks/     # Custom React hooks
│   │   └── assets/    # Images, SVGs
│   ├── package.json   # Frontend dependencies
│   ├── vite.config.js # Vite config
│   └── eslint.config.js # Lint config
├── README.md          # Project overview
└── .planning/         # GSD planning artifacts
```

## Directory Purposes

**backend/**
- Purpose: All backend logic and API
- Contains: Express app, crawler, DB, routes
- Key files: `src/server.js`, `src/crawler.js`, `src/db.js`, `src/routes/api.js`

**backend/data/**
- Purpose: SQLite DB storage
- Contains: `crawler.db` and related files

**backend/src/routes/**
- Purpose: API route handlers
- Contains: `api.js`

**frontend/**
- Purpose: All frontend code and config
- Contains: React app, static assets, config
- Key files: `src/App.jsx`, `src/main.jsx`, `src/api.js`, `vite.config.js`

**frontend/src/components/**
- Purpose: UI components
- Contains: `CrawlForm.jsx`, `MediaGrid.jsx`, etc.

**frontend/src/hooks/**
- Purpose: Custom React hooks
- Contains: `useCrawl.js`

**frontend/src/assets/**
- Purpose: Images, SVGs
- Contains: `hero.png`, `vite.svg`, etc.

**frontend/public/**
- Purpose: Static files for Vite
- Contains: `favicon.svg`, `icons.svg`

## Key File Locations

**Entry Points:**
- `backend/src/server.js`: Backend server entry
- `frontend/src/main.jsx`: Frontend app entry

**Configuration:**
- `backend/package.json`: Backend dependencies/scripts
- `frontend/package.json`: Frontend dependencies/scripts
- `frontend/vite.config.js`: Frontend build config
- `frontend/eslint.config.js`: Lint config

**Core Logic:**
- `backend/src/crawler.js`: Crawl logic
- `backend/src/db.js`: DB helpers
- `frontend/src/api.js`: API abstraction
- `frontend/src/App.jsx`: Main UI logic

**Testing:**
- Not detected (no test files found)

## Naming Conventions

**Files:**
- Components: `PascalCase.jsx` (e.g., `CrawlForm.jsx`)
- Hooks: `camelCase.js` (e.g., `useCrawl.js`)
- API/logic: `lowercase.js`

**Directories:**
- Grouped by feature/purpose (e.g., `components`, `hooks`)

## Where to Add New Code

**New Feature:**
- Primary code: `frontend/src/components/` (UI), `backend/src/` (API/logic)
- Tests: (Add `__tests__/` or `*.test.js` in relevant src dir)

**New Component/Module:**
- Implementation: `frontend/src/components/` or `backend/src/`

**Utilities:**
- Shared helpers: `frontend/src/` or `backend/src/`

## Special Directories

**.planning/**
- Purpose: GSD planning and codebase docs
- Generated: Yes
- Committed: Yes

**backend/data/**
- Purpose: SQLite DB files
- Generated: Yes
- Committed: No (should be gitignored)

---

*Structure analysis: 2026-05-12*
