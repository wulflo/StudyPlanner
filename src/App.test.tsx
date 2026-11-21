import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

const NAV_GROUP_BY_SECTION: Record<string, string> = {
  Hoy: "Diario",
  Calendario: "Diario",
  Tareas: "Diario",
  Materias: "Academia",
  Horario: "Academia",
  Exámenes: "Academia",
  Notas: "Academia",
  Estudio: "Estudio",
  Fortalezas: "Estudio",
  Estadísticas: "Estudio",
  Bóveda: "Sistema",
  Ajustes: "Sistema",
};

async function goToSection(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const direct = screen.queryByRole("button", { name });
  if (direct) {
    await user.click(direct);
    return;
  }
  const group = NAV_GROUP_BY_SECTION[name];
  if (group) {
    const expand = screen.queryByRole("button", {
      name: `Expandir sección ${group}`,
    });
    if (expand) {
      await user.click(expand);
    }
  }
  await user.click(await screen.findByRole("button", { name }));
}

afterEach(cleanup);

describe("App en navegador", () => {
  it("muestra la identidad, la navegación y el primer paso", () => {
    render(<App />);
    expect(screen.getByText("Study Planner")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /empezá por elegir tu bóveda/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tareas" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expandir sección Academia" }),
    ).toBeInTheDocument();
  });

  it("no muestra la barra inferior de estado", () => {
    render(<App />);
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByText(/datos locales/i)).not.toBeInTheDocument();
  });

  it("no muestra etiquetas de fase de desarrollo", () => {
    const { container } = render(<App />);
    expect(container.textContent ?? "").not.toMatch(/\b(Fase|Phase)\b/i);
  });

  it("cambia de vista al seleccionar una sección", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToSection(user, "Horario");

    expect(
      screen.getByRole("heading", { name: "Horario semanal", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bóveda requerida/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /empezá por elegir/i }),
    ).not.toBeInTheDocument();
  });

  it("colapsa los grupos de navegación y expande el grupo activo", async () => {
    window.localStorage.removeItem("study-planner.nav.expanded");
    const user = userEvent.setup();
    render(<App />);

    const daily = screen.getByRole("button", {
      name: "Contraer sección Diario",
    });
    expect(daily).toHaveAttribute("aria-expanded", "true");

    await user.click(daily);

    expect(
      screen.getByRole("button", { name: "Expandir sección Diario" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      JSON.parse(
        window.localStorage.getItem("study-planner.nav.expanded") ?? "[]",
      ),
    ).not.toContain("daily");

    await goToSection(user, "Materias");

    expect(
      screen.getByRole("button", { name: "Contraer sección Academia" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("vuelve a Hoy desde una sección provisional", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToSection(user, "Calendario");
    await user.click(screen.getByRole("button", { name: "Volver a Hoy" }));

    expect(
      screen.getByRole("heading", { name: /empezá por elegir/i }),
    ).toBeInTheDocument();
  });

  it("lleva a Bóveda y deshabilita el selector fuera de Tauri", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Configurar bóveda" }));

    expect(
      screen.getByRole("heading", { name: "Bóveda local", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Elegir carpeta" }),
    ).toBeDisabled();
    expect(screen.getByText(/modo navegador/i)).toBeInTheDocument();
  });

  it("pide configurar la bóveda antes de mostrar tareas", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToSection(user, "Tareas");

    expect(
      screen.getByRole("heading", { name: "Tareas", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bóveda requerida/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir a Bóveda" }),
    ).toBeInTheDocument();
  });

  it("muestra Ajustes y pide configurar la bóveda", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToSection(user, "Ajustes");

    expect(
      screen.getByRole("heading", { name: "Ajustes", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bóveda requerida/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir a Bóveda" }),
    ).toBeInTheDocument();
  });
});
