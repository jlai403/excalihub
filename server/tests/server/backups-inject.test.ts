import { describe, it, expect } from 'bun:test';
import { parseBackupScene as parsePreview } from '../../src/inject/hub-backup-preview.js';
import { backupTime } from '../../src/inject/hub-backup-preview.js';
import { parseBackupScene as parseModal } from '../../src/inject/hub-backups.js';

const element = { id: 'a1', type: 'rectangle', x: 10, y: 20 };

function backupFile(appState = {}) {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalihub',
    elements: [element],
    appState,
    files: {},
  });
}

describe('parseBackupScene (hub-backup-preview.js)', () => {
  it('extracts elements and appState from a backup file', () => {
    const scene = parsePreview(backupFile({ theme: 'dark' }))!;
    expect(scene.elements).toEqual([element]);
    expect(scene.appState).toEqual({ theme: 'dark' });
  });

  it('handles an empty elements array', () => {
    const fileData = JSON.stringify({
      type: 'excalidraw',
      elements: [],
      appState: {},
    });
    expect(parsePreview(fileData)).toEqual({ elements: [], appState: {} });
  });

  it('returns null on invalid JSON or non-array elements', () => {
    expect(parsePreview('not-json')).toBeNull();
    expect(parsePreview(JSON.stringify({ type: 'excalidraw' }))).toBeNull();
  });
});

describe('parseBackupScene (hub-backups.js)', () => {
  it('extracts elements and appState from a backup file', () => {
    const scene = parseModal(backupFile({ name: 'My diagram' }))!;
    expect(scene.elements).toEqual([element]);
    expect(scene.appState).toEqual({ name: 'My diagram' });
  });

  it('defaults appState to {} when absent', () => {
    const scene = parseModal(backupFile())!;
    expect(scene.appState).toEqual({});
  });

  it('returns null on invalid JSON', () => {
    expect(parseModal('{')).toBeNull();
  });
});

describe('backupTime', () => {
  it('formats the unix timestamp prefix from a backup filename', () => {
    const ts = 1735689600000;
    const date = new Date(backupTime(`${ts}-abc-1234.excalidraw`));
    expect(date.getTime()).toBe(ts);
  });

  it('returns the filename when it has no timestamp prefix', () => {
    expect(backupTime('random-name')).toBe('random-name');
  });
});