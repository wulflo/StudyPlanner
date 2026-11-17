import { enUS, es } from "date-fns/locale";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en";
import esResources from "../locales/es";

export type AppLanguage = "es" | "en";

export const LANGUAGES: ReadonlyArray<{ id: AppLanguage; label: string }> = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

const LANGUAGE_KEY = "study-planner.language";
const DEFAULT_LANGUAGE: AppLanguage = "es";

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
    // El idioma sigue funcionando aunque el navegador bloquee el almacenamiento.
  }
}

export function normalizeLanguage(
  value: string | null | undefined,
): AppLanguage {
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

export function readLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  return normalizeLanguage(readStorage(LANGUAGE_KEY));
}

export function intlLocale(
  language: string | undefined = i18n.language,
): string {
  return normalizeLanguage(language) === "en" ? "en-US" : "es-AR";
}

export function getDateFnsLocale(language: string | undefined = i18n.language) {
  return normalizeLanguage(language) === "en" ? enUS : es;
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
}

function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

const initialLanguage = readLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: esResources },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: ["es", "en"],
  load: "languageOnly",
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

applyDocumentLanguage(initialLanguage);
writeStorage(LANGUAGE_KEY, initialLanguage);

i18n.on("languageChanged", (language) => {
  const normalized = normalizeLanguage(language);
  applyDocumentLanguage(normalized);
  writeStorage(LANGUAGE_KEY, normalized);
});

export { useTranslation } from "react-i18next";
export { i18n };
export default i18n;
