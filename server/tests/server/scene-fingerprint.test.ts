import { describe, it, expect } from 'bun:test';
import { sceneFingerprint } from '../../src/scene-fingerprint.js';

function element(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    index: 'a0',
    version: 1,
    versionNonce: 111,
    updated: 1,
    isDeleted: false,
    groupIds: [],
    ...overrides,
  };
}

describe('sceneFingerprint', () => {
  it('is stable for identical elements', () => {
    expect(sceneFingerprint([element()])).toBe(sceneFingerprint([element()]));
  });

  it('ignores version bookkeeping fields', () => {
    const a = sceneFingerprint([element({ version: 1, versionNonce: 111, updated: 1 })]);
    const b = sceneFingerprint([element({ version: 9, versionNonce: 999, updated: 123456 })]);
    expect(a).toBe(b);
  });

  it('ignores object key order', () => {
    const a = sceneFingerprint([{ id: 'a', x: 1, y: 2 }]);
    const b = sceneFingerprint([{ y: 2, id: 'a', x: 1 }]);
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    expect(sceneFingerprint([element({ x: 10 })])).not.toBe(
      sceneFingerprint([element({ x: 11 })]),
    );
  });

  it('changes when z-order changes', () => {
    const first = sceneFingerprint([element({ id: 'a' }), element({ id: 'b' })]);
    const second = sceneFingerprint([element({ id: 'b' }), element({ id: 'a' })]);
    expect(first).not.toBe(second);
  });

  it('changes when nested content changes', () => {
    const a = sceneFingerprint([element({ points: [[0, 0], [1, 1]] })]);
    const b = sceneFingerprint([element({ points: [[0, 0], [2, 2]] })]);
    expect(a).not.toBe(b);
  });

  it('treats non-arrays as an empty scene', () => {
    expect(sceneFingerprint(null)).toBe(sceneFingerprint([]));
    expect(sceneFingerprint({})).toBe(sceneFingerprint([]));
  });

  it('returns a 16-char hex prefix', () => {
    expect(sceneFingerprint([element()])).toMatch(/^[a-f0-9]{16}$/);
  });
});
