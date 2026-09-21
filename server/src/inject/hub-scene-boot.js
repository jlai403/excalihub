// Applies a queued scene before Excalidraw boots, then exposes a helper to
// queue one.
//
// Why this exists: writing `excalidraw`/`excalidraw-state` and then reloading
// is racy against the live app — Excalidraw flushes its in-memory scene on
// unload, clobbering the write before the reload. Instead we stash the scene
// under a key Excalidraw ignores (sessionStorage, per tab) and apply it on the
// next page load. Injected scripts are classic and run during parsing, while
// Excalidraw's app bundle is a deferred module that mounts afterwards, so this
// write always lands before Excalidraw reads browser storage.
(() => {
  const PENDING_KEY = 'excalihub-pending-scene';

  function applyPending() {
    let raw;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
    let scene;
    try {
      scene = JSON.parse(raw);
    } catch {
      return;
    }
    if (!scene || !Array.isArray(scene.elements)) return;
    try {
      localStorage.setItem('excalidraw', JSON.stringify(scene.elements));
      localStorage.setItem('excalidraw-state', JSON.stringify(scene.appState ?? {}));
    } catch {
      // ignore quota / storage access errors
    }
  }

  window.__excalihubQueueScene = (scene) => {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(scene));
    } catch {
      return;
    }
    window.location.reload();
  };

  applyPending();
})();
