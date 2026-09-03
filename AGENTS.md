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
| `bun test:e2e` | Run Playwright e2e tests (chromium, firefox, webkit) in **dev** mode |
| `bun run test:e2e:docker` | Build + run Playwright e2e in **production** mode inside the **Docker image** (used by CI) |
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

### 2026-08-06 — Space name in Excalidraw tab title
- `proxyToExcalidraw` now captures the space (`const space = getSpaceBySubdomain(subdomain)`) and injects `window.__SPACE_NAME = ${JSON.stringify(space.name)}` into the sync-script wrapper (`proxy.ts:153`), alongside `__EXCALIHUB_DEBUG`.
- `excalidraw-sync.js` sets `document.title = \`${spaceName} · Excalidraw\`` at boot and re-asserts it in the existing 5s interval — but only when the scene has no custom name (parses `localStorage['excalidraw-state']` → `appState.name`), so a user-renamed scene keeps Excalidraw's own title.
- **E2E proxy no longer needs Docker**: new `tests/e2e/excalidraw-stub.ts` serves a minimal HTML page on `:8099`; `playwright.config.ts` points `EXCALIDRAW_CONTAINER` at it and registers it as a webServer (`reuseExistingServer: true`). This lets the proxy-injection path be tested without the `excalidraw/excalidraw:latest` container (CI runners have no Docker).
- New e2e test `space page sets Excalidraw tab title to the space name` (`proxy.e2e.ts`) asserts `page.toHaveTitle("Tab Title Test · Excalidraw")` after navigating to a space subdomain. Unit test asserts `window.__SPACE_NAME = "Space"` in the injected HTML. 54 e2e (3 projects) + 79 unit pass.

### 2026-08-27 — Bun 1.4.0 + TypeScript 7
- Upgraded Bun 1.3.14 → 1.4.0 (rewritten in Rust, Node 26.3 compat) and pinned to `1.4.0` everywhere: new `.bun-version` file, `Dockerfile` (`oven/bun:1.4.0`, builder + runtime), CI `oven-sh/setup-bun` `bun-version: 1.4.0` (was `latest`)
- TypeScript 6.0.3 → 7.0.2 (native Go compiler — `tsc` is the Go build now). Removed TS7-removed options: `ignoreDeprecations` (root `tsconfig.json`), `baseUrl` (server + hub `tsconfig.json`)
- Added `@types/bun` + `"bun"` in root tsconfig `types` — Bun globals (`Bun.serve`/`Bun.file`/`Bun.build`) were never typed; repo had **no typecheck before**
- Removed duplicate dead `getLatestBackupHash` from `server/src/repos/backup.ts` (was ambiguous with the canonical `space.ts` version; test now imports from `space.js`)
- Added typecheck: root `typecheck`/`typecheck:server` = `tsc --noEmit -p server` (tsc7), `typecheck:hub` = `astro check`. Hub pins `typescript@^6.0.0` because `astro check` needs TS6's programmatic API (TS7 ships none until 7.1 — withastro/roadmap#1321). Typecheck now runs in CI `test` job
- Playwright fix: hub webServer now sets `ASTRO_DEV_BACKGROUND=false` — Astro 7.1 auto-daemonizes its dev server under AI-agent environments (opencode + Bun 1.4), which made Playwright abort on "webServer exited early"
- Verified on Bun 1.4: typecheck clean (tsc7 + astro check), 70 unit + 30 e2e pass, `build` + `docker build` green, runtime `/health` 200, `droast` clean

### 2026-08-31 — Hub restricted to its subdomain when configured
- **Behavior**: when `HUB_SUBDOMAIN` is set, the hub dashboard is reachable **only** via the hub subdomain; the bare root/apex domain returns 404. When `HUB_SUBDOMAIN` is empty, the hub is served at the bare root instead.
- **Root cause of confusion**: `proxyMiddleware` served the hub for `host === env.BASE_DOMAIN` unconditionally, so bare `localhost` (dev, `BASE_DOMAIN=localhost`) rendered the dashboard alongside `excalihub.localhost`.
- **`proxy.ts`**: replaced the module-constant `hubHost` with a per-request `getHubHost()` that reads `process.env.HUB_SUBDOMAIN`/`process.env.BASE_DOMAIN` live (the `env` zod snapshot is frozen at import, so it can't react to test-time env changes). `extractSubdomain` returns `null` when no `HUB_SUBDOMAIN` is set. Serve condition: `host === hubHost || (!HUB_SUBDOMAIN && host === BASE_DOMAIN)`.
- **`api.ts` `/config`**: `hubHost` now reflects the same logic (bare `BASE_DOMAIN` when no `HUB_SUBDOMAIN`).
- **Tests**: `proxy.test.ts` — bare `example.com` now asserts 404 with `HUB_SUBDOMAIN` set; added a `hub routing without HUB_SUBDOMAIN` block (mutates `process.env.HUB_SUBDOMAIN`, proving the live read works). Full suite 82 unit pass + typecheck clean.
- **Docs**: README Quick Start + Homelab Deployment updated (step 5 = Access, step 6 = Up) to state the hub-subdomain restriction. This is why dev flows should always use `excalihub.localhost`.
- **Regression fix (same day)**: initial implementation read `process.env.HUB_SUBDOMAIN`/`BASE_DOMAIN` directly, bypassing the zod defaults in `env.ts` — in dev/e2e those vars aren't exported, so `getHubHost()` returned `''` and `excalihub.localhost` + `/api/*` broke (404). Fixed by resolving env through `envSchema.parse(process.env)` per request: exported `envSchema` from `env.ts`, `hubHostFor(e)` helper in `proxy.ts`, and `/config` uses the schema too. Also moved the `/api/*` pass-through to the top of `proxyMiddleware` so API routes are host-independent (dev Astro dev-server proxies `/api` to Hono with the apex `Host: localhost:4321`, which previously fell through the hub-subdomain gate → "Failed to load spaces").

### 2026-09-02 — Production serveHub 404 fix + production-mode CI e2e
- **Bug**: `/settings` (and any non-root Astro page) returned 404 in production. `serveHub` static path was `./dist/public{pathname}` — but Astro outputs directory routes (`settings/index.html`, `archived/index.html`), so `Bun.file(".../settings")` doesn't exist → fell through to Hono 404. Untested because no test set `NODE_ENV=production` (all tests/e2e ran the dev fetch-to-Astro path).
- **`proxy.ts` `serveHub`**: added `{path}/index.html` fallback after the direct path miss; refactored to take the live-parsed env `e` (per-request `envSchema.parse`) instead of the frozen `env` snapshot for `NODE_ENV`/`HUB_PORT` (matches the 2026-08-31 live-read pattern).
- **Unit test**: new `hub routing in production` block in `proxy.test.ts` — sets `process.env.NODE_ENV='production'`, writes a `dist/public` fixture (root, `settings/index.html`, `archived/index.html`), asserts root/directory serving + `next()` fall-through for missing files.
- **Prod e2e**: new `playwright.prod.config.ts` — serves the hub from `bun run dist/index.js` with `NODE_ENV=production` (no Astro dev server), plus the excalidraw stub on `:8099`. The webServer command copies `server/src/inject` → `./inject` before boot, mirroring the Docker runtime layout (`/app/inject`) where the bundled server resolves injection files from `dist/../inject`. `inject/` added to `.gitignore`.
- **Scripts**: `bun run test:e2e:prod` = `bun run build && bun playwright test --config playwright.prod.config.ts`. Local dev e2e unchanged (`bun run test:e2e` → dev config).
- **CI**: `ci.yml` e2e job now runs `bun run test:e2e:prod` (build + production-mode Playwright across 3 browsers) instead of the dev-mode `test:e2e`, keeping `E2E_GIT_REPO` + `E2E_SSH_PRIVATE_KEY`.
- **Verified**: 86 unit pass (+4), typecheck clean, `bun run test:e2e` (dev) and `test:e2e:prod` (prod) both green; prod run incl. git spec via varlock = 54 pass.

### 2026-09-02 — e2e runs in the Docker image + missing-runtime-binary fix
- **Bug**: `/settings` showed "Generating SSH key..." forever — no key to copy. Root cause: the `oven/bun:1.4.0` runtime image (Debian 13) ships **no `ssh-keygen`/`ssh`/`git`** (the app shells out to `ssh-keygen` to make the deploy key). `/api/git/ssh-key` 500'd, the store kept `null`, and `GitSettings.svelte`'s `{:else}` spinner rendered forever. The whole Git integration (connect/commit) was broken in production for the same reason.
- **`Dockerfile`**: runtime stage now `apt-get install -y --no-install-recommends git openssh-client` before `USER bun` (root install step). `openssh-client` = `ssh-keygen` + `ssh`; `git` for simple-git.
- **`e2e:prod` → `e2e:docker`**: renamed `test:e2e:prod` → `test:e2e:docker`, `playwright.prod.config.ts` → `playwright.docker.config.ts`. e2e now runs against the **built Docker image**, not the host bundle — so missing runtime binaries are actually caught. Sets `E2E_DOCKER=1`.
- **Container lifecycle** (`globalSetup.ts` + new `globalTeardown.ts`): `globalSetup` seeds `data-e2e` (SSH deploy key), `docker build . -t excalihub:e2e`, then `docker run -d --rm --name excalihub-e2e -p 8081:8081 --add-host host.docker.internal:host-gateway -v $PWD/data-e2e:/data -e ...`, polling `/api/config` until ready. `globalTeardown` does `docker rm -f`. The excalidraw stub stays a host webServer on `:8099` (proxied via `host.docker.internal:8099`). The `./inject` copy step is gone — the image bakes `/app/inject`. Throws a clear "use `test:e2e` for host mode" error when no Docker (not silent skip).
- **CI**: `ci.yml` e2e job runs `bun run test:e2e:docker` (which builds the image in globalSetup, doubling as the image build gate); the standalone `build` job was dropped. `lint` unchanged. Git spec runs in-container (git status/connect/commit against `jlai403/excalihub-ci` via the bind-mounted `data-e2e` SSH key).
- **Graceful errors**: `generateSSHKeyPair` wraps `ssh-keygen` in try/catch with a readable "install openssh-client" error; `/api/git/ssh-key` returns `{error}` (500) instead of an opaque throw; the store (`git.svelte.ts`) retains `_sshError`; `GitSettings.svelte` renders the error instead of the indefinite "Generating SSH key..." spinner.
- **Regression test**: `hub.e2e.ts` "settings renders the SSH public key" asserts `/settings` shows text matching `^ssh-ed25519 ` (and not "Generating SSH key..."). Runs unconditionally (not gated on `E2E_SSH_PRIVATE_KEY`), so it catches the missing-`ssh-keygen` class even without the git deploy key.
- **To redeploy the fix** to `excalihub.ts.jlai.ca`: rebuild + republish the image (`docker-publish.yml`) and re-run the external rollout — the repo only owns the image.

### 2026-09-02 — Git integration supports self-hosted hosts (not just GitHub)
- `connectGitRepo` URL validation was hardcoded to `git@github\.com:...` and the generated SSH config wrote a fixed `Host github.com` block — self-hosted repos (e.g. `git.ts.jlai.ca`) were rejected with "Invalid repository URL".
- Added `parseRepoUrl()` (`server/src/services/git.ts`) accepting both `git@host:user/repo.git` (SCP) and `ssh://git@host[:port]/user/repo.git` (URL form — the only form where `:443` is a real port; in SCP form the colon splits host from path so `:443` would become a path dir, not a port). Returns `{ host, port? }`.
- SSH config now writes `Host <host>` / `HostName <host>` / `Port <port>` (only when present) so a non-standard port like 443 resolves, while GitHub keeps connecting on port 22.
- UI copy in `GitSettings.svelte` generalized off "GitHub": placeholder/helper + intro + deploy-key text now say "repository".
- 7 new `parseRepoUrl` unit tests (SCP GitHub, SCP self-hosted, ssh:// with/without port, rejects https/non-.git/non-ssh). 93 unit pass (+7), typecheck clean, 57 docker e2e pass.
- To use `git.ts.jlai.ca` over its port-443 SSH, enter `ssh://git@git.ts.jlai.ca:443/jlai/excalihub-spaces.git` (NOT the scp-with-443 form).
