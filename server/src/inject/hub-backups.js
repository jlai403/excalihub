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

function applyScene(scene) {
  // Queued via the boot script and applied on the next page load, so the live
  // Excalidraw's unload flush can't overwrite it (see hub-scene-boot.js).
  window.__excalihubQueueScene(scene);
}

if (typeof module !== 'undefined') {
  module.exports = { parseBackupScene };
}

(typeof window !== 'undefined' && typeof document !== 'undefined' ? (() => {
  function formatTime(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  }

  async function loadBackups(spaceId, listEl, emptyEl, statusEl) {
    const res = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/backups`);
    if (!res.ok) {
      statusEl.textContent = 'Failed to load backups';
      statusEl.className = 'ex-modal__status ex-modal__status--error';
      statusEl.style.display = 'block';
      return;
    }
    const backups = await res.json();
    listEl.innerHTML = '';
    emptyEl.style.display = backups.length ? 'none' : 'block';

    const tierOrder = ['daily', 'weekly', 'monthly', 'older'];
    const tierNames = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', older: 'Older' };
    for (const tier of tierOrder) {
      const tierBackups = tier === 'older'
        ? backups.filter((b) => !b.tier)
        : backups.filter((b) => b.tier === tier);
      if (!tierBackups.length) continue;

      const heading = document.createElement('div');
      heading.className = 'ex-backups__tier';
      heading.setAttribute('data-backup-tier', tier);
      heading.textContent = tierNames[tier];
      listEl.appendChild(heading);

      for (const backup of tierBackups) {
        const row = document.createElement('div');
        row.className = 'ex-backups__row';

        const time = document.createElement('span');
        time.className = 'ex-backups__time';
        time.textContent = formatTime(backup.createdAt);
        time.title = backup.filename;

        const actions = document.createElement('div');
        actions.className = 'ex-backups__actions';

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'ex-modal__btn ex-modal__btn--primary';
        restoreBtn.textContent = 'Restore';
        restoreBtn.onclick = () => handleRestore(spaceId, backup, statusEl, restoreBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'ex-backups__btn--delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = async () => {
          if (!confirm(`Delete backup from ${formatTime(backup.createdAt)}?`)) return;
          await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/backups/${encodeURIComponent(backup.filename)}`, {
            method: 'DELETE',
          });
          await loadBackups(spaceId, listEl, emptyEl, statusEl);
        };

        actions.appendChild(restoreBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(time);
        row.appendChild(actions);
        listEl.appendChild(row);
      }
    }
  }

  async function handleRestore(spaceId, backup, statusEl, restoreBtn) {
    if (!confirm(`Restore backup from ${formatTime(backup.createdAt)}? This replaces the current scene.`)) return;
    restoreBtn.disabled = true;
    statusEl.style.display = 'none';

    const res = await fetch(`/api/backups/${encodeURIComponent(backup.filename)}`);
    if (!res.ok) {
      statusEl.textContent = 'Failed to load backup';
      statusEl.className = 'ex-modal__status ex-modal__status--error';
      statusEl.style.display = 'block';
      restoreBtn.disabled = false;
      return;
    }

    const scene = parseBackupScene(await res.text());
    if (!scene) {
      statusEl.textContent = 'Invalid backup file';
      statusEl.className = 'ex-modal__status ex-modal__status--error';
      statusEl.style.display = 'block';
      restoreBtn.disabled = false;
      return;
    }

    applyScene(scene);
  }

  function createModal() {
    if (document.getElementById('hub-backups-overlay')) return;

    const spaceId = window.__SPACE_ID;
    if (!spaceId) return;

    const overlay = document.createElement('div');
    overlay.id = 'hub-backups-overlay';
    overlay.innerHTML = `
      <div class="ex-modal">
        <div class="ex-modal__header">
          <h3 class="ex-modal__title">Backups</h3>
          <button class="ex-modal__close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="ex-modal__body">
          <div class="ex-backups__list"></div>
          <p class="ex-backups__empty" style="display: none;">No backups yet</p>
        </div>
        <div class="ex-modal__footer">
          <span class="ex-backups__note">Restoring replaces the current scene.</span>
        </div>
        <div class="ex-modal__status" style="display: none;"></div>
      </div>
    `;

    if (document.querySelector('.excalidraw.theme--dark') || document.body.classList.contains('theme--dark')) {
      overlay.classList.add('theme--dark');
    }
    document.body.appendChild(overlay);

    const listEl = overlay.querySelector('.ex-backups__list');
    const emptyEl = overlay.querySelector('.ex-backups__empty');
    const statusEl = overlay.querySelector('.ex-modal__status');

    const closeBtn = overlay.querySelector('.ex-modal__close');
    closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    loadBackups(spaceId, listEl, emptyEl, statusEl);
  }

  window.addEventListener('hub-open-backups-modal', createModal);
})()
  : undefined);