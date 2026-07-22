(() => {
  if (window.__excalihub_synced) return;
  window.__excalihub_synced = true;

  const parts = window.location.hostname.split('.');
  const subdomain = parts[0];
  const hubDomain = parts.slice(1).join('.');
  let backupTimeout = null;

  async function sendBackup(elements, appState) {
    if (!elements) return;

    try {
      const res = await fetch(`${window.location.protocol}//${hubDomain}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, elements, appState }),
      });
      if (!res.ok) {
        console.warn('[ExcaliHub] Backup rejected:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('[ExcaliHub] Backup failed:', err);
    }
  }

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);

    if (key === 'excalidraw' || key === 'excalidraw-state') {
      if (backupTimeout) clearTimeout(backupTimeout);
      backupTimeout = setTimeout(() => {
        const elements = localStorage.getItem('excalidraw');
        const appState = localStorage.getItem('excalidraw-state');
        sendBackup(elements, appState);
      }, 1000);
    }
  };

  console.log('[ExcaliHub] Sync enabled for space:', subdomain);
})();
