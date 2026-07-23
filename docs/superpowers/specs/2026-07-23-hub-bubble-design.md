# Hub Bubble — Back-to-Hub Navigation Element

**Date:** 2026-07-23
**Status:** Approved

## Problem

When editing a whiteboard in Excalidraw via a space subdomain, there is no visible link back to the ExcaliHub dashboard. Users must manually edit the URL to return to the hub.

## Solution

Inject a minimal "← Hub" pill badge into the Excalidraw page, positioned to the right of the top-left dropdown menu. The pill is a clickable link that navigates back to the hub home page.

## Architecture

**Approach:** Proxy-injected CSS + JS (Option B)

| File | Purpose | Status |
|---|---|---|
| `server/src/inject/hub-bubble.css` | Bubble styles | NEW |
| `server/src/inject/hub-bubble.js` | DOM creation + positioning | NEW |
| `server/src/middleware/proxy.ts` | Inject CSS + JS into HTML responses | MODIFIED |
| `server/tests/server/proxy.test.ts` | Unit tests for injection markers | MODIFIED |

**Injection order** (before `</body>`):

```html
<style data-excalihub-bubble>{hub-bubble.css}</style>
<script data-excalihub-bubble>{hub-bubble.js}</script>
<script data-excalihub-sync>{excalidraw-sync.js}</script>
```

## Design

### CSS (`hub-bubble.css`)

- `position: fixed`, `z-index: 99999`
- Initial `top: 12px`, `left: 200px` (fallback, refined by JS)
- Pill shape: `border-radius: 6px`, subtle border + shadow
- Font: `inherit`, 12px, `#333` on `#f0f0f0`
- Hover state: slightly darker background + stronger shadow

### JS (`hub-bubble.js`)

1. Guard: `window.__excalihub_bubble` prevents double-init
2. Create `<div id="excalihub-bubble"><a href="{protocol}//{hubDomain}">← Hub</a></div>`
3. Subdomain extraction: same logic as `excalidraw-sync.js` (parse `window.location.hostname`)
4. Position: wait for Excalidraw DOM, find `.dropdown-menu-event-wrapper`, measure `getBoundingClientRect()`, set `left` to `right + 8px`
5. Fallback: if element not found within 3s, keep CSS default position
6. Always visible — no dismiss, no localStorage state

### Proxy Changes (`proxy.ts`)

- Add `bubbleCss` and `bubbleScript` module-level variables (same pattern as `injectedScript`)
- Read `hub-bubble.css` and `hub-bubble.js` from disk at startup via `getInjectedBubbleCss()` and `getInjectedBubbleScript()`
- In `proxyToExcalidraw()`, append CSS and JS tags to the injection string

## Testing

### Unit Tests (proxy.test.ts)

- HTML responses contain `excalihub-bubble` in `<style>` tag
- HTML responses contain `excalihub-bubble` in `<script>` tag
- Non-HTML responses pass through without bubble injection
- Existing sync script injection tests remain green

### No E2E Tests

The bubble depends on Excalidraw's rendered DOM (`.dropdown-menu-event-wrapper`). E2E testing would require Excalidraw to be running and rendered, which is outside the current e2e test scope. The proxy injection contract is covered by unit tests.

## Out of Scope

- Dismiss/close functionality
- Position persistence (drag or remember position)
- Re-enable mechanism
- Hub dashboard settings for bubble configuration
