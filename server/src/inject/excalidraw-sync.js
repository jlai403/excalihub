(() => {
  if (window.__excalihub_synced) return;
  window.__excalihub_synced = true;

  const DEBUG = window.__EXCALIHUB_DEBUG ?? false;
  const parts = window.location.hostname.split('.');
  const subdomain = parts[0];
  const hubDomain = parts.slice(1).join('.');

  const spaceName = window.__SPACE_NAME ?? '';
  const DESIRED_TITLE = spaceName ? `${spaceName} · Excalidraw` : null;
  if (DESIRED_TITLE) document.title = DESIRED_TITLE;

  function updateTabTitle() {
    if (!DESIRED_TITLE || document.title === DESIRED_TITLE) return;
    try {
      const appState = JSON.parse(localStorage.getItem('excalidraw-state') || '{}');
      if (!appState.name) document.title = DESIRED_TITLE;
    } catch {
      document.title = DESIRED_TITLE;
    }
  }

  async function sendBackup(elements, appState) {
    if (!elements) return;

    if (DEBUG) console.log('[ExcaliHub] Sending backup...');
    try {
      const res = await fetch(`${window.location.protocol}//${hubDomain}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, elements, appState }),
      });
      if (res.ok) {
        if (DEBUG) console.log('[ExcaliHub] Backup saved');
      } else {
        if (DEBUG) console.warn('[ExcaliHub] Backup rejected:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('[ExcaliHub] Backup failed:', err);
    }
  }

  let lastElements = null;
  let lastAppState = null;

  setInterval(() => {
    updateTabTitle();

    const elements = localStorage.getItem('excalidraw');
    const appState = localStorage.getItem('excalidraw-state');
    if (elements !== lastElements || appState !== lastAppState) {
      lastElements = elements;
      lastAppState = appState;
      sendBackup(elements, appState);
    }
  }, 5000);

  if (DEBUG) console.log('[ExcaliHub] Sync enabled for space:', subdomain);
})();
