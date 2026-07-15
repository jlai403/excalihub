# ExcaliHub — Implementation Plan

## Overview

ExcaliHub is a self-hosted hub that gives you multiple isolated Excalidraw whiteboards via subdomains. Each "space" is a fresh Excalidraw board on its own subdomain (e.g., `project1.draw.domain.com`). The hub handles routing, auto-backup of `.excalidraw` files to SQLite, and provides a dashboard to manage spaces.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ExcaliHub (Hono)                      │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │  Astro       │    │  Proxy       │    │  SQLite    │ │
│  │  Dashboard   │    │  (*.draw.*)  │    │  Database  │ │
│  │  /           │    │  → Excaldraw │    │            │ │
│  └──────────────┘    └──────────────┘    └────────────┘ │
│         │                   │                   │        │
│         │         ┌─────────┴─────────┐         │        │
│         │         │  Injected JS      │         │        │
│         │         │  (auto-backup)    │         │        │
│         │         └───────────────────┘         │        │
└─────────┼───────────────────┼───────────────────┼────────┘
          │                   │                   │
          │         ┌─────────┴─────────┐         │
          │         │  Excalidraw       │         │
          │         │  Container        │         │
          │         │  (port 8080)      │         │
          │         └───────────────────┘         │
          │                                       │
    Browser ←──── Dashboard UI         Backup API ─┘
```

## Decisions

| Decision | Choice |
|----------|--------|
| **Name** | ExcaliHub |
| **Concept** | Spaces (isolated whiteboards via subdomains) |
| **Backend** | TypeScript + Hono |
| **Frontend** | Astro (dashboard) |
| **Database** | SQLite via `better-sqlite3` or `bun:sqlite` |
| **Routing** | Hub IS the reverse proxy (no Caddy) |
| **DNS** | Wildcard `*.draw.domain.com` → server IP |
| **Backup** | Auto on every Excalidraw autosave |
| **Injection** | Injected JS hooks Excalidraw's React API |
| **Identifier** | Subdomain extracted from hostname |
| **Distribution** | Docker Compose |

## Database Schema

```sql
-- Spaces (rooms/subdomains)
CREATE TABLE spaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backups (.excalidraw files)
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  space_id INTEGER NOT NULL,
  file_data TEXT NOT NULL,  -- JSON content of .excalidraw
  file_hash TEXT NOT NULL,  -- SHA-256 hash for deduplication
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX idx_backups_space_id ON backups(space_id);
CREATE INDEX idx_backups_hash ON backups(file_hash);
```

## Project Structure

```
excalihub/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── astro.config.mjs          # Astro config
├── src/
│   ├── server/               # Hono backend
│   │   ├── index.ts          # Entry point, Hono app
│   │   ├── db.ts             # SQLite setup & queries
│   │   ├── proxy.ts          # Reverse proxy logic
│   │   ├── inject.ts         # JS injection middleware
│   │   ├── routes/
│   │   │   ├── api.ts        # REST API (spaces, backups)
│   │   │   └── dashboard.ts  # Serve Astro build
│   │   └── backup.ts         # Backup handler
│   ├── inject/
│   │   └── excalidraw-sync.js # Injected script for auto-backup
│   ├── pages/                # Astro pages
│   │   ├── index.astro       # Dashboard (list spaces)
│   │   ├── spaces/
│   │   │   ├── new.astro     # Create space form
│   │   │   └── [id].astro    # Space detail + backup history
│   │   └── layouts/
│   │       └── Layout.astro  # Base layout
│   └── components/
│       ├── SpaceList.astro   # Space list component
│       └── BackupList.astro  # Backup list component
├── public/
│   └── favicon.svg
└── README.md
```

## Implementation Steps

### Step 1: Project Scaffolding
- Initialize Hono + Astro project
- Set up TypeScript config
- Create Docker Compose with Excalidraw container
- Set up SQLite database with schema

### Step 2: Reverse Proxy Core
- Hono server that listens on port 80/443
- Wildcard subdomain detection (`*.draw.domain.com`)
- Proxy requests to Excalidraw container
- Handle WebSocket connections (Excalidraw uses Yjs)

### Step 3: JavaScript Injection
- Middleware that intercepts HTML responses from Excalidraw
- Inject `<script>` tag before `</body>`
- Script reads `window.location.hostname` for space identifier
- Hook into Excalidraw's React API (`window.excalidrawAPI`)
- POST `.excalidraw` data to hub API on every autosave

### Step 4: Backup API
- `POST /api/backup` — receive `.excalidraw` data from injected script
- Deduplication: skip if file hash matches last backup
- Store in SQLite with space foreign key
- `GET /api/spaces/:id/backups` — list backups for a space
- `GET /api/backups/:id/download` — download `.excalidraw` file

### Step 5: Dashboard (Astro)
- List all spaces with subdomain links
- Create new space form (name → auto-generate subdomain)
- Delete space (with confirmation)
- View backup history per space
- Manual backup trigger (for initial setup or recovery)

### Step 6: Docker & Distribution
- Multi-stage Dockerfile (build Astro + Hono, run in production)
- docker-compose.yml with:
  - ExcaliHub container (port 80/443)
  - Excalidraw container (internal network only)
- Environment variables for configuration
- README with setup instructions

### Step 7: TLS & Certificates
- Option A: Hub handles TLS with Let's Encrypt (ACME)
- Option B: User provides existing reverse proxy with wildcard cert
- For v1, support Option B (user handles TLS externally)
- Document both approaches

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard — list all spaces |
| `GET` | `/spaces/new` | Create space form |
| `POST` | `/spaces` | Create new space |
| `GET` | `/spaces/:id` | Space detail + backups |
| `DELETE` | `/spaces/:id` | Delete space |
| `POST` | `/api/backup` | Receive auto-backup from injected script |
| `GET` | `/api/spaces/:id/backups` | List backups for space |
| `GET` | `/api/backups/:id` | Download backup file |
| `*` | `*.draw.domain.com/*` | Proxy to Excalidraw |

## Environment Variables

```env
# Server
PORT=80
HOST=0.0.0.0

# Domain
BASE_DOMAIN=draw.domain.com
EXCALIDRAW_CONTAINER=excalidraw:80

# Database
DB_PATH=/data/excalihub.db

# TLS (optional, for Let's Encrypt)
TLS_ENABLED=false
TLS_EMAIL=admin@domain.com
```

## Key Technical Challenges

1. **WebSocket proxying**: Excalidraw uses Yjs for real-time sync. The proxy must handle WebSocket upgrade correctly.

2. **Script injection reliability**: The injected script needs to find Excalidraw's React API. This may change between versions. Need to test with the specific Excalidraw image being used.

3. **Concurrent backups**: Multiple tabs editing the same space could cause backup conflicts. Use file hash deduplication to handle this.

4. **Large files**: `.excalidraw` files with embedded images can be large. Consider compression or external storage for v2.

## MVP Scope (v1)

- [ ] Hono server with subdomain routing
- [ ] Proxy to Excalidraw container
- [ ] JavaScript injection for auto-backup
- [ ] SQLite database for spaces + backups
- [ ] Astro dashboard (list/create/delete spaces)
- [ ] Backup API (receive, store, list, download)
- [ ] Docker Compose setup
- [ ] README with setup instructions

## Out of Scope (v2+)

- TLS/Let's Encrypt auto-provisioning
- User authentication
- Space sharing/collaboration
- Backup scheduling/retention policies
- Import/export of spaces
- Multiple Excalidraw instances for load balancing
