// Pure: parse an .excalidraw backup file into a scene we can write to localStorage.
function parseBackupScene(fileData) {
  let parsed;
  try {
    parsed = JSON.parse(fileData);
  } catch (e) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const elements = Array.isArray(parsed) ? parsed : parsed.elements;
  if (!Array.isArray(elements)) return null;
  const appState = !Array.isArray(parsed) && parsed.appState && typeof parsed.appState === 'object'
    ? parsed.appState
    : {};
  return { elements, appState };
}

function backupTime(filename) {
  const match = filename.match(/^(\d+)-/);
  return match ? new Date(parseInt(match[1])).toLocaleString() : filename;
}

if (typeof module !== 'undefined') {
  module.exports = { parseBackupScene, backupTime };
}

(typeof window !== 'undefined' && typeof document !== 'undefined' ? (() => {
  const config = window.__BACKUP_PREVIEW;
  if (!config) return;

  const protocol = window.location.protocol;
  const port = window.location.port;
  const hubHost = port ? `${config.hubHost}:${port}` : config.hubHost;
  const MARKER_KEY = 'excalihub-backup-preview';

  function getApplied() {
    try {
      return JSON.parse(localStorage.getItem(MARKER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function renderBanner(text) {
    document.querySelector('#hub-backup-preview')?.remove();

    const banner = document.createElement('div');
    banner.id = 'hub-backup-preview';
    banner.innerHTML = `
      <span class="hub-preview__text">${text}</span>
      <span class="hub-preview__actions">
        <a class="hub-preview__btn" href="${protocol}//${config.space}.${hubHost}">Open ${config.space}</a>
        <a class="hub-preview__btn" href="${protocol}//${hubHost}">Back to ExcaliHub</a>
      </span>
    `;
    document.body.appendChild(banner);
  }

  function applyAndReload() {
    // The scene endpoint resolves referenced image files from the store; fall
    // back to the raw backup file when we don't have a space id.
    const request = config.spaceId
      ? fetch(
          `/api/spaces/${encodeURIComponent(config.spaceId)}/scene?filename=${encodeURIComponent(config.filename)}`
        ).then((res) => {
          if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
          return res.json();
        })
      : fetch(`/api/backups/${encodeURIComponent(config.filename)}`).then((res) => {
          if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
          return res.text().then(parseBackupScene);
        });

    request
      .then((scene) => {
        if (!scene || !Array.isArray(scene.elements)) throw new Error('invalid backup file');
        localStorage.setItem(MARKER_KEY, JSON.stringify({ filename: config.filename }));
        // Applied by hub-scene-boot.js on the next load, before Excalidraw boots.
        window.__excalihub?.queueScene(scene);
      })
      .catch((err) => {
        console.error('[ExcaliHub] Failed to load backup preview:', err);
        renderBanner(`Failed to load backup: ${err.message}`);
      });
  }

  // Only render the banner once this backup's scene is actually applied —
  // otherwise the banner flashes on the pre-reload page while the fetch is
  // still in flight, and callers (tests, demo) can observe it before the
  // applied scene is readable from localStorage.
  if (getApplied()?.filename === config.filename) {
    renderBanner(`Viewing backup from ${backupTime(config.filename)}`);
  } else {
    applyAndReload();
  }
})()
  : undefined);