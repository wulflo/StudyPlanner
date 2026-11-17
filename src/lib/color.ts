export const DEFAULT_SUBJECT_COLOR = "#6750A4";

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Devuelve un color CSS seguro para pintar en línea.
 *
 * Solo acepta `#RGB` o `#RRGGBB` (con o sin almohadilla). Cualquier otro valor
 * cae al color por defecto para evitar inyecciones o estilos rotos desde datos
 * importados o manipulados a mano.
 */
export function safeColor(
  value: string | null | undefined,
  fallback: string = DEFAULT_SUBJECT_COLOR,
): string {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }

  const candidate = raw.startsWith("#") ? raw : `#${raw}`;
  if (!HEX_COLOR.test(candidate)) {
    return fallback;
  }

  if (candidate.length === 4) {
    const expanded = candidate
      .slice(1)
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }

  return candidate.toUpperCase();
}
