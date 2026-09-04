// Varlock runtime integration for the local e2e path only.
//
// `test:e2e:local` and `bun run prune:e2e` are wrapped in `varlock run`, which
// injects the resolved `__VARLOCK_ENV` blob. Importing `varlock/auto-load`
// reuses that blob to activate in-process console redaction + leak detection
// (sensitive values are masked in the child's own output, not just the pipe).
//
// Guarded on __VARLOCK_ENV presence so paths that never run under varlock are
// untouched:
// - test:e2e (plain): no blob → skip → the git spec's ENV-based skip guard
//   stays accurate (no literal exec() expression leaks into process.env).
// - test:e2e:docker (CI): E2E_DOCKER=1 → skip. CI injects the key as a plain
//   env var and has no varlock/1Password, so auto-load would fail resolving
//   .env.schema's placeholder op:// reference.
if (process.env.E2E_DOCKER !== "1" && process.env.__VARLOCK_ENV) {
  await import("varlock/auto-load");
}