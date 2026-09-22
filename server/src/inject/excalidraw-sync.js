(() => {
  if (window.__excalihub_synced) return;
  window.__excalihub_synced = true;

  const hub = window.__excalihub;
  const DEBUG = window.__EXCALIHUB_DEBUG ?? false;
  const parts = window.location.hostname.split('.');
  const subdomain = parts[0];
  const hubDomain = parts.slice(1).join('.');
  const hubHost = window.location.port ? `${hubDomain}:${window.location.port}` : hubDomain;
  const hubOrigin = `${window.location.protocol}//${hubHost}`;
  const spaceId = window.__SPACE_ID;

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

  function referencedFileIds(elements) {
    const ids = new Set();
    for (const el of elements) {
      if (el && typeof el === 'object' && typeof el.fileId === 'string') ids.add(el.fileId);
    }
    return [...ids];
  }

  // Upload any image files this scene references that we haven't sent yet, so
  // the per-space content store can serve them on other devices. Files are
  // content-addressed by Excalidraw's fileId, so each is uploaded once.
  async function uploadNewFiles(elements) {
    if (!spaceId || !hub) return;
    const ids = referencedFileIds(elements);
    if (ids.length === 0) return;
    const uploaded = hub.readUploaded();
    const missing = ids.filter((id) => !uploaded.has(id));
    if (missing.length === 0) return;

    let files;
    try {
      files = await hub.readFilesFromIDB(missing);
    } catch {
      return;
    }
    if (Object.keys(files).length === 0) return;

    try {
      const res = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (res.ok) {
        for (const id of Object.keys(files)) uploaded.add(id);
        hub.writeUploaded(uploaded);
        if (DEBUG) console.log('[ExcaliHub] uploaded files', Object.keys(files));
      } else if (DEBUG) {
        console.warn('[ExcaliHub] file upload rejected:', res.status);
      }
    } catch (err) {
      if (DEBUG) console.warn('[ExcaliHub] file upload failed:', err);
    }
  }

  async function sendBackup(elements, appState) {
    if (!elements) return;
    if (DEBUG) console.log('[ExcaliHub] Sending backup...');

    const body = { subdomain, elements, appState };
    const base = hub?.readBase();
    if (base) body.baseVersion = base;

    try {
      const res = await fetch(`${hubOrigin}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        paused = true;
        if (DEBUG) console.warn('[ExcaliHub] backup rejected as stale');
        window.dispatchEvent(
          new CustomEvent('hub-scene-conflict', {
            detail: { currentVersion: data.currentVersion ?? null },
          })
        );
        return;
      }
      if (!res.ok) {
        if (DEBUG) console.warn('[ExcaliHub] Backup rejected:', res.status, res.statusText);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (typeof data.version === 'string' && hub) hub.writeBase(data.version);
      try {
        if (hub) hub.writeLocalHash(hub.hashElements(JSON.parse(elements)));
      } catch {
        // ignore
      }
      if (DEBUG) console.log('[ExcaliHub] Backup saved');
    } catch (err) {
      console.error('[ExcaliHub] Backup failed:', err);
    }
  }

  let lastElements = null;
  let hasContent = false;
  let paused = false;

  setInterval(async () => {
    updateTabTitle();
    if (paused) return;

    const elements = localStorage.getItem('excalidraw');
    if (elements === lastElements) return;
    lastElements = elements;

    let parsed;
    try {
      parsed = JSON.parse(elements || '[]');
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;

    if (parsed.length > 0) hasContent = true;
    // Never back up a scene this tab has never held content in: a fresh or
    // idle tab must not overwrite a real backup with its empty scene.
    if (!hasContent) return;

    const appState = localStorage.getItem('excalidraw-state');
    await uploadNewFiles(parsed);
    await sendBackup(elements, appState);
  }, 5000);

  // The restore prompt uses these to pause auto-push while a conflict is
  // unresolved, and to resume after the user chooses to keep local content.
  window.__excalihubSync = {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastElements = null;
    },
  };

  if (DEBUG) console.log('[ExcaliHub] Sync enabled for space:', subdomain);
})();
