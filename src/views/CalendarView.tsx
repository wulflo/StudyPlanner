import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { getDateFnsLocale, useTranslation } from "../lib/i18n";
import {
  type Exam,
  listAcademicYears,
  listExams,
  listSubjects,
  listTerms,
  type Subject,
  searchTasks,
  type Task,
  type Term,
  type VaultStatus,
} from "../lib/ipc";

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function isoDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const weekdayKeys = [
  "schedule.shortWeekdays.monday",
  "schedule.shortWeekdays.tuesday",
  "schedule.shortWeekdays.wednesday",
  "schedule.shortWeekdays.thursday",
  "schedule.shortWeekdays.friday",
  "schedule.shortWeekdays.saturday",
  "schedule.shortWeekdays.sunday",
] as const;

export function CalendarView({
  vault,
  onGoVault,
  onGoSubjects,
  onBack,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
  onGoSubjects: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadStructure() {
      try {
        const years = await listAcademicYears();
        const loadedTerms = years[0] ? await listTerms(years[0].id) : [];
        if (!cancelled) {
          setTerms(loadedTerms);
          setTermId((current) => current || (loadedTerms[0]?.id ?? ""));
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadStructure();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !termId) {
      return;
    }
    let cancelled = false;

    async function loadExams() {
      try {
        const [loadedExams, loadedSubjects] = await Promise.all([
          listExams(termId, null),
          listSubjects(termId),
        ]);
        if (!cancelled) {
          setExams(loadedExams);
          setSubjects(loadedSubjects);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadExams();
    return () => {
      cancelled = true;
    };
  }, [ready, termId]);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );
  const rangeStart = isoDay(gridStart);
  const rangeEnd = isoDay(gridEnd);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadTasks() {
      try {
        const loaded = await searchTasks({
          dueFrom: rangeStart,
          dueTo: rangeEnd,
        });
        if (!cancelled) {
          setTasks(loaded);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [ready, rangeStart, rangeEnd]);

  const subjectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      map.set(subject.id, subject.name);
    }
    return map;
  }, [subjects]);

  const eventsByDay = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; kind: string }[]
    >();
    for (const exam of exams) {
      const day = exam.date;
      const list = map.get(day) ?? [];
      const subject = subjectNames.get(exam.subjectId);
      list.push({
        id: `exam-${exam.id}`,
        label: subject
          ? t("calendar.examEventWithSubject", {
              title: exam.title,
              subject,
            })
          : t("calendar.examEvent", { title: exam.title }),
        kind: "exam",
      });
      map.set(day, list);
    }
    for (const task of tasks) {
      if (!task.dueDate) {
        continue;
      }
      const list = map.get(task.dueDate) ?? [];
      list.push({
        id: `task-${task.id}`,
        label: t("calendar.taskEvent", { title: task.title }),
        kind: "task",
      });
      map.set(task.dueDate, list);
    }
    return map;
  }, [exams, tasks, subjectNames, t]);

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("calendar.eyebrow")}</p>
        <h1>{t("calendar.title")}</h1>
        <p className="hero-copy">{t("calendar.copy")}</p>
        <div className="hero-actions">
          <button type="button" className="button tonal" onClick={onBack}>
            {t("calendar.backToToday")}
          </button>
          {ready ? (
            <span className="status-pill is-ok">
              {t("common.vaultName", {
                name: vault?.name ?? t("common.ready"),
              })}
            </span>
          ) : (
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.configureVault")}
            </button>
          )}
        </div>
      </section>

      {!ready ? (
        <section className="next-card">
          <p className="eyebrow">{t("common.vaultRequired")}</p>
          <h2>{t("common.chooseVaultFirst")}</h2>
          <p>{t("calendar.noVaultBody")}</p>
          <div className="hero-actions">
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.goToVault")}
            </button>
          </div>
        </section>
      ) : (
        <>
          {error ? (
            <p className="notice error" role="alert">
              {error}
            </p>
          ) : null}

          {terms.length === 0 ? (
            <section className="next-card">
              <p className="eyebrow">{t("calendar.subjectsRequired")}</p>
              <h2>{t("calendar.createSubjectFirst")}</h2>
              <p>{t("calendar.noTermBody")}</p>
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
              <section className="academic-panel">
                <div className="week-tools">
                  <div className="field">
                    <span>{t("common.term")}</span>
                    <CustomSelect
                      ariaLabel={t("common.term")}
                      className="select-field"
                      value={termId}
                      onChange={setTermId}
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
                      onClick={() => setMonth(addMonths(month, -1))}
                    >
                      {t("common.previous")}
                    </button>
                    <h2>
                      {format(month, "MMMM yyyy", {
                        locale: getDateFnsLocale(),
                      })}
                    </h2>
                    <button
                      type="button"
                      className="button tonal"
                      onClick={() => setMonth(addMonths(month, 1))}
                    >
                      {t("common.next")}
                    </button>
                  </div>
                </div>
              </section>

              <section
                className="calendar-grid"
                aria-label={t("calendar.monthAria")}
              >
                {weekdayKeys.map((key) => (
                  <div key={key} className="calendar-weekday">
                    {t(key)}
                  </div>
                ))}
                {days.map((day) => {
                  const key = isoDay(day);
                  const events = eventsByDay.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={`calendar-day${
                        isSameMonth(day, month) ? "" : " is-outside"
                      }${key === isoDay(new Date()) ? " is-today" : ""}`}
                    >
                      <span className="calendar-day-number">
                        {format(day, "d")}
                      </span>
                      {events.map((event) => (
                        <span
                          key={event.id}
                          className={`calendar-event is-${event.kind}`}
                        >
                          {event.label}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
