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
| `npm run dev` | Start Hono server + Astro dev server concurrently |
| `npm run dev:server` | Start Hono server only (hot-reload) |
| `npm run dev:dashboard` | Start Astro dev server only |
| `npm run build` | Build Astro + compile TypeScript |
| `npm start` | Run production server |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `docker compose up --build` | Full deployment |
| `droast Dockerfile` | Lint Dockerfile |

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

### 2026-07-17 — Dockerfile improvements + CI merge
- Fixed all droast findings: non-root user, HEALTHCHECK, .dockerignore, npm install → npm ci
- Merged test.yml + dockerfile-lint.yml into single ci.yml with needs:test gating
