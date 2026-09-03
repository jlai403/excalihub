import { type Theme, getTheme, setTheme as _setTheme } from "$lib/utils/theme";

let _theme: Theme = $state(getTheme());

export function getThemeState(): Theme {
  return _theme;
}

export function setThemeState(t: Theme) {
  _theme = t;
  _setTheme(t);
}
