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

### 2026-07-31 — Git integration: deploy key fix + backup/git separation
- **Deploy key fix**: added `IdentitiesOnly yes` to SSH config template (`git.ts`) + existing `data/git-config/.ssh/config` — forces SSH to use the app's `id_ed25519` only, ignoring ssh-agent keys (was `ERROR: Repository not found`)
- **Backup/git separation**: auto-backups (5s loop, 7-4-12 retention, hash dedup) no longer dirty git
  - `prepareSpacesRepo()` writes `.gitignore` (`*/backups/`), untracks committed backups on connect (one-time cleanup, `git rm -r --cached --ignore-unmatch '**/backups/*'` — note trailing-slash pathspec silently no-ops)
  - `commitAndPush` overwrites canonical `{subdomain}.excalidraw`/`.png` instead of timestamped copies
  - `getSpaceGitStatus()` returns `{ lastCommitAt, lastCommitMessage, hasUncommittedChanges }`; dirty signal = `latestBackupTs > lastCommitAt` (timestamp parsed from `latest_backup` filename), no porcelain count
- `GET /api/spaces/:id/git-status` endpoint (404 unknown space, `null` when not connected)
- Space cards: status-based icons (`GitCommitHorizontal` amber = unsaved, `CircleCheckBig` green = synced, `GitBranch` gray = no commits), relative time + absolute time tooltip
- Tooltip component (`hub/src/lib/components/ui/tooltip/`) requires `Tooltip.Provider` ancestor (bits-ui v2 error: `Context "Tooltip.Provider" not found`)
- `prepareSpacesRepo` tested in `service.test.ts` (real git repo via `simple-git`); 4 git-status API tests

### 2026-07-31 — Git integration e2e (Stream B)
- **`tests/e2e/git.e2e.ts`**: 7-test serial Playwright spec — invalid URL rejection, connect, no-commits badge, commit→synced badge, unsaved-changes badge, remote commit verification, disconnect
- **Persistent deploy key** (registered ONCE on `jlai403/excalihub-ci`, id `159025064`): the spec does NOT manage it — no list/register/delete calls. The "connects" test proves the key works (`connectGitRepo` runs `git ls-remote origin HEAD`). If the key is ever lost, connect fails with "Cannot access remote repository" → manual re-registration needed (no self-healing)
- **Stable SSH keypair via secret, NOT committed**: `globalSetup.ts` seeds `data-e2e/git-config/id_ed25519{,.pub}` from `E2E_SSH_PRIVATE_KEY` (writes key with trailing-newline normalization, chmod 600, derives pubkey via `ssh-keygen -y`); server's `GET /api/git/ssh-key` then returns the stable pubkey. Local: 1P field `e2e ssh key` on item `github PAT jlai403-excalihub-ci` → `.env.schema` `exec('op read ...')`. CI: `secrets.E2E_SSH_PRIVATE_KEY` on `jlai403/excalihub`. Spec skips (not fails) when `E2E_SSH_PRIVATE_KEY` absent
- `bun run test:e2e:local` — varlock-injected local run; spec skips (not fails) when `E2E_SSH_PRIVATE_KEY` absent
- **`connectGitRepo` robustness**: `mkdirSync` spaces dir before `simpleGit` (fresh data dir) + pull-merges remote history on first connect (`git pull origin main --allow-unrelated-histories`) so repeated connects/pushes fast-forward (GitHub refuses deleting the default branch)
- **E2E infra**: `globalSetup.ts` kills stale 8081/4321 listeners before wiping `data-e2e` (stale `bun --watch` orphans + Astro 7 dev daemon survive previous runs); `playwright.config.ts` sets `ASTRO_DEV_BACKGROUND=1` (Astro 7 daemonizes `astro dev` by default — CLI exits 0, breaks Playwright webServer tracking)
- **E2E git spec space names are per-project AND per-run timestamped** (`Git E2E {project} {Date.now()}`) — otherwise the pull-merged remote history finds prior runs' commits for the same subdomain path, breaking "No commits yet"
- CI e2e job: `concurrency: ci-e2e` (no cancel-in-progress), `env: E2E_GIT_REPO=jlai403/excalihub-ci` + `E2E_SSH_PRIVATE_KEY`

### 2026-08-01 — Git e2e CI green + spec diagnostics
- Root cause of CI e2e failure: `E2E_GIT_TOKEN` secret on `jlai403/excalihub` held a stale value → `GET /repos/jlai403/excalihub-ci/keys` in `beforeAll` returned non-2xx deterministically (all 3 projects × retries); refreshing the secret value → CI e2e green. Token scope for the spec was `Administration: R/W` (deploy keys) + `Contents: R/W` (commit read) — NO `Actions` needed (token since removed entirely — see 2026-08-01 token removal entry)
- `git.e2e.ts` diagnostics (removed with the token): `expectOk()` helper threw GitHub API `status` + body; `/user` auth sanity check asserted `login === jlai403`; `beforeAll` logged `[git.e2e] project/owner/repo/tokenLen` — CI failures were self-describing
- CI e2e run pushes `e2e commit`s to `jlai403/excalihub-ci` on every run (per-project × per-run timestamped subdomains); the shared repo accumulates these

### 2026-08-01 — Persistent e2e deploy key (no more notification spam)
- **Churn root cause**: `globalSetup.ts` wiped `data-e2e` → app regenerated its SSH keypair → each `beforeAll` registered a NEW `excalihub-e2e` deploy key → GitHub emailed on every add (deploy-key email toggle is org-only; `excalihub-ci` is a User repo — no setting exists). Also, the old reuse check `k.key.trim() === publicKey` NEVER matched: GitHub strips the trailing ` excalihub-e2e` comment from `key`, while `GET /api/git/ssh-key` returns it with the comment
- **Fix**: stable keypair seeded from secret + fingerprint-token matching. `globalSetup.ts` writes `data-e2e/git-config/id_ed25519{,.pub}` from `E2E_SSH_PRIVATE_KEY` (normalizes missing trailing `\n` — `op item edit` strips it and `ssh-keygen -y` fails on a key without final newline). `beforeAll` compares `type + base64` tokens (`fingerprint = s.trim().split(/\s+/).slice(0,2).join(" ")`) and registers the canonical `fingerprint(publicKey)` form. Result: persistent deploy key id `159025064` — 3 consecutive green `test:e2e:local` runs all logged `reusing deploy key 159025064`, GitHub key `created_at` unchanged, zero adds
- **Flaky remote-verify fix**: after a push, the GitHub commits API is eventually consistent and can flip back to stale — a `expect.poll` that passed then a SECOND bare GET raced into `[]` → `Cannot read properties of undefined (reading 'commit')`. Now the poll returns `commits[0]?.commit?.message` and asserts `.toContain("e2e commit")` on that same response — one call, no race window
- **New env**: `E2E_SSH_PRIVATE_KEY` — repo secret on `jlai403/excalihub` (CI), 1P field `e2e ssh key` on item `github PAT jlai403-excalihub-ci` (local via varlock). Spec skips unless `E2E_SSH_PRIVATE_KEY` is set

### 2026-08-01 — E2E token removed (SSH-only verification)
- **`E2E_GIT_TOKEN` deleted entirely** from the spec, `.env.schema`, CI env, and 1P. The git e2e no longer touches the GitHub REST API — no deploy-key management, no `/user` check, no commits API
- **Remote-verify via git fetch, not REST**: the "pushes the commit" test creates a temp repo, `git remote add origin git@github.com:...`, and `git fetch origin main` with `GIT_SSH_COMMAND="ssh -i data-e2e/git-config/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=no"`, then asserts `git log -1 --format=%s FETCH_HEAD -- <subdomain>/` contains "e2e commit". The git protocol is strongly consistent (no CDN replication lag) — the REST-API eventual-consistency flake is gone entirely. Uses the same SSH identity that pushed (no independent-identity verification)
- **Deploy-key management dropped** — the "connects" test proves the key via `connectGitRepo`'s `git ls-remote origin HEAD`. Persistent key `159025064` is the single source of truth; self-healing registration no longer exists (manual re-registration if lost)
- **Cleanup**: repo secret `E2E_GIT_TOKEN` deleted from `jlai403/excalihub`, 1P `add more/password` (PAT) field deleted (item keeps `e2e ssh key`)

### 2026-08-06 — E2E key migrated to `excalihub-ci ssh key raw` (recovered from corrupt SSH_KEY item)
- **1P SSH_KEY items are unreliable**: `op read` returns a malformed PKCS#8 blob — the header declares an 81-byte SEQUENCE for a 46-byte Ed25519 structure (trailing garbage → `ASN.1 parsing error: extra data` in python-cryptography/LibreSSL), and the desktop app shows OpenSSH (it converts on display). `op item edit` on SSH_KEY category is unsupported by the CLI ("SSH Key item editing in the CLI is not yet supported"), and desktop edits regenerate/replace the keypair.
- **Recovery trick**: the 32-byte seed inside the corrupt PKCS#8 is intact. Locate `\x2b\x65\x70\x04\x22\x04\x20` (OID + headers) in the decoded DER, take the next 32 bytes, rebuild via `Ed25519PrivateKey.from_private_bytes(seed)` → `private_bytes(Encoding.PEM, PrivateFormat.OpenSSH, NoEncryption())`. Derived pubkey matched the registered deploy key exactly.
- **New canonical local key store**: Password-category 1P item **`excalihub-ci ssh key raw`** (id `wfuoqi5uljguwy4k7p23qycnse`) — the OpenSSH key lives in the `password` field (PASSWORD items store text verbatim; avoids the SSH_KEY conversion bug). `.env.schema`: `E2E_SSH_PRIVATE_KEY=exec('op read "op://dev/excalihub-ci ssh key raw/password"')`.
- **op reference gotcha**: `(` is an invalid character in `op://` references — item titles must avoid parentheses (`excalihub-ci ssh key (raw)` fails; renamed to `excalihub-ci ssh key raw`).
- **New GitHub deploy key on `jlai403/excalihub-ci`**: pubkey `ssh-ed25519 ...IF0EQXyw8iJAnfdCGgtmad3kgiNzJKcirqCOEOaIKs1b` (fp `SHA256:MU553bd0OKFfN+pyHqWjgOVtb5+f0a+f8aiKhoYjUp8`), private key = the recovered seed (`92ac69...`). `E2E_SSH_PRIVATE_KEY` secret on `jlai403/excalihub` updated to the OpenSSH-format key.
- **Verified**: `bun run test:e2e:local` 51/51 + `bun test` 79 pass with the new key; CI green. Old 1P item `github PAT jlai403-excalihub-ci` deleted; old deploy key id `159025064` pending deletion.
