import { useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

export type AccentId =
  | "violet"
  | "blue"
  | "teal"
  | "green"
  | "amber"
  | "orange"
  | "pink"
  | "red";

export const THEME_MODES: ReadonlyArray<{
  id: ThemeMode;
  labelKey: string;
}> = [
  { id: "system", labelKey: "settings.themeSystem" },
  { id: "light", labelKey: "settings.themeLight" },
  { id: "dark", labelKey: "settings.themeDark" },
];

export const ACCENTS: ReadonlyArray<{
  id: AccentId;
  labelKey: string;
  swatch: string;
}> = [
  { id: "violet", labelKey: "settings.accentViolet", swatch: "#6750a4" },
  { id: "blue", labelKey: "settings.accentBlue", swatch: "#2f6fed" },
  { id: "teal", labelKey: "settings.accentTeal", swatch: "#00796b" },
  { id: "green", labelKey: "settings.accentGreen", swatch: "#2e7d32" },
  { id: "amber", labelKey: "settings.accentAmber", swatch: "#b26a00" },
  { id: "orange", labelKey: "settings.accentOrange", swatch: "#c2410c" },
  { id: "pink", labelKey: "settings.accentPink", swatch: "#b0306b" },
  { id: "red", labelKey: "settings.accentRed", swatch: "#b3261e" },
];

const MODE_KEY = "study-planner.theme";
const ACCENT_KEY = "study-planner.accent";
const DEFAULT_MODE: ThemeMode = "system";
const DEFAULT_ACCENT: AccentId = "violet";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isAccentId(value: string | null): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value);
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // El tema sigue funcionando aunque el navegador bloquee el almacenamiento.
  }
}

export function readThemeMode(): ThemeMode {
  const stored = readStorage(MODE_KEY);
  return isThemeMode(stored) ? stored : DEFAULT_MODE;
}

export function readAccent(): AccentId {
  const stored = readStorage(ACCENT_KEY);
  return isAccentId(stored) ? stored : DEFAULT_ACCENT;
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return systemPrefersDark() ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode, accent: AccentId) {
  const root = document.documentElement;
  const resolved = resolveTheme(mode);
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  root.style.colorScheme = resolved;
}

export function applyStoredTheme() {
  applyTheme(readThemeMode(), readAccent());
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);
  const [accent, setAccent] = useState<AccentId>(readAccent);

  useEffect(() => {
    applyTheme(mode, accent);
    writeStorage(MODE_KEY, mode);
    writeStorage(ACCENT_KEY, accent);

    if (mode !== "system" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(mode, accent);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mode, accent]);

  return { mode, accent, setMode, setAccent };
}
