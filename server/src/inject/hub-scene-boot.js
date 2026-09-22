// Runs first on every space/backup page, before Excalidraw's deferred app
// bundle. Applies a queued scene and exposes shared helpers on
// `window.__excalihub` for the sync and restore scripts.
//
// Why queueing exists: writing `excalidraw`/`excalidraw-state` and reloading is
// racy against the live app — Excalidraw flushes its in-memory scene on unload,
// clobbering the write. Instead we stash the scene under a sessionStorage key
// Excalidraw ignores and apply it on the next load, before the app reads
// browser storage.
(() => {
  const PENDING_KEY = 'excalihub-pending-scene';
  const BASE_KEY = 'excalihub-scene-version';
  const HASH_KEY = 'excalihub-local-hash';
  const UPLOADED_KEY = 'excalihub-uploaded-files';
  const ADOPT_KEY = 'excalihub-adopting';
  const VOLATILE = new Set(['version', 'versionNonce', 'updated']);

  function canonicalValue(value) {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
      return out;
    }
    return value;
  }

  function canonicalElement(element) {
    if (!element || typeof element !== 'object') return canonicalValue(element);
    const out = {};
    for (const key of Object.keys(element).sort()) {
      if (VOLATILE.has(key)) continue;
      out[key] = canonicalValue(element[key]);
    }
    return out;
  }

  // Content fingerprint of the elements (order preserved = z-order matters,
  // version bookkeeping dropped). Any deterministic hash works — the client
  // only ever compares its own hashes to each other.
  function hashElements(elements) {
    const list = Array.isArray(elements) ? elements : [];
    const json = JSON.stringify(list.map(canonicalElement));
    let h = 0x811c9dc5;
    for (let i = 0; i < json.length; i++) {
      h ^= json.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function openFilesDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('files-db');
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files-store')) {
          db.createObjectStore('files-store');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function writeFilesToIDB(files) {
    const entries = Object.entries(files || {});
    if (entries.length === 0) return;
    const db = await openFilesDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files-store', 'readwrite');
      const store = tx.objectStore('files-store');
      for (const [id, file] of entries) store.put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function readFilesFromIDB(ids) {
    const list = ids || [];
    const out = {};
    if (list.length === 0) return out;
    const db = await openFilesDb();
    await new Promise((resolve) => {
      const tx = db.transaction('files-store', 'readonly');
      const store = tx.objectStore('files-store');
      let pending = list.length;
      for (const id of list) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) out[id] = req.result;
          if (--pending === 0) resolve();
        };
        req.onerror = () => {
          if (--pending === 0) resolve();
        };
      }
    });
    db.close();
    return out;
  }

  function readUploaded() {
    try {
      return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  function writeUploaded(set) {
    try {
      localStorage.setItem(UPLOADED_KEY, JSON.stringify([...set]));
    } catch {
      // ignore
    }
  }

  function applyPending() {
    let raw;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
    let scene;
    try {
      scene = JSON.parse(raw);
    } catch {
      return;
    }
    if (!scene || !Array.isArray(scene.elements)) return;
    try {
      localStorage.setItem('excalidraw', JSON.stringify(scene.elements));
      localStorage.setItem('excalidraw-state', JSON.stringify(scene.appState ?? {}));
    } catch {
      // ignore quota / storage access errors
    }
    writeFilesToIDB(scene.files).catch(() => {});
  }

  window.__excalihub = {
    keys: { BASE_KEY, HASH_KEY, UPLOADED_KEY, ADOPT_KEY },
    hashElements,
    writeFilesToIDB,
    readFilesFromIDB,
    readUploaded,
    writeUploaded,
    readBase: () => localStorage.getItem(BASE_KEY),
    writeBase: (v) => localStorage.setItem(BASE_KEY, v ?? ''),
    readLocalHash: () => localStorage.getItem(HASH_KEY),
    writeLocalHash: (v) => localStorage.setItem(HASH_KEY, v ?? ''),
    isAdopting: () => localStorage.getItem(ADOPT_KEY) === '1',
    markAdopting: () => localStorage.setItem(ADOPT_KEY, '1'),
    doneAdopting: () => localStorage.removeItem(ADOPT_KEY),
    queueScene: (scene) => {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(scene));
      } catch {
        return;
      }
      window.location.reload();
    },
  };

  // After adopting server content (restore/auto-pull) Excalidraw re-serializes
  // the scene on boot, so a hash taken from the raw server elements won't match
  // the normalized local elements. Wait for localStorage to stabilize, then
  // record the real hash — otherwise the next load would see a phantom
  // "unsynced edit" and prompt a conflict over content that's actually in sync.
  function settleAdopted() {
    if (localStorage.getItem(ADOPT_KEY) !== '1') return;
    let last = null;
    let stable = 0;
    const started = Date.now();

    const tick = () => {
      let current = null;
      try {
        current = localStorage.getItem('excalidraw');
      } catch {
        return;
      }
      if (current !== null) {
        if (current === last) stable++;
        else stable = 0;
        last = current;
      }
      if (stable >= 2 || Date.now() - started > 8000) {
        try {
          window.__excalihub.writeLocalHash(
            hashElements(JSON.parse(current || '[]')),
          );
          window.__excalihub.doneAdopting();
        } catch {
          // ignore
        }
        return;
      }
      setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  }

  applyPending();
  settleAdopted();
})();
