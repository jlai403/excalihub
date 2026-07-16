(() => {
  // Don't inject twice
  if (window.__excalihub_synced) return;
  window.__excalihub_synced = true;

  const subdomain = window.location.hostname.split('.')[0];
  
  // Debounce backup requests
  let backupTimeout: ReturnType<typeof setTimeout> | null = null;
  
  async function sendBackup(elements: string | null, appState: string | null) {
    if (!elements) return;
    
    try {
      await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain,
          elements,
          appState,
        }),
      });
    } catch (err) {
      console.error('[ExcaliHub] Backup failed:', err);
    }
  }
  
  // Intercept localStorage.setItem
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key: string, value: string) {
    originalSetItem.call(this, key, value);
    
    // Detect Excalidraw saves
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
