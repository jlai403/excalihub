import { createHash } from 'crypto';

// Bookkeeping fields Excalidraw bumps on every mutation. Dropping them makes
// the fingerprint track content, not edit-count (versionNonce is random per
// version, so it differs between clients holding the same drawing).
const VOLATILE_ELEMENT_KEYS = new Set(['version', 'versionNonce', 'updated']);

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

// Array order is preserved: it encodes z-order, which is visual content.
function canonicalElement(element: unknown): unknown {
  if (!element || typeof element !== 'object') return canonicalValue(element);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(element as Record<string, unknown>).sort()) {
    if (VOLATILE_ELEMENT_KEYS.has(key)) continue;
    out[key] = canonicalValue((element as Record<string, unknown>)[key]);
  }
  return out;
}

export function sceneFingerprint(elements: unknown): string {
  const list = Array.isArray(elements) ? elements : [];
  const canonical = JSON.stringify(list.map(canonicalElement));
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
