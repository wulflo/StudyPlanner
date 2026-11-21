import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface CustomSelectOption {
  value: string;
  label: string;
  subtitle?: string;
  color?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<CustomSelectOption>;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  maxMenuHeight?: number;
}

function nextEnabledIndex(
  options: ReadonlyArray<CustomSelectOption>,
  from: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) {
    return -1;
  }
  let index = from;
  for (let step = 0; step < options.length; step += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index]?.disabled) {
      return index;
    }
  }
  return -1;
}

/**
 * Selector accesible con estética Material 3.
 *
 * Sustituye a los `<select>` nativos: botón disparador, listado con scroll
 * interno, teclado completo, ARIA y cierre al hacer clic fuera o perder foco.
 */
export function CustomSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  disabled = false,
  required = false,
  className,
  maxMenuHeight = 280,
}: CustomSelectProps) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const viewportHeight =
      typeof window === "undefined" ? 0 : window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const needed = Math.min(maxMenuHeight, 240);
    setPlacement(
      spaceBelow < needed && spaceAbove > spaceBelow ? "top" : "bottom",
    );
  }, [open, maxMenuHeight]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    const active = menuRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  function openMenu() {
    if (disabled) {
      return;
    }
    setOpen(true);
    const initial =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : nextEnabledIndex(options, -1, 1);
    setActiveIndex(initial);
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) {
      return;
    }
    onChange(option.value);
    closeMenu(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) {
          openMenu();
        } else if (activeIndex >= 0) {
          choose(activeIndex);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          setActiveIndex((current) => nextEnabledIndex(options, current, 1));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          setActiveIndex((current) =>
            nextEnabledIndex(
              options,
              current < 0 ? options.length : current,
              -1,
            ),
          );
        }
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(nextEnabledIndex(options, -1, 1));
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(nextEnabledIndex(options, options.length, -1));
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          closeMenu();
        }
        break;
      case "Tab":
        if (open) {
          setOpen(false);
        }
        break;
      default:
        break;
    }
  }

  function handleOptionMouseDown(event: MouseEvent<HTMLDivElement>) {
    // Mantiene el foco en el disparador para que el teclado siga funcionando.
    event.preventDefault();
  }

  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  return (
    <div
      ref={rootRef}
      className={[
        "custom-select",
        open ? "is-open" : "",
        disabled ? "is-disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        role="combobox"
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
            closeMenu();
          }
        }}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && activeOption ? `${baseId}-option-${activeIndex}` : undefined
        }
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="custom-select-value">
          {selected ? (
            <>
              {selected.color ? (
                <span
                  className="custom-select-dot"
                  style={{ background: selected.color }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="custom-select-label">{selected.label}</span>
            </>
          ) : (
            <span className="custom-select-placeholder">
              {placeholder ?? ""}
            </span>
          )}
        </span>
        <svg
          className="custom-select-chevron"
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={listId}
          className={`custom-select-menu is-${placement}`}
          role="listbox"
          aria-label={ariaLabel}
          style={{ maxHeight: maxMenuHeight }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                id={`${baseId}-option-${index}`}
                data-option-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                className={[
                  "custom-select-option",
                  isSelected ? "is-selected" : "",
                  index === activeIndex ? "is-active" : "",
                  option.disabled ? "is-disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                tabIndex={-1}
                onMouseDown={handleOptionMouseDown}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setActiveIndex(index);
                  }
                }}
                onClick={() => choose(index)}
                onKeyDown={(event) => {
                  if (option.disabled) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(index);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeMenu(true);
                  }
                }}
              >
                {option.color ? (
                  <span
                    className="custom-select-dot"
                    style={{ background: option.color }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="custom-select-option-text">
                  <span className="custom-select-label">{option.label}</span>
                  {option.subtitle ? (
                    <span className="custom-select-option-subtitle">
                      {option.subtitle}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <svg
                    className="custom-select-check"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M4.5 10.5 8 14l7.5-8" />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default CustomSelect;
