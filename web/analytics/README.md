# First-party analytics module

This directory is the complete, copyable analytics feature: browser tracking,
dashboard UI and styles, world-map data, HTTP routes, and the Cloudflare
Durable Object backend. The host app only mounts the dashboard component,
calls `useVisitStats`, calls `registerAnalyticsRoutes`, and re-exports the
Durable Object class.

For an existing deployment, keep these persistence identifiers unchanged:

- Durable Object binding: `VISIT_STATS`
- exported class: `VisitStatsDurableObject`
- object name: `global`
- schema version: `2`
- cookies: `adb_vid` and `adb_sid`
- routes: `/api/hit`, `/api/stats`, and `/api/analytics`

Changing the schema version intentionally starts a new analytics epoch and
clears the previous tables. Moving or importing these files does not affect
stored counts.
