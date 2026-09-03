# 0001: Cmd+K command palette

## Status

Accepted

## Context

ExcaliHub needed a keyboard-driven command palette for navigating spaces, triggering actions, and changing settings without leaving the keyboard.

## Decisions

### bits-ui Command over cmdk-sv

cmdk-sv (the Svelte port of cmdk) is archived/deprecated — its author redirected to the `Command` component in bits-ui v2. Since ExcaliHub already uses bits-ui v2 via shadcn-svelte, adding the shadcn `command` component (backed by bits-ui) costs no new dependency and is the maintained path.

### Always-mounted in Layout

The palette is lightweight and a shell-level concern. Always-mounted in `Layout.astro` gives instant open with no lazy-mount complexity, matching how the Sidebar already lives in Layout.

### Palette-as-dispatcher, not palette-as-form

"Create Space" from the palette sets a shared `createSpaceOpen` store that opens the existing `CreateSpaceForm` dialog, rather than the palette itself becoming a form. Keeps validation/error UX in the dialog and the palette as a pure action dispatcher. (Git actions are likewise navigate-only for v1.)
