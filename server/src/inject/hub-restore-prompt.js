(() => {
  const hub = window.__excalihub;
  const spaceId = window.__SPACE_ID;
  if (!hub || !spaceId) return;
  if (document.getElementById('hub-restore-overlay')) return;

  const base = `/api/spaces/${encodeURIComponent(spaceId)}`;

  const get = (path) =>
    fetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  function localElements() {
    try {
      const raw = localStorage.getItem('excalidraw');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function fetchInfo() {
    const [space, backups, gitStatus] = await Promise.all([
      get(base),
      get(`${base}/backups`),
      get(`${base}/git-status`),
    ]);
    return {
      serverVersion: space?.scene_version ?? null,
      latest: Array.isArray(backups) ? backups[0] ?? null : null,
      gitStatus: gitStatus ?? null,
    };
  }

  async function fetchScene(params) {
    return get(`${base}/scene${params ? `?${params}` : ''}`);
  }

  // Applying a scene: adopt the server's current version as our base and record
  // the restored content as our local state, so the next load neither re-prompts
  // nor auto-pulls over it — and the sync loop pushes it as a new backup.
  function applyScene(scene, serverVersion) {
    hub.writeBase(serverVersion ?? '');
    hub.writeLocalHash(hub.hashElements(scene.elements));
    // The boot script re-hashes once Excalidraw's normalization settles.
    hub.markAdopting();
    hub.queueScene(scene);
  }

  function startFresh(serverVersion) {
    hub.writeBase(serverVersion ?? '');
    hub.writeLocalHash(hub.hashElements([]));
  }

  function formatTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  function close() {
    document.getElementById('hub-restore-overlay')?.remove();
  }

  function showModal({ title, message, actions }) {
    close();

    const overlay = document.createElement('div');
    overlay.id = 'hub-restore-overlay';

    const modal = document.createElement('div');
    modal.className = 'ex-modal';
    if (document.querySelector('.excalidraw.theme--dark')) {
      modal.classList.add('theme--dark');
    }

    const header = document.createElement('div');
    header.className = 'ex-modal__header';
    header.innerHTML = `<h3 class="ex-modal__title"></h3>`;
    header.querySelector('.ex-modal__title').textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ex-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = close;
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ex-modal__body';
    const text = document.createElement('p');
    text.className = 'hub-restore__text';
    text.textContent = message;
    body.appendChild(text);

    const actionList = document.createElement('div');
    actionList.className = 'hub-restore__actions';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `ex-modal__btn ${action.primary ? 'ex-modal__btn--primary' : 'ex-modal__btn--ghost'}`;
      btn.textContent = action.label;
      btn.setAttribute('data-restore-action', action.value);
      btn.onclick = () => {
        close();
        action.onClick();
      };
      actionList.appendChild(btn);
    }
    body.appendChild(actionList);

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
    document.body.appendChild(overlay);
  }

  function emptyPrompt({ serverVersion, latest, gitStatus }) {
    const actions = [];
    if (latest) {
      actions.push({
        value: 'backup',
        label: latest.createdAt ? `Restore backup (${formatTime(latest.createdAt)})` : 'Restore latest backup',
        primary: true,
        onClick: async () => {
          const scene = await fetchScene();
          if (scene) applyScene(scene, serverVersion);
        },
      });
    }
    if (gitStatus?.lastCommitAt) {
      actions.push({
        value: 'git',
        label: `Restore from git (${formatTime(gitStatus.lastCommitAt)})`,
        onClick: async () => {
          const scene = await fetchScene('source=git');
          if (scene) applyScene(scene, serverVersion);
        },
      });
    }
    actions.push({
      value: 'fresh',
      label: 'Start fresh',
      onClick: () => startFresh(serverVersion),
    });

    showModal({
      title: 'Restore this whiteboard?',
      message: 'This device has no local drawing, but a version exists on the server.',
      actions,
    });
  }

  function bootstrapPrompt({ serverVersion }) {
    showModal({
      title: 'Sync this whiteboard',
      message:
        'This device has a local drawing that has never synced with ExcaliHub. Which version should win?',
      actions: [
        {
          value: 'load-server',
          label: 'Load server version',
          primary: true,
          onClick: async () => {
            const scene = await fetchScene();
            if (scene) applyScene(scene, serverVersion);
          },
        },
        {
          value: 'keep-local',
          label: 'Keep this device',
          onClick: () => {
            hub.writeBase(serverVersion ?? '');
            hub.writeLocalHash(hub.hashElements(localElements()));
            window.__excalihubSync?.resume();
          },
        },
      ],
    });
  }

  function conflictPrompt(serverVersion) {
    showModal({
      title: 'This whiteboard changed elsewhere',
      message:
        'Another device saved a newer version. Loading it discards local changes; overwriting keeps this device and replaces the server copy.',
      actions: [
        {
          value: 'load-latest',
          label: 'Load latest',
          primary: true,
          onClick: async () => {
            const scene = await fetchScene();
            if (scene) applyScene(scene, serverVersion);
          },
        },
        {
          value: 'overwrite',
          label: 'Overwrite server',
          onClick: () => {
            // Drop the base version so the next push skips the stale guard.
            hub.writeBase('');
            window.__excalihubSync?.resume();
          },
        },
      ],
    });
  }

  function waitForAdoptSettle() {
    return new Promise((resolve) => {
      let tries = 0;
      const poll = () => {
        if (!hub.isAdopting() || tries++ > 40) return resolve();
        setTimeout(poll, 200);
      };
      poll();
    });
  }

  async function reconcile() {
    // Wait out an in-flight adopt: a reload can land before the boot script has
    // recorded the normalized local hash, and deciding then would misfire.
    if (hub.isAdopting()) await waitForAdoptSettle();

    const { serverVersion, latest, gitStatus } = await fetchInfo();
    const elements = localElements();
    const localHash = hub.hashElements(elements);
    const storedHash = hub.readLocalHash();
    const storedBase = hub.readBase();

    if (elements.length === 0) {
      if (!serverVersion) return;
      // Already chose "start fresh" for this version — don't nag.
      if (storedBase === serverVersion && storedHash === hub.hashElements([])) return;
      emptyPrompt({ serverVersion, latest, gitStatus });
      return;
    }

    if (!storedBase) {
      bootstrapPrompt({ serverVersion });
      return;
    }

    const localClean = !!storedHash && storedHash === localHash;
    const serverMoved = !!serverVersion && serverVersion !== storedBase;

    if (serverMoved && localClean) {
      const scene = await fetchScene();
      if (scene) applyScene(scene, serverVersion);
      return;
    }
    if (serverMoved && !localClean) {
      conflictPrompt(serverVersion);
    }
  }

  // The sync loop emits this when the server rejects a push as stale (typical
  // for an idle tab that never reloaded).
  window.addEventListener('hub-scene-conflict', async () => {
    const { serverVersion } = await fetchInfo();
    conflictPrompt(serverVersion);
  });

  reconcile();
})();
