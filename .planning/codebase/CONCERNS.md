# Codebase Concerns

**Analysis Date:** [2026-05-12]

## Tech Debt

**Backend Crawler Logic:**
- Issue: Large, monolithic file with multiple responsibilities (networking, parsing, crawling, error handling) in `backend/src/crawler.js` (410 lines).
- Files: `backend/src/crawler.js`
- Impact: Hard to maintain, test, or extend; risk of introducing bugs when modifying logic.
- Fix approach: Refactor into smaller modules (e.g., network, parsing, media extraction, thread crawling).

**API Job State:**
- Issue: In-memory job state (`crawlJobs` in `backend/src/routes/api.js`) is not persisted.
- Files: `backend/src/routes/api.js`
- Impact: All crawl job progress is lost on server restart; no distributed/cluster support.
- Fix approach: Move job state to persistent store (e.g., database table or Redis).

**Frontend State Management:**
- Issue: App-wide state is managed via React hooks and prop drilling, with no global state/store.
- Files: `frontend/src/App.jsx`, `frontend/src/hooks/useCrawl.js`
- Impact: As app grows, state management may become fragile and hard to scale.
- Fix approach: Introduce a state management library (e.g., Redux, Zustand) if complexity increases.

## Known Bugs

**Crawl Timeout Handling:**
- Symptoms: If a crawl job takes too long, frontend times out after 2 minutes, but backend may still be running.
- Files: `frontend/src/hooks/useCrawl.js`, `backend/src/routes/api.js`
- Trigger: Large threads or slow network.
- Workaround: User must retry; no backend cancellation.

## Security Considerations

**Cookie Handling:**
- Risk: User-supplied cookies are accepted and used for crawling.
- Files: `backend/src/crawler.js`, `frontend/src/components/CrawlForm.jsx`
- Current mitigation: No direct storage of cookies; only used in memory for requests.
- Recommendations: Sanitize and validate cookies, avoid logging sensitive values, consider rate limiting and abuse monitoring.

**Rate Limiting:**
- Risk: API is rate-limited (60/min) but only per-process; distributed denial-of-service is not mitigated.
- Files: `backend/src/server.js`
- Recommendations: Use a distributed rate limiter (e.g., Redis-backed) for production.

## Performance Bottlenecks

**Single-threaded Backend:**
- Problem: Node.js backend is single-threaded; heavy crawling can block API responsiveness.
- Files: `backend/src/server.js`, `backend/src/crawler.js`
- Cause: Long-running crawl jobs run in main process.
- Improvement path: Offload crawling to worker processes or use a job queue.

## Fragile Areas

**Frontend Error Handling:**
- Files: `frontend/src/hooks/useCrawl.js`, `frontend/src/App.jsx`
- Why fragile: Errors are set in state but not always surfaced to user; polling errors are silently ignored.
- Safe modification: Ensure all error states are displayed and logged.
- Test coverage: Not detected; add tests for error scenarios.

## Scaling Limits

**Job State & Concurrency:**
- Current capacity: One process, in-memory job state.
- Limit: No horizontal scaling; jobs lost on restart.
- Scaling path: Move job state to persistent store, add worker queue.

## Dependencies at Risk

**Playwright (Optional):**
- Risk: Playwright is required for Cloudflare bypass but is optional; missing dependency causes fallback errors.
- Impact: Crawling fails for protected threads if not installed.
- Migration plan: Document requirement, add install checks, or bundle as peer dependency.

## Missing Critical Features

**Job Cancellation:**
- Problem: No way to cancel a running crawl job from frontend.
- Blocks: User control, resource management.

## Test Coverage Gaps

**Backend Logic:**
- What's not tested: Crawler, API routes, error handling.
- Files: `backend/src/crawler.js`, `backend/src/routes/api.js`, `backend/src/db.js`
- Risk: Bugs may go undetected, especially with edge cases or failures.
- Priority: High

---

*Concerns audit: 2026-05-12*
