# Security Policy

## Reporting a vulnerability

Report security issues privately — use GitHub's
[private vulnerability reporting](https://github.com/jlai403/excalihub/security/advisories/new)
or contact the maintainer listed on the GitHub profile. Please do not open a
public issue for a security report. We aim to acknowledge reports within a few
days.

## Threat model

ExcaliHub is built for a **single operator or a trusted team**, not for
unauthenticated multi-tenant use. Understand these properties before exposing it:

- **There is no authentication.** Every API route and page is open to anyone who
  can reach the server. A visitor can create, rename, and delete spaces; list
  and download every backup; and view every whiteboard.
- **The Git integration is powerful.** Once a repository is connected, the app
  pushes scene data to it using its own deploy key, and `POST /api/git/connect`
  accepts any reachable host. An attacker who can reach the API can re-point the
  integration at a repository they control and exfiltrate all scenes, or make
  the server open SSH connections to arbitrary hosts.
- **Subdomain isolation is organizational, not a security boundary.** Each space
  gets its own browser origin (useful for separating projects and local
  storage), but no access control separates spaces or users.

## Safe deployment

Always place ExcaliHub behind at least one of:

- a VPN or private network, or
- an authenticating reverse proxy (terminating TLS).

Do not port-forward it directly to the public internet. The bundled
`docker-compose.yml` is a starting point, not a hardened public deployment.

## Notes

- The app's SSH deploy key is generated at runtime and stored under
  `DATA_DIR/git-config` (private key mode `600`). Treat the data directory as
  sensitive: it holds every whiteboard, backup, and the deploy key.
- Git connections use `StrictHostKeyChecking no` (trust-on-first-use) so
  self-hosted hosts work without a `known_hosts` entry. This does not detect a
  man-in-the-middle on the first connection.
