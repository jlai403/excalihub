(() => {
  if (document.getElementById('hub-menu-container')) return;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const hubHost = window.__hubHost || `excalihub.${hostname.split('.').slice(-2).join('.')}`;
  const gitEnabled = window.__GIT_ENABLED === 'true';

  const items = [
    {
      label: 'Back to ExcaliHub',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      action: () => { window.location.href = `${protocol}//${hubHost}`; },
    },
    {
      label: 'Commit to Git',
      disabled: !gitEnabled,
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>',
      action: gitEnabled
        ? () => { window.dispatchEvent(new CustomEvent('hub-open-commit-modal')); }
        : () => { window.location.href = `${protocol}//${hubHost}/settings`; },
    },
  ];

  function buildDropdown() {
    const dd = document.createElement('div');
    dd.className = 'ex-menu-dropdown';
    items.forEach((item) => {
      const el = document.createElement('button');
      el.className = 'ex-menu-item';
      if (item.disabled) {
        el.disabled = true;
        el.title = 'Configure Git in Settings';
      }
      el.innerHTML = `${item.icon}<span>${item.label}</span>`;
      el.onclick = () => { dd.style.display = 'none'; isOpen = false; item.action(); };
      dd.appendChild(el);
    });
    return dd;
  }

  function positionDropdown(btn, dd) {
    const rect = btn.getBoundingClientRect();
    dd.style.left = `${rect.left}px`;
    dd.style.top = `${rect.bottom + 4}px`;
    const ddRect = dd.getBoundingClientRect();
    if (ddRect.right > window.innerWidth) {
      dd.style.left = `${window.innerWidth - ddRect.width - 8}px`;
    }
  }

  let isOpen = false;
  let dropdown = null;

  function init() {
    const anchor = document.querySelector('[data-testid="main-menu-trigger"]');
    if (!anchor) return setTimeout(init, 200);

    const btn = document.createElement('button');
    btn.className = 'ex-menu-btn';
    btn.innerHTML = '<img src="/excalihub-icon.png" alt="ExcaliHub" width="20" height="20">';
    btn.title = 'ExcaliHub menu';

    const container = anchor.closest('.excalidraw-ui-top-left');
    if (container) {
      container.appendChild(btn);
    } else {
      anchor.insertAdjacentElement('afterend', btn);
    }

    dropdown = buildDropdown();
    if (document.querySelector('.excalidraw.theme--dark') || document.body.classList.contains('theme--dark')) {
      dropdown.classList.add('theme--dark');
    }
    document.body.appendChild(dropdown);

    btn.onclick = (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      dropdown.style.display = isOpen ? 'block' : 'none';
      if (isOpen) positionDropdown(btn, dropdown);
    };

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && dropdown && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
        isOpen = false;
      }
    });

    window.addEventListener('resize', () => {
      if (isOpen && dropdown) positionDropdown(btn, dropdown);
    });
  }

  init();
})();
