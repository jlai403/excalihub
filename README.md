# ExcaliHub

Self-hosted hub for isolated Excalidraw whiteboards via subdomains.

Each space gets its own subdomain (e.g. `project1.draw.domain.com`) backed by a shared Excalidraw container with automatic backup.

## Quick Start

```bash
docker compose up --build
```

Environment variables configured in `docker-compose.yml`:
- `BASE_DOMAIN` — wildcard domain (e.g. `draw.domain.com`)
- `EXCALIDRAW_CONTAINER` — internal URL for the Excalidraw container

## Commands

```bash
npm run dev            # Start Hono server + Astro dev dashboard
npm run build          # Build for production
npm start              # Run production server
npm test               # Run test suite
```

## Architecture

```
Browser ──> draw.domain.com ──> Astro Dashboard
           project.draw.domain.com ──> Hono Proxy ──> Excalidraw container
                                         │
                                         └──> Auto-backup injection ──> POST /api/backup ──> SQLite
```

## Stack

- **Hono** — TypeScript backend (proxy, API, middleware)
- **Astro** — Dashboard UI
- **SQLite / Drizzle ORM** — Persistence
- **Docker Compose** — Deployment
