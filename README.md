# ExcaliHub

Self-hosted hub for isolated Excalidraw whiteboards via subdomains.

Each space gets its own subdomain (e.g. `project1.draw.example.com`) backed by a shared Excalidraw container with automatic backup.

## Local Development

```bash
git clone <repo>
cd excalihub
BASE_DOMAIN=draw.localhost docker compose up --build
```

Open `http://draw.localhost` — no DNS or `/etc/hosts` setup required.
`*.localhost` resolves to `127.0.0.1` on macOS and Linux out of the box.

Any space you create will be at `your-space.draw.localhost`.

## Homelab Deployment

1. **DNS** — wildcard `*.draw.example.com` → your server IP (A record)
2. **Ports** — forward 80/443 to the server
3. **TLS** — add a reverse proxy (Caddy, Nginx Proxy Manager) for Let's Encrypt
4. **Config** — set `BASE_DOMAIN=draw.example.com` in `docker-compose.yml`
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
| `BASE_DOMAIN` | `draw.example.com` | Wildcard domain for spaces |
| `EXCALIDRAW_CONTAINER` | `http://excalidraw:80` | Excalidraw backend URL |
| `PORT` | `80` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DB_PATH` | `/data/excalihub.db` | SQLite file path |

## Commands

```bash
bun run dev            # Start Hono server + Astro dev dashboard
bun run build          # Build for production
bun run start          # Run production server
bun test               # Run test suite
```

## Architecture

```
Browser ──> draw.example.com ────> Astro Dashboard
           project.draw.example.com ──> Hono Proxy ──> Excalidraw container
                                          │
                                          └──> Auto-backup injection ──> POST /api/backup ──> SQLite
```

## Stack

- **Bun** — Runtime, bundler, test runner
- **Hono** — TypeScript backend (proxy, API, middleware)
- **Astro** — Dashboard UI
- **SQLite / Drizzle ORM** — Persistence
- **Docker Compose** — Deployment
- **Excalidraw** — whiteboard editor (MIT). Shoutout to the Excalidraw team for their awesome work.
