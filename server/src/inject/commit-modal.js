(() => {
  if (document.getElementById('hub-commit-modal-overlay')) return;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const host = port ? `${hostname}:${port}` : hostname;

  function getExcalidrawData() {
    try {
      const state = localStorage.getItem('excalidraw');
      if (state) {
        const parsed = JSON.parse(state);
        return JSON.stringify({
          type: 'excalidraw',
          version: 2,
          source: 'excalihub',
          elements: parsed.elements || [],
          appState: parsed.appState || {},
        });
      }
    } catch (e) {
      console.error('Failed to read Excalidraw data:', e);
    }
    return null;
  }

  function getSubdomainFromUrl() {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
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
      <div id="hub-commit-modal">
        <div id="hub-commit-modal-header">
          <h3>Commit to Git</h3>
          <button id="hub-commit-modal-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="hub-commit-modal-body">
          <textarea id="hub-commit-modal-message" placeholder="Commit message..."></textarea>
        </div>
        <div id="hub-commit-modal-footer">
          <button id="hub-commit-modal-cancel">Cancel</button>
          <button id="hub-commit-modal-submit">Commit</button>
        </div>
        <div id="hub-commit-modal-status" style="display: none;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const subdomain = getSubdomainFromUrl();
    const messageInput = document.getElementById('hub-commit-modal-message');
    const submitBtn = document.getElementById('hub-commit-modal-submit');
    const cancelBtn = document.getElementById('hub-commit-modal-cancel');
    const closeBtn = document.getElementById('hub-commit-modal-close');
    const statusEl = document.getElementById('hub-commit-modal-status');

    // Set default message
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
    messageInput.value = `Update ${subdomain || 'diagram'} - ${dateStr} ${timeStr}`;

    function closeModal() {
      overlay.remove();
    }

    async function handleSubmit() {
      const message = messageInput.value.trim();
      if (!message) {
        statusEl.textContent = 'Please enter a commit message';
        statusEl.className = 'error';
        statusEl.style.display = 'block';
        return;
      }

      const excalidrawData = getExcalidrawData();
      if (!excalidrawData) {
        statusEl.textContent = 'No diagram data found';
        statusEl.className = 'error';
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
          statusEl.className = 'success';
          statusEl.style.display = 'block';
          setTimeout(closeModal, 1500);
        } else {
          statusEl.textContent = result.error || 'Commit failed';
          statusEl.className = 'error';
          statusEl.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Commit';
        }
      } catch (err) {
        statusEl.textContent = 'Network error: ' + err.message;
        statusEl.className = 'error';
        statusEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Commit';
      }
    }

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    submitBtn.onclick = handleSubmit;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    // Auto-focus textarea
    setTimeout(() => messageInput.focus(), 100);
  }

  // Listen for open event from hub-menu.js
  window.addEventListener('hub-open-commit-modal', createModal);
})();
