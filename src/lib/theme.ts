const KEY = "sa-theme";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function initTheme() {
  setTheme(getTheme());
  // Printing from dark mode would emit light text on white paper — flip to
  // light for the print job and restore afterwards.
  window.addEventListener("beforeprint", () => document.documentElement.classList.remove("dark"));
  window.addEventListener("afterprint", () => {
    if (getTheme() === "dark") document.documentElement.classList.add("dark");
  });
}
