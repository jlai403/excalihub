# ExcaliHub — Agent Guide

## Project

Self-hosted hub providing isolated Excalidraw whiteboards via subdomains.
Each "space" gets a subdomain (e.g. `project1.draw.example.com`) backed by a shared Excalidraw container.

## Stack

- **Backend**: Hono (TypeScript) — reverse proxy, REST API, middleware
- **Dashboard**: Astro (static site generation)
- **Database**: SQLite via sql.js + Drizzle ORM
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
- `test` — npm ci + npm test (Node 26)
- `lint` — droast Dockerfile lint (gated on test)
- `build` — docker build . (gated on test)

## Project Structure

```
src/server/          — Hono app (routes, middleware, services, repos, db)
src/pages/           — Astro dashboard pages
src/inject/          — Client-side script injected into Excalidraw for auto-backup
src/layouts/         — Astro layouts
tests/               — Vitest tests (API, proxy, injection, repos, services)
```

## Session History

### 2026-07-17 — Bun migration + Dockerfile improvements + CI merge
- Migrated from Node/npm/vitest to Bun runtime: `hono/bun` serve, `bun:test`, `bun build`
- Switched Dockerfile to `oven/bun:1`, CI to `oven-sh/setup-bun`
- Fixed all droast findings: non-root user, HEALTHCHECK, .dockerignore, npm install → npm ci
- Merged test.yml + dockerfile-lint.yml into single ci.yml with needs:test gating
