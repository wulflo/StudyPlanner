import { describe, expect, it } from "vitest";
import type { Term } from "./ipc";
import { pickDefaultTerm } from "./term";

function term(id: string, startDate: string, endDate: string): Term {
  return {
    id,
    yearId: "year-1",
    name: id,
    kind: "semester",
    startDate,
    endDate,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("pickDefaultTerm", () => {
  const today = new Date(2026, 5, 15);

  it("elige el término que contiene hoy aunque no sea el primero", () => {
    const terms = [
      term("old", "2025-03-01", "2025-07-01"),
      term("current", "2026-03-01", "2026-07-01"),
    ];
    expect(pickDefaultTerm(terms, today)?.id).toBe("current");
  });

  it("usa el término más reciente si hoy no está en ninguno", () => {
    const terms = [
      term("old", "2025-03-01", "2025-07-01"),
      term("next", "2026-08-01", "2026-12-01"),
      term("middle", "2026-01-01", "2026-02-01"),
    ];
    expect(pickDefaultTerm(terms, today)?.id).toBe("next");
  });

  it("devuelve null sin términos", () => {
    expect(pickDefaultTerm([], today)).toBeNull();
  });
});
