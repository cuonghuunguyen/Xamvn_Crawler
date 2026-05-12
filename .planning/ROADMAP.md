# Roadmap: Xamvn Crawler

## Overview

Xamvn Crawler will be delivered in four phases, each building on the last to provide robust crawling, structured data storage, user-friendly access/search, and analytics. Each phase delivers a complete, verifiable capability, ensuring users can crawl threads, manage and search media, and gain insights from analytics.

## Phases

- [ ] **Phase 1: Robust Crawling** - Enable reliable, multi-page thread crawling and media extraction with deduplication and error handling
- [ ] **Phase 2: Data Structuring** - Store crawled data in a structured SQLite database, ensuring thread-media linkage and cascade deletion
- [ ] **Phase 3: User Access & Search** - Provide a responsive gallery UI with filtering, search, and thread management
- [ ] **Phase 4: Analytics & Stats** - Deliver stats bar, per-thread analytics, and trends for actionable insights

## Phase Details

### Phase 1: Robust Crawling

**Goal**: Users can reliably crawl any xamvn.bond thread and extract all images/videos with deduplication and error feedback
**Depends on**: Nothing (first phase)
**Requirements**: CRAWL-01, CRAWL-02, CRAWL-03, CRAWL-04, CRAWL-05, CRAWL-06
**Success Criteria** (what must be TRUE):

1. User can input a thread URL and start a crawl
2. All pages of the thread are crawled automatically
3. All images and videos are extracted from thread pages
4. Duplicate media URLs are not stored
5. Crawl progress is shown in real time
6. Crawl errors are reported to the user
   **Plans**: TBD

### Phase 2: Data Structuring

**Goal**: Media and thread data are stored in a structured, queryable SQLite database with proper linkage and cascade deletion
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):

1. Media and thread data are stored in SQLite
2. Each media item is linked to its thread and page
3. Deleting a thread removes all associated media
   **Plans**: TBD

### Phase 3: User Access & Search

**Goal**: Users can browse, filter, and search all crawled media in a responsive gallery UI, with thread management
**Depends on**: Phase 2
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04
**Success Criteria** (what must be TRUE):

1. User can view a gallery of all crawled media
2. User can filter gallery by Images, Videos, or All
3. User can search media and threads by keyword
4. Sidebar lists all crawled threads; clicking scopes the gallery
   **Plans**: TBD
   **UI hint**: yes

### Phase 4: Analytics & Stats

**Goal**: Users can view stats and trends about crawled threads and media for actionable insights
**Depends on**: Phase 3
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03
**Success Criteria** (what must be TRUE):

1. Stats bar shows total threads, images, and videos
2. User can view crawl stats per thread (counts, last crawl)
3. User can see trends (e.g., most active threads)
   **Plans**: TBD
   **UI hint**: yes

## Progress Table

| Phase                   | Plans Complete | Status      | Completed |
| ----------------------- | -------------- | ----------- | --------- |
| 1. Robust Crawling      | 0/0            | Not started | -         |
| 2. Data Structuring     | 0/0            | Not started | -         |
| 3. User Access & Search | 0/0            | Not started | -         |
| 4. Analytics & Stats    | 0/0            | Not started | -         |
