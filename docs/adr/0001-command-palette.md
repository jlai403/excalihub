# 0001: Command palette (Cmd+K / Super+K / Ctrl+K trigger)

## Status

Accepted

## Context

ExcaliHub needed a keyboard-driven command palette for navigating spaces, triggering actions, and changing settings without leaving the keyboard.

## Trigger: Cmd+K / Super+K / Ctrl+K

The palette opens on `Cmd+K` (macOS), `Super+K` (Linux), and `Ctrl+K` (Windows) — all reported by the browser as `metaKey` or `ctrlKey`, so a single `(metaKey || ctrlKey)` guard covers every platform chord.

The listener is registered in the **capture phase** (via `$effect` + `window.addEventListener("keydown", handler, { capture: true })`) and calls `preventDefault()` + `stopImmediatePropagation()`. This is how sites like Loom win the shortcut over Zen Browser's soft "Focus Search" binding: Zen treats `Cmd+K` as page-interceptable (unlike hard-reserved keys such as `Cmd+T`/`Cmd+W`), so a capture-phase handler that stops propagation blocks Zen's chrome handler. If `Cmd+K` were a hard-reserved key, no site code could override it.

## Decisions

### bits-ui Command over cmdk-sv

cmdk-sv (the Svelte port of cmdk) is archived/deprecated — its author redirected to the `Command` component in bits-ui v2. Since ExcaliHub already uses bits-ui v2 via shadcn-svelte, adding the shadcn `command` component (backed by bits-ui) costs no new dependency and is the maintained path.

### Always-mounted in Layout

The palette is lightweight and a shell-level concern. Always-mounted in `Layout.astro` gives instant open with no lazy-mount complexity, matching how the Sidebar already lives in Layout.

### Palette-as-dispatcher, not palette-as-form

"Create Space" from the palette sets a shared `createSpaceOpen` store that opens the existing `CreateSpaceForm` dialog, rather than the palette itself becoming a form. Keeps validation/error UX in the dialog and the palette as a pure action dispatcher. (Git actions are likewise navigate-only for v1.)
