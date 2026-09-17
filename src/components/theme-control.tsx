"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

const themeStorageKey = "laaw-life:theme:v1";
type Theme = "system" | "light" | "dark";

function validTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

function subscribe(notify: () => void): () => void {
  const syncStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey || event.key === null) {
      document.documentElement.dataset.theme = validTheme(event.newValue);
      notify();
    }
  };
  window.addEventListener("storage", syncStorage);
  window.addEventListener("laaw-theme-change", notify);
  return () => {
    window.removeEventListener("storage", syncStorage);
    window.removeEventListener("laaw-theme-change", notify);
  };
}

function getTheme(): Theme {
  return validTheme(document.documentElement.dataset.theme);
}

function getServerTheme(): Theme {
  return "system";
}

export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  useLayoutEffect(() => {
    // Development remounts may clear the attribute applied before hydration.
    try {
      document.documentElement.dataset.theme = validTheme(window.localStorage.getItem(themeStorageKey));
      window.dispatchEvent(new Event("laaw-theme-change"));
    } catch {
      // Keep the device setting or the theme already applied in this visit.
    }
  }, []);

  return (
    <label className="theme-control">
      <span>Appearance</span>
      <select
        value={theme}
        onChange={(event) => {
          const nextTheme = validTheme(event.target.value);
          document.documentElement.dataset.theme = nextTheme;
          try {
            window.localStorage.setItem(themeStorageKey, nextTheme);
          } catch {
            // The control still works for this visit when storage is unavailable.
          }
          window.dispatchEvent(new Event("laaw-theme-change"));
        }}
      >
        <option value="system">Use device setting</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
