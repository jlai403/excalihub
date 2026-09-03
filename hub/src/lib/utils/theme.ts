export type Theme = "system" | "light" | "dark";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(t: Theme) {
  const resolved = t === "system" ? getSystemTheme() : t;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function getTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) || "system";
}

export function setTheme(t: Theme) {
  localStorage.setItem("theme", t);
  applyTheme(t);
}
