# Requirements: Xamvn Crawler

**Defined:** 2026-05-12
**Core Value:** Users can easily crawl, organize, and analyze media from xamvn.bond threads in a fast, user-friendly interface.

## v1 Requirements

### Crawling

- [ ] **CRAWL-01**: User can input a thread URL and start a crawl
- [ ] **CRAWL-02**: Crawler fetches all pages of a thread automatically
- [ ] **CRAWL-03**: Crawler extracts all images and videos from thread pages
- [ ] **CRAWL-04**: Duplicate media URLs are not stored (deduplication)
- [ ] **CRAWL-05**: Crawl progress is shown in real time
- [ ] **CRAWL-06**: Crawl errors are reported to the user

### Data Structuring

- [ ] **DATA-01**: Media and thread data are stored in a structured SQLite database
- [ ] **DATA-02**: Each media item is linked to its thread and page
- [ ] **DATA-03**: Deleting a thread removes all associated media

### Access & Search

- [ ] **ACCESS-01**: User can view a gallery of all crawled media
- [ ] **ACCESS-02**: User can filter gallery by Images, Videos, or All
- [ ] **ACCESS-03**: User can search media and threads by keyword
- [ ] **ACCESS-04**: Sidebar lists all crawled threads; clicking scopes the gallery

### Analytics

- [ ] **ANALYTICS-01**: Stats bar shows total threads, images, and videos
- [ ] **ANALYTICS-02**: User can view crawl stats per thread (counts, last crawl)
- [ ] **ANALYTICS-03**: User can see trends (e.g., most active threads)

## v2 Requirements

### Advanced Features

- **ADV-01**: User accounts and authentication
- **ADV-02**: Export/download media
- **ADV-03**: AI-based media tagging

## Out of Scope

| Feature             | Reason                                      |
| ------------------- | ------------------------------------------- |
| User authentication | Not needed for v1, focus on open access     |
| Export/download     | Defer to v2 to focus on core gallery/search |
| AI tagging          | Defer to v2, not essential for MVP          |

## Traceability

| Requirement  | Phase   | Status  |
| ------------ | ------- | ------- |
| CRAWL-01     | Phase 1 | Done    |
| CRAWL-02     | Phase 1 | Done    |
| CRAWL-03     | Phase 1 | Done    |
| CRAWL-04     | Phase 1 | Done    |
| CRAWL-05     | Phase 1 | Done    |
| CRAWL-06     | Phase 1 | Done    |
| DATA-01      | Phase 2 | Done    |
| DATA-02      | Phase 2 | Done    |
| DATA-03      | Phase 2 | Done    |
| ACCESS-01    | Phase 3 | Done    |
| ACCESS-02    | Phase 3 | Done    |
| ACCESS-03    | Phase 3 | Done    |
| ACCESS-04    | Phase 3 | Done    |
| ANALYTICS-01 | Phase 4 | Done    |
| ANALYTICS-02 | Phase 4 | Done    |
| ANALYTICS-03 | Phase 4 | Partial |
