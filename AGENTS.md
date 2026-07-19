# ExcaliHub — Agent Guide

## Project

Self-hosted hub providing isolated Excalidraw whiteboards via subdomains.
Each "space" gets a subdomain (e.g. `project1.draw.example.com`) backed by a shared Excalidraw container.

## Stack

- **Backend**: Hono (TypeScript) — reverse proxy, REST API, middleware
- **Dashboard**: Astro (static site generation)
- **Storage**: Flat files on disk — no database, no ORM
- **Containerization**: Docker Compose (excalihub + excalidraw sidecar)

## Key Commands

| Command | Description |
|---|---|
| `bun run dev` | Start Hono server + Astro dev server concurrently |
| `bun run dev:server` | Start Hono server only (hot-reload) |
| `bun run dev:dashboard` | Start Astro dev server only |
| `bun run build` | Build Astro + bundle server with Bun |
| `bun run start` | Run production server |
| `bun test` | Run test suite |
| `bun test --watch` | Run tests in watch mode |
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
src/server/          — Hono app (routes, middleware, services, repos)
  repos/             — Flat-file repos (space.ts, backup.ts)
  services/          — Business logic (space, backup)
  routes/            — API route handlers
  middleware/        — Proxy, injection
src/pages/           — Astro dashboard pages
src/inject/          — Client-side script injected into Excalidraw for auto-backup
src/layouts/         — Astro layouts
tests/               — bun:test (API, proxy, injection, repos, services)
```

## Data Layout

```
/data/spaces/{subdomain}/
  meta.json          — { id, name, subdomain, createdAt, updatedAt, latest_backup }
  backups/
    {nanoid}-{unix_ts}-{hash_prefix}.excalidraw
```

- In-memory `Map<subdomain, SpaceMeta>` populated at boot, all reads hit the map
- Per-space `Mutex` for atomic backup dedup (read → compare → write cycle)
- Proxy validates subdomain existence before proxying to Excalidraw
- Space rename (subdomain change) does a directory rename — affects DNS/routing

## Env Vars

| Var | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Data directory (spaces, backups) |
| `BASE_DOMAIN` | `draw.example.com` | Wildcard domain for spaces |
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
