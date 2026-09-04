let _createSpaceOpen = $state(false);

export function getCreateSpaceOpen() {
  return _createSpaceOpen;
}

export function setCreateSpaceOpen(value: boolean) {
  _createSpaceOpen = value;
}

let _paletteOpen = $state(false);

export function getPaletteOpen() {
  return _paletteOpen;
}

export function setPaletteOpen(value: boolean) {
  _paletteOpen = value;
}
