# Contributing

Thanks for your interest in ExcaliHub.

## Ground rules

- `main` is protected — all changes go through a branch and a pull request.
- All tests must pass before you push: `bun test` and `bun run test:e2e`
  (Docker is required for e2e).
- Use [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`,
  `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Releases are automated from
  these messages with release-please.

## Development

See the [README](README.md#development). In short:

```bash
bun install
bun run dev       # Hono + Astro dev server + Excalidraw container
```

Before opening a PR:

```bash
bun test              # unit/integration
bun run typecheck
bun run test:e2e      # Playwright against a real Excalidraw (requires Docker)
```

## Reporting security issues

Please do not open a public issue for a security report — see
[SECURITY.md](SECURITY.md).
