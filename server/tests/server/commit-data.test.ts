import { describe, it, expect } from 'bun:test';
import { buildCommitData } from '../../src/inject/commit-modal.js';

const element = { id: 'a1', type: 'rectangle', x: 10, y: 20 };

describe('buildCommitData', () => {
  it('parses a bare elements array (Excalidraw localStorage format)', () => {
    const elementsRaw = JSON.stringify([element]);
    const appStateRaw = JSON.stringify({ theme: 'dark' });

    const payload = JSON.parse(buildCommitData(elementsRaw, appStateRaw)!);

    expect(payload.type).toBe('excalidraw');
    expect(payload.source).toBe('excalihub');
    expect(payload.elements).toEqual([element]);
    expect(payload.appState).toEqual({ theme: 'dark' });
  });

  it('parses an empty elements array', () => {
    const payload = JSON.parse(buildCommitData('[]', null)!);

    expect(payload.elements).toEqual([]);
    expect(payload.appState).toEqual({});
  });

  it('accepts a { elements, appState } wrapper', () => {
    const elementsRaw = JSON.stringify({
      type: 'excalidraw',
      elements: [element],
      appState: { theme: 'light' },
    });

    const payload = JSON.parse(buildCommitData(elementsRaw, null)!);

    expect(payload.elements).toEqual([element]);
    expect(payload.appState).toEqual({ theme: 'light' });
  });

  it('reads appState from the separate excalidraw-state key', () => {
    const elementsRaw = JSON.stringify([element]);
    const appStateRaw = JSON.stringify({ name: 'My diagram' });

    const payload = JSON.parse(buildCommitData(elementsRaw, appStateRaw)!);

    expect(payload.appState).toEqual({ name: 'My diagram' });
  });

  it('returns null when elements are missing', () => {
    expect(buildCommitData(null, null)).toBeNull();
    expect(buildCommitData('', null)).toBeNull();
  });

  it('returns null on invalid JSON', () => {
    expect(buildCommitData('not-json', null)).toBeNull();
  });
});
