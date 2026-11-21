import { type ReactNode, useId, useRef, useState } from "react";

export interface TabDefinition {
  id: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
}

/**
 * Pestañas horizontales para dividir subsecciones largas sin apilar todo el
 * contenido en una sola columna. Mantienen el foco y el estado de la pestaña
 * activa, y descartan el contenido inactivo para no cargar de más el DOM.
 */
export function Tabs({
  label,
  items,
  className,
  initialId,
}: {
  label: string;
  items: TabDefinition[];
  className?: string;
  initialId?: string;
}) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(initialId ?? items[0]?.id ?? "");
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  if (!active) {
    return null;
  }

  function focusTab(index: number) {
    const next = items[(index + items.length) % items.length];
    if (!next) {
      return;
    }
    setActiveId(next.id);
    buttonsRef.current[items.indexOf(next)]?.focus();
  }

  return (
    <div className={`tabs${className ? ` ${className}` : ""}`}>
      <div className="tabs-strip" role="tablist" aria-label={label}>
        {items.map((item, index) => {
          const selected = item.id === active.id;
          return (
            <button
              key={item.id}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`tab-button${selected ? " is-active" : ""}`}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  focusTab(index + 1);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  focusTab(index - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  focusTab(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  focusTab(items.length - 1);
                }
              }}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null ? (
                <span className="tab-badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        key={active.id}
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="tabs-panel"
      >
        {active.content}
      </div>
    </div>
  );
}
