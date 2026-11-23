import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { getDateFnsLocale, useTranslation } from "../lib/i18n";
import {
  type Exam,
  getWeekSchedule,
  listExams,
  listSubjects,
  listTerms,
  listTopicStudies,
  type ScheduleOccurrence,
  type Subject,
  searchTasks,
  type Task,
  type Term,
  type TopicStudy,
  type VaultStatus,
} from "../lib/ipc";
import { pickDefaultTerm } from "../lib/term";

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function isoDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Normaliza claves con hora o desfase a `YYYY-MM-DD`. */
function dayKey(value: string): string {
  return value.slice(0, 10);
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
  const [reviews, setReviews] = useState<TopicStudy[]>([]);
  const [classes, setClasses] = useState<ScheduleOccurrence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => isoDay(new Date()), []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadStructure() {
      try {
        const loadedTerms = await listTerms(null);
        if (!cancelled) {
          setTerms(loadedTerms);
          setTermId(
            (current) => current || (pickDefaultTerm(loadedTerms)?.id ?? ""),
          );
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
  // El grid del mes empieza en lunes: los lunes de cada semana visible son
  // los puntos de entrada a `getWeekSchedule`.
  const weekStarts = useMemo(() => {
    const result: string[] = [];
    let cursor = parseISO(rangeStart);
    const end = parseISO(rangeEnd);
    while (cursor <= end) {
      result.push(isoDay(cursor));
      cursor = addDays(cursor, 7);
    }
    return result;
  }, [rangeStart, rangeEnd]);

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

  useEffect(() => {
    if (!ready || !termId) {
      return;
    }
    let cancelled = false;

    async function loadAgenda() {
      try {
        const [loadedReviews, ...loadedWeeks] = await Promise.all([
          listTopicStudies(null, today, rangeStart, rangeEnd),
          ...weekStarts.map((weekStart) => getWeekSchedule(termId, weekStart)),
        ]);
        if (!cancelled) {
          setReviews(loadedReviews);
          setClasses(loadedWeeks.flatMap((week) => week.occurrences));
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadAgenda();
    return () => {
      cancelled = true;
    };
  }, [ready, termId, today, rangeStart, rangeEnd, weekStarts]);

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
    const add = (
      day: string,
      event: { id: string; label: string; kind: string },
    ) => {
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    };

    for (const exam of exams) {
      const day = dayKey(exam.date);
      const subject = subjectNames.get(exam.subjectId);
      add(day, {
        id: `exam-${exam.id}`,
        label: subject
          ? t("calendar.examEventWithSubject", {
              title: exam.title,
              subject,
            })
          : t("calendar.examEvent", { title: exam.title }),
        kind: "exam",
      });
    }
    for (const task of tasks) {
      if (!task.dueDate) {
        continue;
      }
      add(dayKey(task.dueDate), {
        id: `task-${task.id}`,
        label: t("calendar.taskEvent", { title: task.title }),
        kind: "task",
      });
    }
    for (const occurrence of classes) {
      add(dayKey(occurrence.date), {
        id: `class-${occurrence.slotId}-${occurrence.date}-${occurrence.startTime}`,
        label:
          occurrence.room && occurrence.room.trim() !== ""
            ? t("calendar.classEventWithRoom", {
                subject: occurrence.subjectName,
                time: occurrence.startTime,
                room: occurrence.room,
              })
            : t("calendar.classEvent", {
                subject: occurrence.subjectName,
                time: occurrence.startTime,
              }),
        kind: "class",
      });
    }
    for (const study of reviews) {
      const due = study.reviewItem?.dueDate;
      if (!due) {
        continue;
      }
      const day = dayKey(due);
      if (day < rangeStart || day > rangeEnd) {
        continue;
      }
      const subject = subjectNames.get(study.subjectId);
      add(day, {
        id: `review-${study.topicId}-${day}`,
        label: subject
          ? t("calendar.reviewEventWithSubject", {
              topic: study.name,
              subject,
            })
          : t("calendar.reviewEvent", { topic: study.name }),
        kind: "review",
      });
    }
    return map;
  }, [exams, tasks, classes, reviews, subjectNames, t, rangeStart, rangeEnd]);

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
                <div className="week-tools calendar-tools">
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
                          title={event.label}
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
