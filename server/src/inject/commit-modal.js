// Build the commit payload from Excalidraw's localStorage state.
//
// Excalidraw stores the scene as a bare elements array under `excalidraw` and
// the appState object under `excalidraw-state` (see excalidraw-app/LocalData.ts
// and app_constants.ts). A `{ elements, appState }` wrapper is also accepted
// for robustness.
function buildCommitData(elementsRaw, appStateRaw) {
  let parsed;
  try {
    parsed = elementsRaw ? JSON.parse(elementsRaw) : null;
  } catch (e) {
    console.error('Failed to read Excalidraw data:', e);
    return null;
  }
  if (!parsed) return null;

  const elements = Array.isArray(parsed) ? parsed : parsed.elements || [];

  let appState = {};
  if (appStateRaw) {
    try {
      appState = JSON.parse(appStateRaw);
    } catch {
      appState = {};
    }
  } else if (!Array.isArray(parsed) && parsed.appState) {
    appState = parsed.appState;
  }

  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'excalihub',
    elements,
    appState,
  });
}

if (typeof module !== 'undefined') {
  module.exports = { buildCommitData };
}

(typeof window !== 'undefined' && typeof document !== 'undefined' ? (() => {
  if (document.getElementById('hub-commit-modal-overlay')) return;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const host = port ? `${hostname}:${port}` : hostname;

  function getExcalidrawData() {
    return buildCommitData(
      localStorage.getItem('excalidraw'),
      localStorage.getItem('excalidraw-state'),
    );
  }

  function getSubdomainFromUrl() {
    const parts = hostname.split('.');
    if (parts.length > 2) return parts[0];
    return null;
  }

  async function exportToPng() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  }

  function createModal() {
    const overlay = document.createElement('div');
    overlay.id = 'hub-commit-modal-overlay';
    overlay.innerHTML = `
      <div class="ex-modal">
        <div class="ex-modal__header">
          <h3 class="ex-modal__title">Commit to Git</h3>
          <button class="ex-modal__close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="ex-modal__body">
          <textarea id="hub-commit-modal-message" class="ex-modal__textarea" placeholder="Commit message..."></textarea>
        </div>
        <div class="ex-modal__footer">
          <button class="ex-modal__btn ex-modal__btn--ghost">Cancel</button>
          <button class="ex-modal__btn ex-modal__btn--primary">Commit</button>
        </div>
        <div class="ex-modal__status" style="display: none;"></div>
      </div>
    `;

    if (document.querySelector('.excalidraw.theme--dark') || document.body.classList.contains('theme--dark')) {
      overlay.classList.add('theme--dark');
    }
    document.body.appendChild(overlay);

    const subdomain = getSubdomainFromUrl();
    const messageInput = document.getElementById('hub-commit-modal-message');
    const submitBtn = overlay.querySelector('.ex-modal__btn--primary');
    const cancelBtn = overlay.querySelector('.ex-modal__btn--ghost');
    const closeBtn = overlay.querySelector('.ex-modal__close');
    const statusEl = overlay.querySelector('.ex-modal__status');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
    messageInput.value = `Update ${subdomain || 'diagram'} - ${dateStr} ${timeStr}`;

    function closeModal() { overlay.remove(); }

    async function handleSubmit() {
      const message = messageInput.value.trim();
      if (!message) {
        statusEl.textContent = 'Please enter a commit message';
        statusEl.className = 'ex-modal__status ex-modal__status--error';
        statusEl.style.display = 'block';
        return;
      }

      const excalidrawData = getExcalidrawData();
      if (!excalidrawData) {
        statusEl.textContent = 'No diagram data found';
        statusEl.className = 'ex-modal__status ex-modal__status--error';
        statusEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Committing...';
      statusEl.style.display = 'none';

      try {
        const pngBase64 = await exportToPng();

        const response = await fetch('/api/git/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: subdomain || 'unknown',
            excalidrawData,
            pngBase64: pngBase64 ? pngBase64.split(',')[1] : null,
            message,
          }),
        });

        const result = await response.json();

        if (result.success) {
          statusEl.textContent = 'Committed successfully!';
          statusEl.className = 'ex-modal__status ex-modal__status--success';
          statusEl.style.display = 'block';
          setTimeout(closeModal, 1500);
        } else {
          statusEl.textContent = result.error || 'Commit failed';
          statusEl.className = 'ex-modal__status ex-modal__status--error';
          statusEl.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Commit';
        }
      } catch (err) {
        statusEl.textContent = 'Network error: ' + err.message;
        statusEl.className = 'ex-modal__status ex-modal__status--error';
        statusEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Commit';
      }
    }

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    submitBtn.onclick = handleSubmit;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    setTimeout(() => messageInput.focus(), 100);
  }

  window.addEventListener('hub-open-commit-modal', createModal);
})()
  : undefined);
