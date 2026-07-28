(() => {
  if (document.getElementById('hub-menu-container')) return;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const host = port ? `${hostname}:${port}` : hostname;

  // Determine hub host from injected config or fallback
  const hubHost = window.__hubHost || `excalihub.${hostname.split('.').slice(-2).join('.')}`;

  // Determine git enabled from injected config
  const gitEnabled = window.__GIT_ENABLED === 'true';

  // Create container
  const container = document.createElement('div');
  container.id = 'hub-menu-container';
  container.style.cssText = `
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // Create button
  const btn = document.createElement('button');
  btn.id = 'hub-menu-btn';
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`;
  btn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid rgba(0,0,0,0.1);
    background: white;
    color: #333;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: all 0.15s ease;
  `;
  btn.onmouseenter = () => { btn.style.background = '#f5f5f5'; };
  btn.onmouseleave = () => { btn.style.background = 'white'; };

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.id = 'hub-menu-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 36px;
    left: 0;
    background: white;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 180px;
    display: none;
    overflow: hidden;
  `;

  // Menu items
  const items = [
    {
      label: 'Back to ExcaliHub',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      action: () => {
        window.location.href = `${protocol}//${hubHost}`;
      },
    },
  ];

  if (gitEnabled) {
    items.push({
      label: 'Commit to Git',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>',
      action: () => {
        // Dispatch custom event to open commit modal
        window.dispatchEvent(new CustomEvent('hub-open-commit-modal'));
      },
    });
  }

  items.forEach((item) => {
    const el = document.createElement('button');
    el.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: #333;
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      transition: background 0.1s ease;
    `;
    el.innerHTML = `${item.icon}<span>${item.label}</span>`;
    el.onmouseenter = () => { el.style.background = '#f5f5f5'; };
    el.onmouseleave = () => { el.style.background = 'transparent'; };
    el.onclick = () => {
      dropdown.style.display = 'none';
      item.action();
    };
    dropdown.appendChild(el);
  });

  // Toggle dropdown
  let isOpen = false;
  btn.onclick = (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    dropdown.style.display = isOpen ? 'block' : 'none';
  };

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.style.display = 'none';
      isOpen = false;
    }
  });

  container.appendChild(btn);
  container.appendChild(dropdown);
  document.body.appendChild(container);
})();
