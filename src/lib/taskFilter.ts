import type { TaskFilter, TaskStatus } from "./ipc";

const TASK_STATUSES: ReadonlySet<string> = new Set([
  "open",
  "pending",
  "in_progress",
  "done",
]);

const STRING_FIELDS = [
  "text",
  "tagId",
  "subjectId",
  "dueFrom",
  "dueTo",
  "parentTaskId",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Convierte el JSON de un filtro guardado en un `TaskFilter` seguro.
 *
 * Devuelve `null` si el JSON no es un objeto o si algún campo conocido tiene un
 * tipo inesperado. Los campos desconocidos se ignoran para no romper filtros
 * guardados por versiones anteriores.
 */
export function parseTaskFilter(raw: string): TaskFilter | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }

  const filter: TaskFilter = {};

  for (const key of STRING_FIELDS) {
    const value = parsed[key];
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value !== "string") {
      return null;
    }
    filter[key] = value;
  }

  const status = parsed.status;
  if (status !== undefined) {
    if (
      status !== null &&
      (typeof status !== "string" || !TASK_STATUSES.has(status))
    ) {
      return null;
    }
    filter.status = status as TaskStatus | "open" | null;
  }

  const priority = parsed.priority;
  if (priority !== undefined) {
    if (
      priority !== null &&
      (typeof priority !== "number" || !Number.isInteger(priority))
    ) {
      return null;
    }
    filter.priority = priority as number | null;
  }

  const rootsOnly = parsed.rootsOnly;
  if (rootsOnly !== undefined) {
    if (typeof rootsOnly !== "boolean") {
      return null;
    }
    filter.rootsOnly = rootsOnly;
  }

  return filter;
}
