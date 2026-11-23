import { format } from "date-fns";
import type { Term } from "./ipc";

/**
 * Elige el término activo: el que contiene hoy. Si ninguno lo contiene,
 * devuelve el más reciente (el listado del store viene ordenado por fecha).
 */
export function pickDefaultTerm(
  terms: Term[],
  today: Date = new Date(),
): Term | null {
  if (terms.length === 0) {
    return null;
  }
  const isoDay = format(today, "yyyy-MM-dd");
  const active = terms.find(
    (term) => isoDay >= term.startDate && isoDay <= term.endDate,
  );
  if (active) {
    return active;
  }
  return (
    [...terms].sort(
      (left, right) =>
        right.startDate.localeCompare(left.startDate) ||
        right.endDate.localeCompare(left.endDate),
    )[0] ?? null
  );
}
