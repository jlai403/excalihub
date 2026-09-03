let _createSpaceOpen = $state(false);

export function getCreateSpaceOpen() {
  return _createSpaceOpen;
}

export function setCreateSpaceOpen(value: boolean) {
  _createSpaceOpen = value;
}
