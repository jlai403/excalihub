(() => {
  if (document.getElementById('hub-palette-overlay')) return;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const hubHost = window.__hubHost || `excalihub.${hostname.split('.').slice(-2).join('.')}`;
  const gitEnabled = window.__GIT_ENABLED === 'true';
  const currentSubdomain = hostname.split('.')[0];

  const overlay = document.createElement('div');
  overlay.id = 'hub-palette-overlay';
  overlay.className = 'ex-palette-overlay';
  overlay.innerHTML = '<div class="ex-palette"><input id="hub-palette-input" class="ex-palette__input" type="text" placeholder="Search ExcaliHub..." autocomplete="off" spellcheck="false"><div class="ex-palette__list"></div></div>';
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#hub-palette-input');
  const list = overlay.querySelector('.ex-palette__list');

  let webUrl = null;
  let webUrlChecked = false;
  let spaces = [];
  let query = '';
  let highlight = 0;

  function isDark() {
    return document.querySelector('.excalidraw.theme--dark') !== null || document.body.classList.contains('theme--dark');
  }

  function refreshTheme() {
    overlay.classList.toggle('theme--dark', isDark());
  }

  function buildItems() {
    const items = spaces
      .filter((s) => s.status === 'active' && s.subdomain !== currentSubdomain)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        group: 'Spaces',
        label: s.name,
        action: () => { window.location.href = `${protocol}//${s.subdomain}.${hubHost}`; },
      }));
    items.push({
      group: 'Actions',
      label: 'Commit to Git',
      disabled: !gitEnabled,
      title: 'Configure Git in Settings',
      action: () => { window.dispatchEvent(new CustomEvent('hub-open-commit-modal')); },
    });
    if (webUrl) {
      items.push({
        group: 'Actions',
        label: 'Repo',
        action: () => { window.open(webUrl, '_blank'); },
      });
    }
    items.push({
      group: 'Actions',
      label: 'Back to ExcaliHub',
      action: () => { window.location.href = `${protocol}//${hubHost}`; },
    });
    return items;
  }

  function visibleItems() {
    const q = query.trim().toLowerCase();
    if (!q) return buildItems();
    return buildItems().filter((it) => it.label.toLowerCase().includes(q));
  }

  function render() {
    const vis = visibleItems();
    if (highlight >= vis.length) highlight = 0;
    list.innerHTML = '';
    let group = null;
    vis.forEach((it, i) => {
      if (it.group !== group) {
        group = it.group;
        const heading = document.createElement('div');
        heading.className = 'ex-palette__heading';
        heading.textContent = group;
        list.appendChild(heading);
      }
      const row = document.createElement('div');
      row.className = 'ex-palette__item';
      row.textContent = it.label;
      if (it.disabled) {
        row.classList.add('ex-palette__item--disabled');
        row.title = it.title;
      }
      if (!it.disabled && i === highlight) row.classList.add('ex-palette__item--active');
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!it.disabled) activate(it);
      });
      list.appendChild(row);
    });
  }

  function activate(it) {
    close();
    it.action();
  }

  function select(delta) {
    const vis = visibleItems();
    if (vis.length === 0) return;
    let next = highlight;
    for (let i = 0; i < vis.length; i++) {
      next = (next + delta + vis.length) % vis.length;
      if (!vis[next].disabled) break;
    }
    if (!vis[next].disabled) {
      highlight = next;
      render();
    }
  }

  function onInputKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === 'ArrowDown') select(1);
    else if (e.key === 'ArrowUp') select(-1);
    else if (e.key === 'Enter' && !visibleItems()[highlight]?.disabled) activate(visibleItems()[highlight]);
    else if (e.key === 'Escape') close();
  }

  function open() {
    if (overlay.style.display === 'flex') return;
    query = '';
    highlight = 0;
    input.value = '';
    refreshTheme();
    ensureWebUrl();
    fetchSpaces();
    overlay.style.display = 'flex';
    render();
    input.focus();
  }

  function close() {
    overlay.style.display = 'none';
  }

  function fetchSpaces() {
    fetch('/api/spaces')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          spaces = data;
          render();
        }
      })
      .catch(() => {});
  }

  function ensureWebUrl() {
    if (webUrlChecked) return;
    webUrlChecked = true;
    fetch('/api/git/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg && cfg.connected === true) webUrl = cfg.webUrl || null;
        render();
      })
      .catch(() => {});
  }

  input.addEventListener('input', () => {
    query = input.value;
    highlight = 0;
    render();
  });
  input.addEventListener('keydown', onInputKeydown);

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== 'k') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  }, true);

  window.addEventListener('hub-open-palette', () => open());

  new MutationObserver(refreshTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();