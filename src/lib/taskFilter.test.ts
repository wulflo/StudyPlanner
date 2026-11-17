import { describe, expect, it } from "vitest";

import { parseTaskFilter } from "./taskFilter";

describe("parseTaskFilter", () => {
  it("acepta un filtro completo", () => {
    expect(
      parseTaskFilter(
        JSON.stringify({
          text: "matrices",
          status: "open",
          priority: 2,
          tagId: "tag-1",
          subjectId: null,
          rootsOnly: true,
        }),
      ),
    ).toEqual({
      text: "matrices",
      status: "open",
      priority: 2,
      tagId: "tag-1",
      subjectId: null,
      rootsOnly: true,
    });
  });

  it("acepta un objeto vacío", () => {
    expect(parseTaskFilter("{}")).toEqual({});
  });

  it("rechaza JSON inválido o raíces que no son objetos", () => {
    expect(parseTaskFilter("{")).toBeNull();
    expect(parseTaskFilter("null")).toBeNull();
    expect(parseTaskFilter("[]")).toBeNull();
    expect(parseTaskFilter('"texto"')).toBeNull();
  });

  it("rechaza campos con tipos inesperados", () => {
    expect(parseTaskFilter('{"text": 42}')).toBeNull();
    expect(parseTaskFilter('{"status": "archivada"}')).toBeNull();
    expect(parseTaskFilter('{"priority": 1.5}')).toBeNull();
    expect(parseTaskFilter('{"priority": "alta"}')).toBeNull();
    expect(parseTaskFilter('{"rootsOnly": "sí"}')).toBeNull();
  });

  it("ignora campos desconocidos", () => {
    expect(parseTaskFilter('{"text": "mate", "extra": 1}')).toEqual({
      text: "mate",
    });
  });
});
