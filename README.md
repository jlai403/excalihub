# ExcaliHub

[![CI](https://github.com/jlai403/excalihub/actions/workflows/ci.yml/badge.svg)](https://github.com/jlai403/excalihub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-1.x-f9f0ff?logo=bun&logoColor=black)](https://bun.sh)
[![Last Commit](https://img.shields.io/github/last-commit/jlai403/excalihub)](https://github.com/jlai403/excalihub/commits/main)

Self-hosted hub for isolated Excalidraw whiteboards with automatic backup.

ExcaliHub gives you a self-hosted dashboard where every whiteboard lives on its own subdomain. Think `project-a.excalihub.example.com`, `team-b.excalihub.example.com` — each backed by a shared Excalidraw instance with automatic backups. Great for homelabs, small teams, or anyone who wants segregated boards without the SaaS.

## Features

- Subdomain isolation per space
- Automatic backups with retention policy (7 daily, 4 weekly, 12 monthly)
- Dashboard to create, rename, and manage spaces
- Single `docker compose up` to run
- No database — just flat files on disk

## Quick Start

Create a `docker-compose.yml`:

```yaml
services:
  excalihub:
    image: ghcr.io/jlai403/excalihub:latest
    ports:
      - "80:80"
    environment:
      - BASE_DOMAIN=example.com
    volumes:
      - excalihub-data:/data
    depends_on:
      - excalidraw
    restart: unless-stopped

  excalidraw:
    image: excalidraw/excalidraw:latest
    expose:
      - "80"
    restart: unless-stopped

volumes:
  excalihub-data:
```

Then run:

```bash
docker compose up -d
```

Open `http://excalihub.localhost` — no DNS setup needed.
`*.localhost` resolves to `127.0.0.1` on macOS and Linux out of the box.
Any space you create will be at `your-space.excalihub.localhost`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `BASE_DOMAIN` | `example.com` | Root domain (e.g. `example.com` → `*.example.com`) |
| `HUB_SUBDOMAIN` | `excalihub` | Hub subdomain prefix |
| `EXCALIDRAW_CONTAINER` | `http://excalidraw:80` | Excalidraw backend URL |
| `PORT` | `80` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Data directory (spaces, backups) |

## Homelab Deployment

1. **DNS** — wildcard `*.excalihub.example.com` → your server IP (A record)
2. **Ports** — forward 80/443 to the server
3. **TLS** — add a reverse proxy (Caddy, Nginx Proxy Manager) for Let's Encrypt
4. **Config** — set `BASE_DOMAIN=example.com` in `docker-compose.yml`
5. **Up** — `docker compose up --build -d`

## Development

Run without Docker (requires Bun + Excalidraw running separately):

```bash
bun install
bun run dev       # Hono (port 80) + Astro (port 4321)
```

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

## Contributing

Contributions are welcome! Open an issue or PR and we'll get back to you.

## License

MIT — see [LICENSE](LICENSE) for details.
