# ExcaliHub — Agent Guide

## Project

Self-hosted hub providing isolated Excalidraw whiteboards via subdomains.
Each "space" gets a subdomain (e.g. `project1.draw.example.com`) backed by a shared Excalidraw container.

## Rules

- **`main` is protected.** Direct pushes are blocked. All changes must go through a branch PR to `main`.
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

### Release Workflow

Uses [release-please](https://github.com/googleapis/release-please) for automated releases.

**Flow:**
1. Push conventional commits to `main`
2. release-please opens a release PR with changelog + version bump
3. Review and merge the release PR
4. release-please creates tag `v*`
5. `docker-publish.yml` runs tests, builds Docker image, pushes to `ghcr.io/jlai/excalihub`
6. GitHub Release created with auto-generated changelog

**Conventional Commits:**
- `feat:` — minor version bump
- `fix:` — patch version bump
- `feat!:` or `BREAKING CHANGE:` — major version bump
- `chore:`, `docs:`, `refactor:` — no release (but included in changelog)

**Docker Image Tags:**
- `ghcr.io/jlai/excalihub:v0.2.0` — exact version
- `ghcr.io/jlai/excalihub:latest` — most recent stable release

**Config Files:**
- `.github/release-please-config.json` — release-please configuration
- `.github/.release-please-manifest.json` — version tracking

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

### 2026-07-22 — Sidebar collapsed state fixes
- Fixed label visibility: `labelClass` changed from `const` to `$derived` so it reacts to `pinned` state
- Bumped collapsed sidebar width from `w-12` (48px) to `w-14` (56px) for icon breathing room
- Added `navItemClass` (`$derived`) with fixed `pl-[14px] pr-2` — icons centered in collapsed sidebar, stationary on hover/pin

### 2026-07-25 — Space links fix + e2e test cleanup
- Fixed space links using hardcoded domain: `Layout.astro` now uses `window.location.hostname` instead of build-time `import.meta.env` (which only exposes `VITE_`-prefixed vars)
- Renamed e2e specs `*.spec.ts` → `*.e2e.ts` to prevent `bun test` from picking up Playwright files
- Added `testMatch: "**/*.e2e.ts"` to `playwright.config.ts`
- Updated e2e proxy test to navigate to hub host for subdomain link assertion
- Documented protected `main` branch rule in AGENTS.md

### 2026-08-27 — Bun 1.4.0 + TypeScript 7
- Upgraded Bun 1.3.14 → 1.4.0 (rewritten in Rust, Node 26.3 compat) and pinned to `1.4.0` everywhere: new `.bun-version` file, `Dockerfile` (`oven/bun:1.4.0`, builder + runtime), CI `oven-sh/setup-bun` `bun-version: 1.4.0` (was `latest`)
- TypeScript 6.0.3 → 7.0.2 (native Go compiler — `tsc` is the Go build now). Removed TS7-removed options: `ignoreDeprecations` (root `tsconfig.json`), `baseUrl` (server + hub `tsconfig.json`)
- Added `@types/bun` + `"bun"` in root tsconfig `types` — Bun globals (`Bun.serve`/`Bun.file`/`Bun.build`) were never typed; repo had **no typecheck before**
- Removed duplicate dead `getLatestBackupHash` from `server/src/repos/backup.ts` (was ambiguous with the canonical `space.ts` version; test now imports from `space.js`)
- Added typecheck: root `typecheck`/`typecheck:server` = `tsc --noEmit -p server` (tsc7), `typecheck:hub` = `astro check`. Hub pins `typescript@^6.0.0` because `astro check` needs TS6's programmatic API (TS7 ships none until 7.1 — withastro/roadmap#1321). Typecheck now runs in CI `test` job
- Playwright fix: hub webServer now sets `ASTRO_DEV_BACKGROUND=false` — Astro 7.1 auto-daemonizes its dev server under AI-agent environments (opencode + Bun 1.4), which made Playwright abort on "webServer exited early"
- Verified on Bun 1.4: typecheck clean (tsc7 + astro check), 70 unit + 30 e2e pass, `build` + `docker build` green, runtime `/health` 200, `droast` clean
