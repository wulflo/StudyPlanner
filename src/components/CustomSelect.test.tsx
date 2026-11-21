import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomSelect, type CustomSelectOption } from "./CustomSelect";

const options: CustomSelectOption[] = [
  { value: "uno", label: "Uno", subtitle: "primero" },
  { value: "dos", label: "Dos", color: "#6750A4" },
  { value: "tres", label: "Tres", disabled: true },
  { value: "cuatro", label: "Cuatro" },
];

function Harness({
  initial = "uno",
  onChange,
  disabled = false,
  required = false,
  placeholder,
  menuOptions = options,
  maxMenuHeight,
}: {
  initial?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  menuOptions?: ReadonlyArray<CustomSelectOption>;
  maxMenuHeight?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CustomSelect
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      options={menuOptions}
      ariaLabel="Selector de prueba"
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      maxMenuHeight={maxMenuHeight}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CustomSelect", () => {
  it("muestra el valor seleccionado y un combobox accesible", () => {
    render(<Harness />);

    const trigger = screen.getByRole("combobox", {
      name: "Selector de prueba",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("abre el listado y elige una opción con el ratón", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toHaveAttribute("aria-label", "Selector de prueba");

    await user.click(screen.getByRole("option", { name: /Dos/ }));

    expect(onChange).toHaveBeenCalledWith("dos");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("Dos")).toBeInTheDocument();
  });

  it("navega con teclado: Enter abre, flechas mueven y Enter elige", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    await user.keyboard("{ArrowDown}");

    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-option-1"),
    );

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("dos");
  });

  it("salta las opciones deshabilitadas con las flechas", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    await user.keyboard("{End}");

    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-option-3"),
    );

    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-option-0"),
    );

    await user.keyboard("{ArrowUp}");
    expect(trigger).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-option-3"),
    );
  });

  it("cierra con Escape y con Tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Tab}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("cierra al hacer clic fuera", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("no se abre cuando está deshabilitado y refleja aria-required", () => {
    render(<Harness disabled required />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-required", "true");
  });

  it("muestra el placeholder y los detalles de la opción", async () => {
    const user = userEvent.setup();
    render(<Harness initial="" placeholder="Elegí una opción" />);

    expect(screen.getByText("Elegí una opción")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("primero")).toBeInTheDocument();
    expect(document.querySelector(".custom-select-dot")).toBeInTheDocument();
  });

  it("marca la opción seleccionada y respeta el alto máximo del menú", async () => {
    const user = userEvent.setup();
    render(<Harness maxMenuHeight={120} />);

    await user.click(screen.getByRole("combobox"));
    const selected = await screen.findByRole("option", { name: /Uno/ });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("listbox")).toHaveStyle({ maxHeight: "120px" });
  });

  it("abre el menú hacia abajo cuando hay espacio suficiente", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("listbox")).toHaveClass("is-bottom");
  });

  it("abre el menú hacia arriba cuando no hay espacio debajo", async () => {
    const user = userEvent.setup();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 700,
      top: 700,
      bottom: 740,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect);
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("listbox")).toHaveClass("is-top");
  });
});
