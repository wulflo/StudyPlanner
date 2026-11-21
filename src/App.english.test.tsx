import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { setAppLanguage } from "./lib/i18n";

// El setup global fuerza español para la suite histórica; estos tests limpian
// el almacenamiento antes de renderizar para verificar el arranque en inglés.
async function startInEnglish() {
  window.localStorage.removeItem("study-planner.language");
  window.localStorage.removeItem("study-planner.nav.expanded");
  await setAppLanguage("en");
}

afterEach(cleanup);

describe("App en inglés", () => {
  it("arranca en inglés aunque el idioma del sistema sea español", async () => {
    await startInEnglish();
    const { container } = render(<App />);

    expect(document.documentElement.lang).toBe("en");
    expect(
      screen.getByRole("heading", {
        name: /start by choosing your local vault/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand Academics section" }),
    ).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/\b(Fase|Phase)\b/i);
  });

  it("cambia a español desde Ajustes y lo guarda en el dispositivo", async () => {
    await startInEnglish();
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "Expand System section" }),
    );
    await user.click(await screen.findByRole("button", { name: "Settings" }));

    expect(
      screen.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Español" }));

    expect(window.localStorage.getItem("study-planner.language")).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(
      screen.getByRole("heading", { name: "Ajustes", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoy" })).toBeInTheDocument();
  });
});
