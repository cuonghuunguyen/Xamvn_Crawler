# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**Web Crawling:**
- Playwright, Cheerio, Axios - Used for scraping and crawling web content
  - SDK/Client: `playwright`, `cheerio`, `axios`
  - Auth: Not required (public scraping)

**Other APIs:**
- Not detected

## Data Storage

**Databases:**
- SQLite (embedded, file-based)
  - Connection: Local file (see `sqlite3` usage in `backend/src/db.js`)
  - Client: `sqlite3` npm package

**File Storage:**
- Local filesystem only (no cloud storage detected)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- None detected (no OAuth, JWT, or external auth)
  - Implementation: Not applicable

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console logging (default Node.js/Express)

## CI/CD & Deployment

**Hosting:**
- Not specified (likely Node.js server for backend, static hosting for frontend)

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- Not explicitly listed; likely required for production (e.g., port, DB path)

**Secrets location:**
- Not detected (no `.env` or secret files found)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

---

*Integration audit: 2026-05-12*