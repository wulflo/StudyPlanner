import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { setAppLanguage } from "../lib/i18n";

// La suite existente verifica la interfaz en español. El arranque en inglés se
// cubre con un test específico que limpia el almacenamiento antes de renderizar.
beforeEach(async () => {
  window.localStorage.setItem("study-planner.language", "es");
  await setAppLanguage("es");
});

afterEach(() => {
  cleanup();
});
