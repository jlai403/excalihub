(() => {
  if (window.__excalihub_bubble) return;
  window.__excalihub_bubble = true;

  const parts = window.location.hostname.split('.');
  const hubDomain = parts.slice(1).join('.');

  function inject() {
    const container = document.querySelector('.excalidraw-ui-top-right');
    if (!container) return false;

    const btn = document.createElement('a');
    btn.id = 'excalihub-button';
    btn.className = 'excalidraw-button';
    btn.href = `${window.location.protocol}//${hubDomain}`;
    btn.textContent = 'ExcaliHub';
    container.prepend(btn);
    return true;
  }

  let attempts = 0;
  const interval = setInterval(() => {
    if (inject() || ++attempts > 30) clearInterval(interval);
  }, 100);
})();
