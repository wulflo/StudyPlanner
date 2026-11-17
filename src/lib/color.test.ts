import { describe, expect, it } from "vitest";

import { DEFAULT_SUBJECT_COLOR, safeColor } from "./color";

describe("safeColor", () => {
  it("normaliza colores válidos de seis dígitos", () => {
    expect(safeColor("#6750a4")).toBe("#6750A4");
    expect(safeColor("6750A4")).toBe("#6750A4");
  });

  it("expande la forma corta", () => {
    expect(safeColor("#abc")).toBe("#AABBCC");
  });

  it("cae al color por defecto con valores inválidos o vacíos", () => {
    expect(safeColor(null)).toBe(DEFAULT_SUBJECT_COLOR);
    expect(safeColor("   ")).toBe(DEFAULT_SUBJECT_COLOR);
    expect(safeColor("#GG0000")).toBe(DEFAULT_SUBJECT_COLOR);
    expect(safeColor("red; background: url(x)")).toBe(DEFAULT_SUBJECT_COLOR);
    expect(safeColor("#12345")).toBe(DEFAULT_SUBJECT_COLOR);
  });

  it("respeta un fallback explícito", () => {
    expect(safeColor("", "#000000")).toBe("#000000");
  });
});
