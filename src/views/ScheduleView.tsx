import { addDays, format, parseISO, startOfWeek } from "date-fns";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AttendanceButtons } from "../components/AttendanceButtons";
import { CustomSelect } from "../components/CustomSelect";
import { DateField } from "../components/DateField";
import { Tabs } from "../components/Tabs";
import { safeColor } from "../lib/color";
import { getDateFnsLocale, useTranslation } from "../lib/i18n";
import {
  type AttendanceStatus,
  type ClassException,
  type ClassSlot,
  type ClassSlotInput,
  clearAttendance,
  createClassException,
  createClassSlot,
  createHoliday,
  deleteClassException,
  deleteClassSlot,
  deleteHoliday,
  type ExceptionKind,
  getRotation,
  getWeekSchedule,
  type Holiday,
  listClassExceptions,
  listClassSlots,
  listHolidays,
  listSubjects,
  listTerms,
  type Recurrence,
  type RotationConfig,
  type RotationMode,
  type ScheduleOccurrence,
  type Subject,
  saveRotation,
  setAttendance,
  type Term,
  updateClassSlot,
  type VaultStatus,
  type WeekSchedule,
} from "../lib/ipc";

const weekdayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const kindLabelKeys: Record<ExceptionKind, string> = {
  cancelled: "schedule.exceptionKind.cancelled",
  moved: "schedule.exceptionKind.moved",
  extra: "schedule.exceptionKind.extra",
};
const occurrenceLabelKeys: Record<ScheduleOccurrence["kind"], string> = {
  scheduled: "schedule.occurrence.scheduled",
  cancelled: "schedule.occurrence.cancelled",
  moved: "schedule.occurrence.moved",
  extra: "schedule.occurrence.extra",
};
const rotationModeKeys: Record<RotationMode, string> = {
  weekly_ab: "schedule.rotationMode.weekly_ab",
  parity: "schedule.rotationMode.parity",
  day_cycle: "schedule.rotationMode.day_cycle",
};

const emptySlotForm = {
  id: null as string | null,
  subjectId: "",
  weekday: 1,
  startTime: "08:00",
  endTime: "10:00",
  recurrence: "weekly" as Recurrence,
  rotationKey: "",
  validFrom: "",
  validTo: "",
  roomOverride: "",
};

const emptyHolidayForm = { date: "", name: "" };

const emptyExceptionForm = {
  slotId: "",
  date: "",
  kind: "cancelled" as ExceptionKind,
  newStartTime: "",
  newEndTime: "",
  newRoom: "",
};

const emptyRotationForm = {
  mode: "weekly_ab" as RotationMode,
  anchorDate: "",
  cycleLength: 2,
  labels: "A, B",
  dayCycle: "1, 2, 3",
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function mondayOf(value: string): string {
  return isoDate(startOfWeek(parseISO(value), { weekStartsOn: 1 }));
}

function todayIso(): string {
  return isoDate(new Date());
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function splitLabels(value: string): string[] {
  return value
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value / 100).toFixed(1)}%`;
}

function slotInput(form: typeof emptySlotForm): ClassSlotInput {
  return {
    weekday: form.weekday,
    startTime: form.startTime,
    endTime: form.endTime,
    recurrence: form.recurrence,
    rotationKey: optionalText(form.rotationKey),
    validFrom: optionalText(form.validFrom),
    validTo: optionalText(form.validTo),
    roomOverride: optionalText(form.roomOverride),
  };
}

function rotationFormFrom(
  config: RotationConfig | null,
): typeof emptyRotationForm {
  if (!config) {
    return emptyRotationForm;
  }
  return {
    mode: config.mode,
    anchorDate: config.anchorDate,
    cycleLength: config.cycleLength,
    labels: config.labels.join(", "),
    dayCycle: config.dayCycle.join(", "),
  };
}

export function ScheduleView({
  vault,
  onGoVault,
  onGoSubjects,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
  onGoSubjects: () => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const [week, setWeek] = useState<WeekSchedule | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [exceptions, setExceptions] = useState<ClassException[]>([]);
  const [rotation, setRotation] = useState<RotationConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);
  const [exceptionForm, setExceptionForm] = useState(emptyExceptionForm);
  const [rotationForm, setRotationForm] = useState(emptyRotationForm);

  const weekdayLabels = weekdayKeys.map((key) => t(`schedule.weekdays.${key}`));
  const weekdayShortLabels = weekdayKeys.map((key) =>
    t(`schedule.shortWeekdays.${key}`),
  );

  const loadTerm = useCallback(async (nextTerm: string, nextWeek: string) => {
    const [
      loadedWeek,
      loadedSlots,
      loadedHolidays,
      loadedExceptions,
      loadedRotation,
      loadedSubjects,
    ] = await Promise.all([
      getWeekSchedule(nextTerm, nextWeek),
      listClassSlots(nextTerm),
      listHolidays(nextTerm),
      listClassExceptions(nextTerm),
      getRotation(nextTerm),
      listSubjects(nextTerm),
    ]);

    setWeek(loadedWeek);
    setSlots(loadedSlots);
    setHolidays(loadedHolidays);
    setExceptions(loadedExceptions);
    setRotation(loadedRotation);
    setRotationForm(rotationFormFrom(loadedRotation));
    setSubjects(loadedSubjects);
    if (loadedSubjects.length > 0) {
      setSlotForm((current) =>
        current.id === null && current.subjectId === ""
          ? { ...current, subjectId: loadedSubjects[0].id }
          : current,
      );
    }
    if (loadedSlots.length > 0) {
      setExceptionForm((current) =>
        current.slotId === ""
          ? { ...current, slotId: loadedSlots[0].id }
          : current,
      );
    }
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loadedTerms = await listTerms(null);
        if (cancelled) {
          return;
        }
        setTerms(loadedTerms);
        const nextTerm = loadedTerms[0]?.id ?? null;
        setTermId(nextTerm);
        if (nextTerm) {
          await loadTerm(nextTerm, mondayOf(todayIso()));
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, loadTerm]);

  const weekDays = useMemo(() => {
    const anchor = week?.weekStart ?? weekStart;
    return Array.from({ length: 7 }, (_, index) =>
      isoDate(addDays(parseISO(anchor), index)),
    );
  }, [week?.weekStart, weekStart]);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  async function selectTerm(nextTerm: string) {
    setTermId(nextTerm);
    setError(null);
    setWeek(null);
    setSlotForm(emptySlotForm);
    setExceptionForm(emptyExceptionForm);
    try {
      setLoading(true);
      await loadTerm(nextTerm, weekStart);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setLoading(false);
    }
  }

  async function moveWeek(delta: number) {
    if (!termId) {
      return;
    }
    const nextWeek = isoDate(addDays(parseISO(weekStart), delta * 7));
    setWeekStart(nextWeek);
    setError(null);
    try {
      setWeek(await getWeekSchedule(termId, nextWeek));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function goCurrentWeek() {
    if (!termId) {
      return;
    }
    const nextWeek = mondayOf(todayIso());
    setWeekStart(nextWeek);
    setError(null);
    try {
      setWeek(await getWeekSchedule(termId, nextWeek));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function refreshAll(preferredTerm: string | null = termId) {
    const loadedTerms = await listTerms(null);
    setTerms(loadedTerms);
    const nextTerm =
      loadedTerms.find((term) => term.id === preferredTerm)?.id ??
      loadedTerms[0]?.id ??
      null;
    setTermId(nextTerm);
    if (nextTerm) {
      await loadTerm(nextTerm, weekStart);
    } else {
      setWeek(null);
      setSlots([]);
      setHolidays([]);
      setExceptions([]);
      setRotation(null);
      setSubjects([]);
    }
  }

  async function submitSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (slotForm.id) {
        await updateClassSlot(slotForm.id, slotInput(slotForm));
        setNotice(t("schedule.slotUpdated"));
        setSlotForm(emptySlotForm);
      } else {
        if (!slotForm.subjectId) {
          throw new Error(t("schedule.chooseSubject"));
        }
        await createClassSlot(slotForm.subjectId, slotInput(slotForm));
        setNotice(t("schedule.slotAdded"));
      }
      await refreshAll(termId);
    });
  }

  async function submitHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termId) {
      return;
    }
    await run(async () => {
      await createHoliday(termId, holidayForm.date, holidayForm.name);
      setHolidayForm(emptyHolidayForm);
      setNotice(t("schedule.holidayAdded"));
      await refreshAll(termId);
    });
  }

  async function submitException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exceptionForm.slotId) {
      return;
    }
    await run(async () => {
      await createClassException(
        exceptionForm.slotId,
        exceptionForm.date,
        exceptionForm.kind,
        optionalText(exceptionForm.newStartTime),
        optionalText(exceptionForm.newEndTime),
        optionalText(exceptionForm.newRoom),
      );
      setExceptionForm(emptyExceptionForm);
      setNotice(t("schedule.exceptionAdded"));
      await refreshAll(termId);
    });
  }

  async function submitRotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termId) {
      return;
    }
    await run(async () => {
      const dayCycle = splitLabels(rotationForm.dayCycle);
      const labels = splitLabels(rotationForm.labels);
      await saveRotation(termId, {
        mode: rotationForm.mode,
        anchorDate: rotationForm.anchorDate,
        cycleLength:
          rotationForm.mode === "day_cycle"
            ? dayCycle.length
            : rotationForm.cycleLength,
        labels: rotationForm.mode === "day_cycle" ? [] : labels,
        dayCycle: rotationForm.mode === "day_cycle" ? dayCycle : [],
      });
      setNotice(t("schedule.rotationSaved"));
      await refreshAll(termId);
    });
  }

  async function markAttendance(
    occurrence: ScheduleOccurrence,
    status: AttendanceStatus | null,
  ) {
    await run(async () => {
      if (status === null) {
        await clearAttendance(occurrence.slotId, occurrence.date);
      } else {
        await setAttendance(occurrence.slotId, occurrence.date, status, null);
      }
      if (termId) {
        setWeek(await getWeekSchedule(termId, weekStart));
      }
    });
  }

  async function removeSlot(slot: ClassSlot) {
    await run(async () => {
      await deleteClassSlot(slot.id);
      if (slotForm.id === slot.id) {
        setSlotForm(emptySlotForm);
      }
      setNotice(t("schedule.slotDeletedNotice"));
      await refreshAll(termId);
    });
  }

  async function removeHoliday(holiday: Holiday) {
    await run(async () => {
      await deleteHoliday(holiday.id);
      setNotice(t("schedule.holidayDeleted"));
      await refreshAll(termId);
    });
  }

  async function removeException(exception: ClassException) {
    await run(async () => {
      await deleteClassException(exception.id);
      setNotice(t("schedule.exceptionDeleted"));
      await refreshAll(termId);
    });
  }

  function slotLabel(slotId: string): string {
    const slot = slots.find((item) => item.id === slotId);
    if (!slot) {
      return t("schedule.slotDeleted");
    }
    const subject = subjects.find((item) => item.id === slot.subjectId);
    const subjectName = subject?.name ?? t("schedule.subjectFallback");
    return `${subjectName} · ${weekdayShortLabels[slot.weekday - 1]} ${slot.startTime}`;
  }

  if (!ready) {
    return (
      <>
        <section className="hero section-hero">
          <p className="eyebrow">{t("schedule.eyebrow")}</p>
          <h1>{t("schedule.title")}</h1>
          <p className="hero-copy">{t("schedule.copyLocked")}</p>
        </section>
        <section className="next-card">
          <p className="eyebrow">{t("common.vaultRequired")}</p>
          <h2>{t("common.chooseVaultFirst")}</h2>
          <p>{vault?.message ?? t("schedule.noVaultBody")}</p>
          <div className="hero-actions">
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.goToVault")}
            </button>
          </div>
        </section>
      </>
    );
  }

  const dayLabels = weekDays.map((date) =>
    format(parseISO(date), "EEE d MMM", { locale: getDateFnsLocale() }),
  );

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("schedule.eyebrow")}</p>
        <h1>{t("schedule.title")}</h1>
        <p className="hero-copy">{t("schedule.copyReady")}</p>
      </section>

      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}

      {terms.length === 0 ? (
        <section className="next-card">
          <p className="eyebrow">{t("schedule.noTermsEyebrow")}</p>
          <h2>{t("schedule.noTermsTitle")}</h2>
          <p>{t("schedule.noTermsBody")}</p>
          <div className="hero-actions">
            <button
              type="button"
              className="button filled"
              onClick={onGoSubjects}
            >
              {t("common.goToSubjects")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="status-card" aria-labelledby="week-title">
            <div className="week-head">
              <div>
                <p className="eyebrow">{t("schedule.weekEyebrow")}</p>
                <h2 id="week-title">
                  {week
                    ? `${week.weekStart} → ${week.weekEnd}`
                    : t("schedule.loadingWeek")}
                </h2>
                <p>
                  {week?.rotationLabel
                    ? t("schedule.rotationLabel", {
                        label: week.rotationLabel,
                      })
                    : t("schedule.noRotation")}
                </p>
              </div>
              <div className="week-tools">
                <div className="field">
                  <span>{t("common.term")}</span>
                  <CustomSelect
                    ariaLabel={t("common.term")}
                    className="select-field"
                    value={termId ?? ""}
                    onChange={(value) => void selectTerm(value)}
                    options={terms.map((term) => ({
                      value: term.id,
                      label: term.name,
                    }))}
                  />
                </div>
                <div className="week-nav">
                  <button
                    type="button"
                    className="button tonal"
                    onClick={() => void moveWeek(-1)}
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => void goCurrentWeek()}
                  >
                    {t("common.today")}
                  </button>
                  <button
                    type="button"
                    className="button tonal"
                    onClick={() => void moveWeek(1)}
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <p className="notice">{t("schedule.loadingSchedule")}</p>
            ) : (
              <div className="week-grid">
                {weekDays.map((date, index) => {
                  const holiday = week?.holidays.find(
                    (item) => item.date === date,
                  );
                  const occurrences =
                    week?.occurrences.filter((item) => item.date === date) ??
                    [];
                  return (
                    <div className="week-day" key={date}>
                      <div className="week-day-head">
                        <span>{dayLabels[index]}</span>
                        {holiday ? (
                          <span className="kind-chip holiday">
                            {t("schedule.holiday")}
                          </span>
                        ) : null}
                      </div>
                      {holiday ? (
                        <p className="week-holiday">{holiday.name}</p>
                      ) : null}
                      {occurrences.length === 0 ? (
                        <p className="quiet week-empty">
                          {t("schedule.noClasses")}
                        </p>
                      ) : (
                        <ul className="occurrence-list">
                          {occurrences.map((occurrence) => (
                            <li
                              className={`occurrence kind-${occurrence.kind}`}
                              key={`${occurrence.slotId}-${occurrence.date}-${occurrence.kind}`}
                              style={
                                {
                                  "--subject-color": safeColor(
                                    occurrence.subjectColor,
                                  ),
                                } as CSSProperties
                              }
                            >
                              <div className="occurrence-head">
                                <span
                                  className="subject-dot"
                                  style={{
                                    background: safeColor(
                                      occurrence.subjectColor,
                                    ),
                                  }}
                                  aria-hidden="true"
                                />
                                <strong>{occurrence.subjectName}</strong>
                                <span className="quiet">
                                  {occurrence.startTime}–{occurrence.endTime}
                                </span>
                              </div>
                              <div className="occurrence-meta">
                                {occurrence.kind !== "scheduled" ? (
                                  <span
                                    className={`kind-chip ${occurrence.kind}`}
                                  >
                                    {t(occurrenceLabelKeys[occurrence.kind])}
                                  </span>
                                ) : null}
                                {occurrence.room ? (
                                  <span className="quiet">
                                    {occurrence.room}
                                  </span>
                                ) : null}
                              </div>
                              {occurrence.kind !== "cancelled" ? (
                                <AttendanceButtons
                                  occurrence={occurrence}
                                  busy={busy}
                                  onChange={(status) =>
                                    void markAttendance(occurrence, status)
                                  }
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="schedule-grid">
            <section
              className="academic-panel"
              aria-labelledby="overlaps-title"
            >
              <div className="task-board-head">
                <h2 id="overlaps-title">{t("schedule.overlaps")}</h2>
                <span className="count-chip">{week?.overlaps.length ?? 0}</span>
              </div>
              {!week || week.overlaps.length === 0 ? (
                <p className="empty-state">{t("schedule.noOverlaps")}</p>
              ) : (
                <ul className="mini-list">
                  {week.overlaps.map((overlap) => (
                    <li
                      className="overlap-row"
                      key={`${overlap.firstSlotId}-${overlap.secondSlotId}`}
                    >
                      <span>
                        {weekdayLabels[overlap.weekday - 1]} ·{" "}
                        {overlap.startTime}–{overlap.endTime}
                      </span>
                      <span className="quiet">
                        {overlap.firstSubjectName} / {overlap.secondSubjectName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="academic-panel"
              aria-labelledby="attendance-summary-title"
            >
              <div className="task-board-head">
                <h2 id="attendance-summary-title">
                  {t("schedule.attendance")}
                </h2>
              </div>
              {!week || week.attendance.length === 0 ? (
                <p className="empty-state">{t("schedule.noSubjectsLoaded")}</p>
              ) : (
                <ul className="mini-list">
                  {week.attendance.map((summary) => (
                    <li className="attendance-summary" key={summary.subjectId}>
                      <span
                        className="subject-dot"
                        style={{ background: safeColor(summary.subjectColor) }}
                        aria-hidden="true"
                      />
                      <span className="attendance-name">
                        {summary.subjectName}
                      </span>
                      <span
                        className={`attendance-value${summary.belowMin ? " is-low" : ""}`}
                      >
                        {formatPercent(summary.percentBp)}
                        {summary.minBp !== null
                          ? t("schedule.minSuffix", {
                              value: formatPercent(summary.minBp),
                            })
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {week?.attendance.some((summary) => summary.belowMin) ? (
                <p className="notice error">{t("schedule.belowMin")}</p>
              ) : null}
            </section>
          </div>

          <Tabs
            label={t("schedule.sectionsAria")}
            initialId="slots"
            items={[
              {
                id: "slots",
                label: t("schedule.slots"),
                badge: slots.length,
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="slots-title"
                  >
                    <div className="task-board-head">
                      <h2 id="slots-title">{t("schedule.slots")}</h2>
                      <span className="count-chip">{slots.length}</span>
                    </div>
                    {slots.length === 0 ? (
                      <p className="empty-state">{t("schedule.noSlots")}</p>
                    ) : (
                      <ul className="mini-list">
                        {slots.map((slot) => (
                          <li key={slot.id}>
                            <span className="mini-item">
                              <span>{slotLabel(slot.id)}</span>
                              <span className="quiet">
                                {slot.recurrence === "biweekly"
                                  ? t("schedule.biweekly")
                                  : t("schedule.weekly")}
                                {slot.rotationKey
                                  ? t("schedule.rotationSuffix", {
                                      key: slot.rotationKey,
                                    })
                                  : ""}
                                {slot.validFrom
                                  ? t("schedule.fromSuffix", {
                                      date: slot.validFrom,
                                    })
                                  : ""}
                                {slot.validTo
                                  ? t("schedule.untilSuffix", {
                                      date: slot.validTo,
                                    })
                                  : ""}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="mini-action"
                              onClick={() =>
                                setSlotForm({
                                  id: slot.id,
                                  subjectId: slot.subjectId,
                                  weekday: slot.weekday,
                                  startTime: slot.startTime,
                                  endTime: slot.endTime,
                                  recurrence: slot.recurrence,
                                  rotationKey: slot.rotationKey ?? "",
                                  validFrom: slot.validFrom ?? "",
                                  validTo: slot.validTo ?? "",
                                  roomOverride: slot.roomOverride ?? "",
                                })
                              }
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              className="mini-action danger"
                              onClick={() => void removeSlot(slot)}
                              disabled={busy}
                              aria-label={t("schedule.deleteSlotAria", {
                                label: slotLabel(slot.id),
                              })}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form className="inline-form" onSubmit={submitSlot}>
                      <div className="field">
                        <span>{t("common.subject")}</span>
                        <CustomSelect
                          ariaLabel={t("common.subject")}
                          className="select-field"
                          value={slotForm.subjectId}
                          onChange={(value) =>
                            setSlotForm({ ...slotForm, subjectId: value })
                          }
                          disabled={slotForm.id !== null}
                          required
                          options={[
                            { value: "", label: t("common.choose") },
                            ...subjects.map((subject) => ({
                              value: subject.id,
                              label: subject.name,
                            })),
                          ]}
                        />
                      </div>
                      <div className="field">
                        <span>{t("schedule.day")}</span>
                        <CustomSelect
                          ariaLabel={t("schedule.day")}
                          className="select-field"
                          value={String(slotForm.weekday)}
                          onChange={(value) =>
                            setSlotForm({ ...slotForm, weekday: Number(value) })
                          }
                          options={weekdayLabels.map((label, index) => ({
                            value: String(index + 1),
                            label,
                          }))}
                        />
                      </div>
                      <label className="field narrow">
                        <span>{t("common.start")}</span>
                        <input
                          className="text-field"
                          type="time"
                          value={slotForm.startTime}
                          onChange={(event) =>
                            setSlotForm({
                              ...slotForm,
                              startTime: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <label className="field narrow">
                        <span>{t("common.end")}</span>
                        <input
                          className="text-field"
                          type="time"
                          value={slotForm.endTime}
                          onChange={(event) =>
                            setSlotForm({
                              ...slotForm,
                              endTime: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <div className="field">
                        <span>{t("schedule.recurrence")}</span>
                        <CustomSelect
                          ariaLabel={t("schedule.recurrence")}
                          className="select-field"
                          value={slotForm.recurrence}
                          onChange={(value) =>
                            setSlotForm({
                              ...slotForm,
                              recurrence: value as Recurrence,
                            })
                          }
                          options={[
                            { value: "weekly", label: t("schedule.weekly") },
                            {
                              value: "biweekly",
                              label: t("schedule.biweekly"),
                            },
                          ]}
                        />
                      </div>
                      <label className="field narrow">
                        <span>{t("schedule.rotation")}</span>
                        <input
                          className="text-field"
                          value={slotForm.rotationKey}
                          onChange={(event) =>
                            setSlotForm({
                              ...slotForm,
                              rotationKey: event.target.value,
                            })
                          }
                          maxLength={40}
                          placeholder="A"
                        />
                      </label>
                      <DateField
                        label={t("schedule.validFrom")}
                        fieldClassName="field narrow"
                        value={slotForm.validFrom}
                        onChange={(validFrom) =>
                          setSlotForm({ ...slotForm, validFrom })
                        }
                      />
                      <DateField
                        label={t("schedule.validTo")}
                        fieldClassName="field narrow"
                        value={slotForm.validTo}
                        onChange={(validTo) =>
                          setSlotForm({ ...slotForm, validTo })
                        }
                      />
                      <label className="field">
                        <span>{t("common.room")}</span>
                        <input
                          className="text-field"
                          value={slotForm.roomOverride}
                          onChange={(event) =>
                            setSlotForm({
                              ...slotForm,
                              roomOverride: event.target.value,
                            })
                          }
                          maxLength={120}
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="button filled"
                          disabled={busy}
                        >
                          {slotForm.id
                            ? t("schedule.saveSlot")
                            : t("schedule.addSlot")}
                        </button>
                        {slotForm.id ? (
                          <button
                            type="button"
                            className="button"
                            onClick={() => setSlotForm(emptySlotForm)}
                          >
                            {t("common.cancel")}
                          </button>
                        ) : null}
                      </div>
                    </form>
                  </section>
                ),
              },
              {
                id: "rotation",
                label: t("schedule.rotation"),
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="rotation-title"
                  >
                    <div className="task-board-head">
                      <h2 id="rotation-title">{t("schedule.rotation")}</h2>
                      <span className="count-chip">
                        {rotation
                          ? t(rotationModeKeys[rotation.mode])
                          : t("schedule.notConfigured")}
                      </span>
                    </div>
                    <form className="inline-form" onSubmit={submitRotation}>
                      <div className="field">
                        <span>{t("schedule.mode")}</span>
                        <CustomSelect
                          ariaLabel={t("schedule.mode")}
                          className="select-field"
                          value={rotationForm.mode}
                          onChange={(value) =>
                            setRotationForm({
                              ...rotationForm,
                              mode: value as RotationMode,
                            })
                          }
                          options={[
                            {
                              value: "weekly_ab",
                              label: t("schedule.rotationMode.weekly_ab"),
                            },
                            {
                              value: "parity",
                              label: t("schedule.rotationMode.parity"),
                            },
                            {
                              value: "day_cycle",
                              label: t("schedule.rotationMode.day_cycle"),
                            },
                          ]}
                        />
                      </div>
                      <DateField
                        label={t("schedule.anchor")}
                        fieldClassName="field narrow"
                        value={rotationForm.anchorDate}
                        onChange={(anchorDate) =>
                          setRotationForm({ ...rotationForm, anchorDate })
                        }
                        required
                      />
                      {rotationForm.mode === "day_cycle" ? (
                        <label className="field">
                          <span>{t("schedule.cycleComma")}</span>
                          <input
                            className="text-field"
                            value={rotationForm.dayCycle}
                            onChange={(event) =>
                              setRotationForm({
                                ...rotationForm,
                                dayCycle: event.target.value,
                              })
                            }
                            placeholder={t("schedule.cyclePlaceholder")}
                            required
                          />
                        </label>
                      ) : (
                        <>
                          <label className="field narrow">
                            <span>{t("schedule.cycle")}</span>
                            <input
                              className="text-field"
                              type="number"
                              min={1}
                              max={12}
                              value={rotationForm.cycleLength}
                              onChange={(event) =>
                                setRotationForm({
                                  ...rotationForm,
                                  cycleLength: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>{t("schedule.labels")}</span>
                            <input
                              className="text-field"
                              value={rotationForm.labels}
                              onChange={(event) =>
                                setRotationForm({
                                  ...rotationForm,
                                  labels: event.target.value,
                                })
                              }
                              placeholder={t("schedule.labelsPlaceholder")}
                            />
                          </label>
                        </>
                      )}
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="button filled"
                          disabled={busy}
                        >
                          {t("schedule.saveRotation")}
                        </button>
                      </div>
                    </form>
                  </section>
                ),
              },
              {
                id: "holidays",
                label: t("schedule.holidays"),
                badge: holidays.length,
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="holidays-title"
                  >
                    <div className="task-board-head">
                      <h2 id="holidays-title">{t("schedule.holidays")}</h2>
                      <span className="count-chip">{holidays.length}</span>
                    </div>
                    {holidays.length === 0 ? (
                      <p className="empty-state">{t("schedule.noHolidays")}</p>
                    ) : (
                      <ul className="mini-list">
                        {holidays.map((holiday) => (
                          <li key={holiday.id}>
                            <span className="mini-item">
                              <span>{holiday.name}</span>
                              <span className="quiet">{holiday.date}</span>
                            </span>
                            <button
                              type="button"
                              className="mini-action danger"
                              onClick={() => void removeHoliday(holiday)}
                              disabled={busy}
                              aria-label={t("schedule.deleteHolidayAria", {
                                name: holiday.name,
                              })}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form className="inline-form" onSubmit={submitHoliday}>
                      <DateField
                        label={t("common.date")}
                        fieldClassName="field narrow"
                        value={holidayForm.date}
                        onChange={(date) =>
                          setHolidayForm({ ...holidayForm, date })
                        }
                        required
                      />
                      <label className="field">
                        <span>{t("common.name")}</span>
                        <input
                          className="text-field"
                          value={holidayForm.name}
                          onChange={(event) =>
                            setHolidayForm({
                              ...holidayForm,
                              name: event.target.value,
                            })
                          }
                          maxLength={120}
                          required
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="button filled"
                          disabled={busy}
                        >
                          {t("schedule.addHoliday")}
                        </button>
                      </div>
                    </form>
                  </section>
                ),
              },
              {
                id: "exceptions",
                label: t("schedule.exceptions"),
                badge: exceptions.length,
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="exceptions-title"
                  >
                    <div className="task-board-head">
                      <h2 id="exceptions-title">{t("schedule.exceptions")}</h2>
                      <span className="count-chip">{exceptions.length}</span>
                    </div>
                    {exceptions.length === 0 ? (
                      <p className="empty-state">
                        {t("schedule.noExceptions")}
                      </p>
                    ) : (
                      <ul className="mini-list">
                        {exceptions.map((exception) => (
                          <li key={exception.id}>
                            <span className="mini-item">
                              <span>
                                {t(kindLabelKeys[exception.kind])} ·{" "}
                                {exception.date}
                              </span>
                              <span className="quiet">
                                {slotLabel(exception.classSlotId)}
                                {exception.newStartTime
                                  ? ` · ${exception.newStartTime}–${exception.newEndTime ?? ""}`
                                  : ""}
                                {exception.newRoom
                                  ? ` · ${exception.newRoom}`
                                  : ""}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="mini-action danger"
                              onClick={() => void removeException(exception)}
                              disabled={busy}
                              aria-label={t("schedule.deleteExceptionAria", {
                                date: exception.date,
                              })}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form className="inline-form" onSubmit={submitException}>
                      <div className="field">
                        <span>{t("schedule.slot")}</span>
                        <CustomSelect
                          ariaLabel={t("schedule.slot")}
                          className="select-field"
                          value={exceptionForm.slotId}
                          onChange={(value) =>
                            setExceptionForm({
                              ...exceptionForm,
                              slotId: value,
                            })
                          }
                          required
                          options={[
                            { value: "", label: t("common.choose") },
                            ...slots.map((slot) => ({
                              value: slot.id,
                              label: slotLabel(slot.id),
                            })),
                          ]}
                        />
                      </div>
                      <DateField
                        label={t("common.date")}
                        fieldClassName="field narrow"
                        value={exceptionForm.date}
                        onChange={(date) =>
                          setExceptionForm({ ...exceptionForm, date })
                        }
                        required
                      />
                      <div className="field">
                        <span>{t("common.type")}</span>
                        <CustomSelect
                          ariaLabel={t("common.type")}
                          className="select-field"
                          value={exceptionForm.kind}
                          onChange={(value) =>
                            setExceptionForm({
                              ...exceptionForm,
                              kind: value as ExceptionKind,
                            })
                          }
                          options={Object.entries(kindLabelKeys).map(
                            ([value, label]) => ({ value, label: t(label) }),
                          )}
                        />
                      </div>
                      {exceptionForm.kind !== "cancelled" ? (
                        <>
                          <label className="field narrow">
                            <span>{t("schedule.newStart")}</span>
                            <input
                              className="text-field"
                              type="time"
                              value={exceptionForm.newStartTime}
                              onChange={(event) =>
                                setExceptionForm({
                                  ...exceptionForm,
                                  newStartTime: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field narrow">
                            <span>{t("schedule.newEnd")}</span>
                            <input
                              className="text-field"
                              type="time"
                              value={exceptionForm.newEndTime}
                              onChange={(event) =>
                                setExceptionForm({
                                  ...exceptionForm,
                                  newEndTime: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>{t("schedule.newRoom")}</span>
                            <input
                              className="text-field"
                              value={exceptionForm.newRoom}
                              onChange={(event) =>
                                setExceptionForm({
                                  ...exceptionForm,
                                  newRoom: event.target.value,
                                })
                              }
                              maxLength={120}
                            />
                          </label>
                        </>
                      ) : null}
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="button filled"
                          disabled={busy}
                        >
                          {t("schedule.addException")}
                        </button>
                      </div>
                    </form>
                  </section>
                ),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
