import {
  argbFromHex,
  Hct,
  hexFromArgb,
  themeFromSourceColor,
} from "@material/material-color-utilities";
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
  source: string;
}> = [
  {
    id: "violet",
    labelKey: "settings.accentViolet",
    swatch: "#6750a4",
    source: "#6750a4",
  },
  {
    id: "blue",
    labelKey: "settings.accentBlue",
    swatch: "#2f6fed",
    source: "#2f6fed",
  },
  {
    id: "teal",
    labelKey: "settings.accentTeal",
    swatch: "#00796b",
    source: "#00796b",
  },
  {
    id: "green",
    labelKey: "settings.accentGreen",
    swatch: "#2e7d32",
    source: "#2e7d32",
  },
  {
    id: "amber",
    labelKey: "settings.accentAmber",
    swatch: "#b26a00",
    source: "#b26a00",
  },
  {
    id: "orange",
    labelKey: "settings.accentOrange",
    swatch: "#c2410c",
    source: "#c2410c",
  },
  {
    id: "pink",
    labelKey: "settings.accentPink",
    swatch: "#b0306b",
    source: "#b0306b",
  },
  {
    id: "red",
    labelKey: "settings.accentRed",
    swatch: "#b3261e",
    source: "#b3261e",
  },
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

function accentSource(accent: AccentId): string {
  return ACCENTS.find((option) => option.id === accent)?.source ?? "#6750a4";
}

/**
 * Tokens tonales derivados de Material Color Utilities.
 *
 * Los fondos son sólidos a propósito: la ventana usa `decorations: false` y
 * WebKitGTK produce artefactos grises al redimensionar si se usa
 * `backdrop-filter` o superficies translúcidas.
 */
export function materialTokens(
  accent: AccentId,
  resolved: "light" | "dark",
): Record<string, string> {
  const theme = themeFromSourceColor(argbFromHex(accentSource(accent)));
  const dark = resolved === "dark";
  const scheme = dark ? theme.schemes.dark : theme.schemes.light;
  const neutral = theme.palettes.neutral;
  const neutralVariant = theme.palettes.neutralVariant;
  const tone = (palette: typeof neutral, value: number) =>
    hexFromArgb(palette.tone(value));
  const success = Hct.from(142, 42, dark ? 72 : 36);
  const warning = Hct.from(75, 70, dark ? 76 : 42);
  const primary = hexFromArgb(scheme.primary);
  const onPrimary = hexFromArgb(scheme.onPrimary);
  const primaryContainer = hexFromArgb(scheme.primaryContainer);
  const onPrimaryContainer = hexFromArgb(scheme.onPrimaryContainer);
  const surface = hexFromArgb(scheme.surface);
  const surfaceLow = tone(neutral, dark ? 12 : 96);
  const surfaceContainer = tone(neutral, dark ? 16 : 94);
  const surfaceHigh = tone(neutral, dark ? 22 : 92);
  const surfaceLowest = tone(neutral, dark ? 4 : 100);
  const surfaceHighest = tone(neutral, dark ? 26 : 90);
  const onSurface = hexFromArgb(scheme.onSurface);
  const onSurfaceVariant = hexFromArgb(scheme.onSurfaceVariant);
  const outline = hexFromArgb(scheme.outline);
  const outlineVariant = tone(neutralVariant, dark ? 30 : 80);
  const danger = hexFromArgb(scheme.error);
  const onDanger = hexFromArgb(scheme.onError);
  const dangerContainer = hexFromArgb(scheme.errorContainer);
  const onDangerContainer = hexFromArgb(scheme.onErrorContainer);
  const successHex = hexFromArgb(success.toInt());
  const warningHex = hexFromArgb(warning.toInt());

  return {
    "--accent": primary,
    "--accent-strong": primary,
    "--on-accent": onPrimary,
    "--accent-soft": primaryContainer,
    "--accent-ink": onPrimaryContainer,
    "--bg": tone(neutral, dark ? 6 : 99),
    "--surface": surface,
    "--surface-container-lowest": surfaceLowest,
    "--surface-container-low": surfaceLow,
    "--surface-container": surfaceContainer,
    "--surface-container-high": surfaceHigh,
    "--surface-container-highest": surfaceHighest,
    "--on-surface": onSurface,
    "--on-surface-variant": onSurfaceVariant,
    "--outline": outline,
    "--outline-variant": outlineVariant,
    "--primary": primary,
    "--on-primary": onPrimary,
    "--primary-container": primaryContainer,
    "--on-primary-container": onPrimaryContainer,
    "--secondary": hexFromArgb(scheme.secondary),
    "--on-secondary": hexFromArgb(scheme.onSecondary),
    "--secondary-container": hexFromArgb(scheme.secondaryContainer),
    "--on-secondary-container": hexFromArgb(scheme.onSecondaryContainer),
    "--tertiary": hexFromArgb(scheme.tertiary),
    "--on-tertiary": hexFromArgb(scheme.onTertiary),
    "--tertiary-container": hexFromArgb(scheme.tertiaryContainer),
    "--on-tertiary-container": hexFromArgb(scheme.onTertiaryContainer),
    "--success": successHex,
    "--success-container": tone(neutral, dark ? 24 : 92),
    "--on-success-container": dark ? successHex : tone(neutral, 20),
    "--warning": warningHex,
    "--warning-container": tone(neutral, dark ? 24 : 92),
    "--on-warning-container": dark ? warningHex : tone(neutral, 20),
    "--danger": danger,
    "--on-danger": onDanger,
    "--danger-container": dangerContainer,
    "--on-danger-container": onDangerContainer,
    "--md-sys-color-primary": primary,
    "--md-sys-color-on-primary": onPrimary,
    "--md-sys-color-primary-container": primaryContainer,
    "--md-sys-color-on-primary-container": onPrimaryContainer,
    "--md-sys-color-secondary": hexFromArgb(scheme.secondary),
    "--md-sys-color-tertiary": hexFromArgb(scheme.tertiary),
    "--md-sys-color-secondary-container": hexFromArgb(
      scheme.secondaryContainer,
    ),
    "--md-sys-color-on-secondary-container": hexFromArgb(
      scheme.onSecondaryContainer,
    ),
    "--md-sys-color-surface": surface,
    "--md-sys-color-surface-container-lowest": surfaceLowest,
    "--md-sys-color-surface-container-low": surfaceLow,
    "--md-sys-color-surface-container": surfaceContainer,
    "--md-sys-color-surface-container-high": surfaceHigh,
    "--md-sys-color-on-surface": onSurface,
    "--md-sys-color-on-surface-variant": onSurfaceVariant,
    "--md-sys-color-outline": outline,
    "--md-sys-color-outline-variant": outlineVariant,
    "--md-sys-color-error": danger,
    "--md-sys-color-on-error-container": onDangerContainer,
    "--md-sys-color-success": successHex,
    "--md-sys-color-success-container": tone(neutral, dark ? 24 : 92),
    "--md-sys-color-on-success-container": dark
      ? successHex
      : tone(neutral, 20),
  };
}

export function applyTheme(mode: ThemeMode, accent: AccentId) {
  const root = document.documentElement;
  const resolved = resolveTheme(mode);
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  root.style.colorScheme = resolved;
  const tokens = materialTokens(accent, resolved);
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
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
