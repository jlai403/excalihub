# ExcaliHub

[![CI](https://github.com/jlai403/excalihub/actions/workflows/ci.yml/badge.svg)](https://github.com/jlai403/excalihub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-1.x-f9f0ff?logo=bun&logoColor=black)](https://bun.sh)
[![Last Commit](https://img.shields.io/github/last-commit/jlai403/excalihub)](https://github.com/jlai403/excalihub/commits/main)

Self-hosted hub for isolated Excalidraw whiteboards via subdomains.

Each space gets its own subdomain (e.g. `project1.excalihub.example.com`) backed by a shared Excalidraw container with automatic backup.

## Local Development

```bash
git clone <repo>
cd excalihub
docker compose up --build
```

Open `http://excalihub.localhost` — no DNS or `/etc/hosts` setup required.
`*.localhost` resolves to `127.0.0.1` on macOS and Linux out of the box.
The hub is served at `{HUB_SUBDOMAIN}.{BASE_DOMAIN}` (default: `excalihub.localhost`).
Any space you create will be at `your-space.excalihub.localhost`.

## Homelab Deployment

1. **DNS** — wildcard `*.excalihub.example.com` → your server IP (A record)
2. **Ports** — forward 80/443 to the server
3. **TLS** — add a reverse proxy (Caddy, Nginx Proxy Manager) for Let's Encrypt
4. **Config** — set `BASE_DOMAIN=example.com` in `docker-compose.yml`
5. **Up** — `docker compose up --build -d`

## Bare Metal

Run without Docker (requires Bun + Excalidraw running separately):

```bash
bun install
bun run dev       # Hono (port 80) + Astro (port 4321)
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BASE_DOMAIN` | `example.com` | Root domain (e.g. `example.com` → `*.example.com`) |
| `EXCALIDRAW_CONTAINER` | `http://excalidraw:80` | Excalidraw backend URL |
| `PORT` | `80` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Data directory (spaces, backups) |

## Commands

```bash
bun run dev            # Start Hono server + Astro dev dashboard
bun run build          # Build for production
bun run start          # Run production server
bun test               # Run test suite
```

## Architecture

```
Browser ──> excalihub.example.com ────> Astro Dashboard
           project.excalihub.example.com ──> Hono Proxy ──> Excalidraw container
                                          │
                                          └──> Auto-backup injection ──> POST /api/backup ──> Flat files
```

## Stack

- **Bun** — Runtime, bundler, test runner, workspaces
- **Hono** — TypeScript backend (proxy, API, middleware)
- **Astro** — Dashboard UI
- **Flat files** — No database, no ORM
- **Docker Compose** — Deployment
- **Excalidraw** — whiteboard editor (MIT). Shoutout to the Excalidraw team for their awesome work.
