import { useEffect, useId, useRef, useState } from "react";
import { intlLocale, useTranslation } from "../lib/i18n";

type DateParts = { year: number; month: number; day: number };

function parseIso(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function orderOf(locale: string): Array<"day" | "month" | "year"> {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(2026, 10, 21));
  return parts
    .filter((part) => part.type !== "literal")
    .map((part) => part.type as "day" | "month" | "year");
}

function formatDisplay(value: string, locale: string): string {
  const parts = parseIso(value);
  if (!parts) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(parts.year, parts.month - 1, parts.day));
}

function parseDisplay(text: string, locale: string): DateParts | null {
  const groups = text.match(/\d+/g);
  if (groups?.length !== 3) {
    return null;
  }
  let year: number;
  let month: number;
  let day: number;
  if (groups[0].length === 4) {
    [year, month, day] = groups.map(Number);
  } else {
    const order = orderOf(locale);
    const values: Record<"day" | "month" | "year", number> = {
      day: 0,
      month: 0,
      year: 0,
    };
    order.forEach((key, index) => {
      values[key] = Number(groups[index]);
    });
    year = values.year;
    month = values.month;
    day = values.day;
  }
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function withinBounds(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) {
    return false;
  }
  if (max && iso > max) {
    return false;
  }
  return true;
}

function capitalize(value: string): string {
  return value.length === 0
    ? value
    : value[0].toLocaleUpperCase() + value.slice(1);
}

export function DateField({
  value,
  onChange,
  label,
  fieldClassName = "field",
  id,
  ariaLabel,
  disabled = false,
  required = false,
  min,
  max,
  className = "text-field",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  fieldClassName?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = parseIso(value);
  const today = new Date();
  const [text, setText] = useState(() => formatDisplay(value, locale));
  const [open, setOpen] = useState(false);
  const [isTop, setIsTop] = useState(false);
  const [view, setView] = useState(() => ({
    year: selected?.year ?? today.getFullYear(),
    month: selected?.month ?? today.getMonth() + 1,
  }));

  useEffect(() => {
    setText(formatDisplay(value, locale));
  }, [value, locale]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function commitText() {
    const parsed = parseDisplay(text, locale);
    if (!parsed) {
      setText(formatDisplay(value, locale));
      return;
    }
    const iso = toIso(parsed.year, parsed.month, parsed.day);
    if (!withinBounds(iso, min, max)) {
      setText(formatDisplay(value, locale));
      return;
    }
    if (iso !== value) {
      onChange(iso);
    }
    setText(formatDisplay(iso, locale));
  }

  function openPicker() {
    if (disabled) {
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      setIsTop(window.innerHeight - rect.bottom < 340 && rect.top > 340);
    }
    setView({
      year: selected?.year ?? today.getFullYear(),
      month: selected?.month ?? today.getMonth() + 1,
    });
    setOpen(true);
  }

  function selectDay(day: number) {
    onChange(toIso(view.year, view.month, day));
    setOpen(false);
    inputRef.current?.focus();
  }

  function changeMonth(delta: number) {
    setView((current) => {
      const next = new Date(current.year, current.month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  }

  const weekStart = locale.startsWith("en") ? 0 : 1;
  const firstOfMonth = new Date(view.year, view.month - 1, 1);
  const offset = (firstOfMonth.getDay() - weekStart + 7) % 7;
  const gridStart = new Date(view.year, view.month - 1, 1 - offset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    return date;
  });
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 10, 1 + ((weekStart + index) % 7));
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });
  const monthLabel = capitalize(
    new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(new Date(view.year, view.month - 1, 1)),
  );
  const fullDate = (date: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date);

  return (
    <label className={fieldClassName}>
      <span>{label}</span>
      <div className={`date-field${open ? " is-open" : ""}`} ref={rootRef}>
        <input
          ref={inputRef}
          id={inputId}
          className={className}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("date.placeholder")}
          value={text}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const parsed = parseDisplay(next, locale);
            if (!parsed) {
              return;
            }
            const iso = toIso(parsed.year, parsed.month, parsed.day);
            if (withinBounds(iso, min, max) && iso !== value) {
              onChange(iso);
            }
          }}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitText();
            } else if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              openPicker();
            }
          }}
        />
        <button
          type="button"
          className="date-field-button"
          onClick={() => (open ? setOpen(false) : openPicker())}
          disabled={disabled}
          aria-label={t("date.openPicker")}
          aria-haspopup="dialog"
          aria-expanded={open}
          tabIndex={-1}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
          </svg>
        </button>

        {open ? (
          <div
            className={`date-picker${isTop ? " is-top" : ""}`}
            role="dialog"
            aria-label={t("date.picker")}
          >
            <div className="date-picker-head">
              <button
                type="button"
                className="date-picker-nav"
                onClick={() => changeMonth(-1)}
                aria-label={t("date.previousMonth")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.5 6.5 9 12l5.5 5.5" />
                </svg>
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="date-picker-nav"
                onClick={() => changeMonth(1)}
                aria-label={t("date.nextMonth")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />
                </svg>
              </button>
            </div>
            <div className="date-picker-weekdays" aria-hidden="true">
              {weekdays.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="date-picker-grid">
              {days.map((date) => {
                const iso = toIso(
                  date.getFullYear(),
                  date.getMonth() + 1,
                  date.getDate(),
                );
                const inMonth = date.getMonth() === view.month - 1;
                const isSelected = iso === value;
                const isToday =
                  iso ===
                  toIso(
                    today.getFullYear(),
                    today.getMonth() + 1,
                    today.getDate(),
                  );
                const blocked = !withinBounds(iso, min, max);
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`date-picker-day${inMonth ? "" : " is-outside"}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                    aria-label={fullDate(date)}
                    aria-pressed={isSelected}
                    disabled={blocked}
                    onClick={() => selectDay(date.getDate())}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="date-picker-actions">
              <button
                type="button"
                className="mini-action"
                onClick={() => {
                  const now = new Date();
                  onChange(
                    toIso(now.getFullYear(), now.getMonth() + 1, now.getDate()),
                  );
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                {t("date.today")}
              </button>
              <button
                type="button"
                className="mini-action"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                {t("date.clear")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}
