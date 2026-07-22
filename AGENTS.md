# ExcaliHub — Agent Guide

## Project

Self-hosted hub providing isolated Excalidraw whiteboards via subdomains.
Each "space" gets a subdomain (e.g. `project1.draw.example.com`) backed by a shared Excalidraw container.

## Rules

- **All tests must pass before pushing.** Run `bun test` and `bun test:e2e` and confirm green before any commit.

## Stack

- **Backend**: Hono (TypeScript) — reverse proxy, REST API, middleware
- **Dashboard**: Astro (static site generation)
- **Storage**: Flat files on disk — no database, no ORM
- **Containerization**: Docker Compose (excalihub + excalidraw sidecar)

## Key Commands

| Command | Description |
|---|---|
| `bun run dev` | Start Hono server + Astro dev server + Excalidraw container concurrently |
| `bun run dev:server` | Start Hono server only (hot-reload) |
| `bun run dev:hub` | Start Astro dev server only |
| `bun run dev:excalidraw` | Start Excalidraw container on localhost:8080 |
| `bun run build` | Build Astro + bundle server with Bun |
| `bun run start` | Run production server |
| `bun test` | Run unit/integration test suite |
| `bun test --watch` | Run tests in watch mode |
| `bun test:e2e` | Run Playwright e2e tests (chromium, firefox, webkit) |
| `docker compose up --build` | Full deployment |
| `droast Dockerfile` | Lint Dockerfile |

## Stack

- **Runtime**: Bun 1.x

## CI/CD

Workflow: `.github/workflows/ci.yml`
- `test` — bun install + bun test
- `lint` — droast Dockerfile lint (gated on test)
- `build` — docker build . (gated on test)

## Project Structure

```
server/               — Hono app (routes, middleware, services, repos)
  src/
    repos/            — Flat-file repos (space.ts, backup.ts)
    services/         — Business logic (space, backup)
    routes/           — API route handlers
    middleware/       — Proxy, injection
    inject/           — Client-side script injected into Excalidraw
  tests/              — bun:test (API, proxy, injection, repos, services)
hub/                  — Astro static site (pages, layouts)
```

## Data Layout

```
/data/spaces/{subdomain}/
  meta.json          — { id, name, subdomain, createdAt, updatedAt, latest_backup }
  backups/
    {unix_ts}-{nanoid}-{hash_prefix}.excalidraw
```

- In-memory `Map<subdomain, SpaceMeta>` populated at boot, all reads hit the map
- Per-space `Mutex` for atomic backup dedup (read → compare → write cycle)
- Proxy validates subdomain existence before proxying to Excalidraw
- Space rename (subdomain change) does a directory rename — affects DNS/routing

## Env Vars

| Var | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Data directory (spaces, backups) |
| `BASE_DOMAIN` | `example.com` | Root domain for spaces (e.g. `example.com` → `*.example.com`) |
| `HUB_SUBDOMAIN` | `excalihub` | Hub subdomain prefix (e.g. `excalihub` → `excalihub.localhost` in dev) |
| `EXCALIDRAW_CONTAINER` | `http://localhost:8080` | Excalidraw backend URL |
| `PORT` | `80` | Server port |
| `HOST` | `0.0.0.0` | Bind address |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/spaces` | List all spaces |
| `GET` | `/api/spaces/:id` | Get space by ID |
| `POST` | `/api/spaces` | Create space (body: `{ name }`) |
| `PATCH` | `/api/spaces/:id` | Rename space (body: `{ name?, subdomain? }`) |
| `DELETE` | `/api/spaces/:id` | Delete space + all backups |
| `GET` | `/api/spaces/:id/backups` | List backups (metadata only) |
| `DELETE` | `/api/spaces/:id/backups/:filename` | Delete a specific backup |
| `POST` | `/api/backup` | Create backup (body: `{ subdomain, elements, appState? }`) |
| `GET` | `/api/backups/:filename` | Download backup file |

## Session History

### 2026-07-18 — SQLite→flat-file migration
- Replaced sql.js/Drizzle storage with flat-file repos (`src/server/repos/`)
- SpaceRepo: in-memory Map, atomic meta.json writes, string nanoid IDs
- BackupRepo: per-space mutex, dedup via hash prefix in filename, file-per-backup
- Removed: `db.ts`, `schema.ts`, `drizzle.config.ts`, `repositories/`, `sql.js.d.ts`
- Removed deps: `drizzle-orm`, `sql.js`, `drizzle-kit`
- Renamed `DB_PATH` → `DATA_DIR` env var
- Added `PATCH /api/spaces/:id` rename endpoint
- Proxy validates subdomain existence before proxying
- `Bun.serve` instead of `serve` from `hono/bun`

### 2026-07-18 — Monorepo migration
- Split into Bun workspaces: `server/` + `hub/`
- Server deps (hono, consola, nanoid, zod) in `server/package.json`
- Hub deps (astro, @astrojs/node) in `hub/package.json`
- Dev deps (concurrently, typescript, @types/node) in root `package.json`
- Tests moved to `server/tests/`
- Import paths updated: `~/server/...` → `~/...`
- Inject script path updated in `auto-backup-inject.ts`
- Dockerfile updated for workspace structure
- CI updated: `bun test server/tests/`

### 2026-07-21 — Backup retention + protocol fix
- Fixed protocol mismatch in inject script (was hardcoded `https://`, now uses `window.location.protocol`)
- Changed backup filename format: `{nanoid}-{ts}-{hash}` → `{ts}-{nanoid}-{hash}` (chronological sort)
- Implemented 7-4-12 retention policy (7 daily, 4 weekly, 12 monthly backups per space)
- Added `DELETE /api/spaces/:id/backups/:filename` endpoint
- Updated frontend `Space` type with `updatedAt` and `latest_backup` fields
- Space cards now display Last Updated and Last Backup
- Added contribution rule: tests must pass before pushing

### 2026-07-22 — Archive/delete UI
- Added archive button with confirmation dialog to space cards in `SpacesList.svelte`
- Deleted dead code: `space.astro` and `SpaceDetail.svelte`
- Updated e2e tests: archive/unarchive/delete via UI, fixed sidebar text collisions with `data-slot="card"` locators
- Fixed pre-existing e2e failures: scoped locators to avoid sidebar/main ambiguity
