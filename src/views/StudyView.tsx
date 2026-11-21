import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { intlLocale, useTranslation } from "../lib/i18n";
import {
  deleteStudySession,
  finishStudySession,
  listAcademicYears,
  listStudyPriorities,
  listStudySessions,
  listSubjects,
  listTerms,
  listTopics,
  type StudyPriorityView,
  type StudySession,
  type StudySessionMode,
  type Subject,
  startStudySession,
  type Topic,
  type VaultStatus,
} from "../lib/ipc";

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 16).replace("T", " ")
    : new Intl.DateTimeFormat(intlLocale(), {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export function StudyView({
  vault,
  onGoVault,
  onGoSubjects,
  onGoStrengths,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
  onGoSubjects: () => void;
  onGoStrengths: () => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [priorities, setPriorities] = useState<StudyPriorityView[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [mode, setMode] = useState<StudySessionMode>("pomodoro");
  const [planned, setPlanned] = useState("25");
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [interruptions, setInterruptions] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadStructure() {
      try {
        const years = await listAcademicYears();
        const terms = years[0] ? await listTerms(years[0].id) : [];
        const loadedSubjects = terms[0] ? await listSubjects(terms[0].id) : [];
        if (!cancelled) {
          setSubjects(loadedSubjects);
          setSubjectId((current) => current || (loadedSubjects[0]?.id ?? ""));
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
    if (!ready || !subjectId) {
      setTopics([]);
      return;
    }
    let cancelled = false;

    async function loadTopics() {
      try {
        const loaded = await listTopics(subjectId);
        if (!cancelled) {
          setTopics(loaded);
          setTopicId((current) =>
            current && loaded.some((item) => item.id === current)
              ? current
              : "",
          );
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadTopics();
    return () => {
      cancelled = true;
    };
  }, [ready, subjectId]);

  async function reload() {
    const [loadedPriorities, loadedSessions] = await Promise.all([
      listStudyPriorities(todayIso()),
      listStudySessions(),
    ]);
    setPriorities(loadedPriorities);
    setSessions(loadedSessions);
  }

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const [loadedPriorities, loadedSessions] = await Promise.all([
          listStudyPriorities(todayIso()),
          listStudySessions(),
        ]);
        if (!cancelled) {
          setPriorities(loadedPriorities);
          setSessions(loadedSessions);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!activeSession || !running) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession, running]);

  useEffect(() => {
    if (activeSession && running && remainingSeconds === 0) {
      setRunning(false);
      setNotice(t("study.timeUp"));
    }
  }, [activeSession, running, remainingSeconds, t]);

  const subjectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      map.set(subject.id, subject.name);
    }
    return map;
  }, [subjects]);

  const elapsedSeconds = activeSession
    ? Math.max(0, plannedMinutes * 60 - remainingSeconds)
    : 0;
  const progress = activeSession
    ? Math.min(100, Math.round((elapsedSeconds / (plannedMinutes * 60)) * 100))
    : 0;

  function modeLabel(value: StudySessionMode): string {
    return t(`study.mode.${value}`);
  }

  async function reloadSafe() {
    try {
      await reload();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function handleStart() {
    const minutes = Number(planned);
    if (
      !Number.isFinite(minutes) ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 240
    ) {
      setError(t("study.minutesError"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const session = await startStudySession(
        subjectId || null,
        topicId || null,
        mode,
        minutes,
      );
      setActiveSession(session);
      setPlannedMinutes(minutes);
      setRemainingSeconds(minutes * 60);
      setInterruptions(0);
      setRunning(true);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  function toggleRunning() {
    if (!activeSession) {
      return;
    }
    if (running) {
      setRunning(false);
      setInterruptions((value) => value + 1);
    } else {
      setRunning(true);
    }
  }

  async function handleFinish() {
    if (!activeSession) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const actual = Math.max(0, Math.round(elapsedSeconds / 60));
      await finishStudySession(activeSession.id, actual, interruptions, null);
      setActiveSession(null);
      setRunning(false);
      setRemainingSeconds(0);
      setInterruptions(0);
      setNotice(t("study.sessionClosed", { minutes: actual }));
      await reloadSafe();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    if (!activeSession) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteStudySession(activeSession.id);
      setActiveSession(null);
      setRunning(false);
      setRemainingSeconds(0);
      setInterruptions(0);
      setNotice(t("study.discarded"));
      await reloadSafe();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSession(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteStudySession(id);
      await reloadSafe();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("study.eyebrow")}</p>
        <h1>{t("study.title")}</h1>
        <p className="hero-copy">{t("study.copy")}</p>
        <div className="hero-actions">
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
          <p>{t("study.noVaultBody")}</p>
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
          {notice ? <p className="notice">{notice}</p> : null}

          {subjects.length === 0 ? (
            <section className="next-card">
              <p className="eyebrow">{t("calendar.subjectsRequired")}</p>
              <h2>{t("calendar.createSubjectFirst")}</h2>
              <p>{t("study.noSubjectsBody")}</p>
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
          ) : null}

          <div className="study-layout">
            <section className="status-card">
              <div>
                <p className="eyebrow">{t("study.pomodoro")}</p>
                <h2>
                  {activeSession
                    ? formatClock(remainingSeconds)
                    : t("study.planned", { minutes: plannedMinutes })}
                </h2>
                <p className="quiet">
                  {activeSession
                    ? t("study.activeMeta", {
                        mode: modeLabel(activeSession.mode),
                        count: interruptions,
                      })
                    : t("study.timerHint")}
                </p>
              </div>

              {activeSession ? (
                <div className="pomodoro">
                  <div className="pomodoro-progress" aria-hidden="true">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="hero-actions">
                    <button
                      type="button"
                      className="button filled"
                      disabled={busy}
                      onClick={toggleRunning}
                    >
                      {running ? t("study.pause") : t("study.resume")}
                    </button>
                    <button
                      type="button"
                      className="button tonal"
                      disabled={busy}
                      onClick={() => void handleFinish()}
                    >
                      {t("study.finishSession")}
                    </button>
                    <button
                      type="button"
                      className="mini-action danger"
                      disabled={busy}
                      onClick={() => void handleDiscard()}
                    >
                      {t("study.discard")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inline-form">
                  <div className="field narrow">
                    <span>{t("schedule.mode")}</span>
                    <CustomSelect
                      className="select-field"
                      ariaLabel={t("study.studyModeAria")}
                      value={mode}
                      onChange={(value) => setMode(value as StudySessionMode)}
                      options={[
                        { value: "pomodoro", label: t("study.mode.pomodoro") },
                        { value: "free", label: t("study.mode.free") },
                        { value: "review", label: t("study.mode.review") },
                      ]}
                    />
                  </div>
                  <label className="field narrow">
                    <span>{t("study.minutes")}</span>
                    <input
                      className="text-field"
                      type="number"
                      min={1}
                      max={240}
                      aria-label={t("study.plannedMinutesAria")}
                      value={planned}
                      onChange={(event) => setPlanned(event.target.value)}
                    />
                  </label>
                  <div className="field">
                    <span>{t("common.subject")}</span>
                    <CustomSelect
                      className="select-field"
                      ariaLabel={t("study.sessionSubjectAria")}
                      value={subjectId}
                      onChange={setSubjectId}
                      options={[
                        { value: "", label: t("common.noSubject") },
                        ...subjects.map((subject) => ({
                          value: subject.id,
                          label: subject.name,
                        })),
                      ]}
                    />
                  </div>
                  <div className="field">
                    <span>{t("study.topicOptional")}</span>
                    <CustomSelect
                      className="select-field"
                      ariaLabel={t("study.sessionTopicAria")}
                      value={topicId}
                      onChange={setTopicId}
                      options={[
                        { value: "", label: t("common.noTopic") },
                        ...topics.map((topic) => ({
                          value: topic.id,
                          label: topic.name,
                        })),
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    className="button filled"
                    disabled={busy}
                    onClick={() => void handleStart()}
                  >
                    {t("study.start")}
                  </button>
                </div>
              )}
            </section>

            <section className="status-card">
              <div>
                <p className="eyebrow">{t("study.priorityEyebrow")}</p>
                <h2>{t("study.priorityTitle")}</h2>
                <p className="quiet">{t("study.priorityBody")}</p>
                <button
                  type="button"
                  className="button tonal"
                  onClick={onGoStrengths}
                >
                  {t("study.adjustStrengths")}
                </button>
              </div>
              {priorities.length === 0 ? (
                <p className="quiet">{t("study.emptyPriorities")}</p>
              ) : (
                <ol
                  className="priority-list"
                  aria-label={t("study.priorityListAria")}
                >
                  {priorities.slice(0, 10).map((item, index) => (
                    <li key={item.topicId} className="priority-row">
                      <span className="priority-rank">{index + 1}</span>
                      <div className="priority-body">
                        <div className="priority-heading">
                          <strong>{item.topicName}</strong>
                          <span className="quiet">{item.subjectName}</span>
                          <span
                            className={`strength-chip is-${item.classification}`}
                          >
                            {t(`study.classification.${item.classification}`)}
                          </span>
                        </div>
                        <ul className="priority-reasons">
                          {item.reasons.map((reason) => (
                            <li key={reason.code}>
                              {reason.label}{" "}
                              <span className="quiet">+{reason.points}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <span className="priority-score">{item.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className="status-card">
            <div>
              <p className="eyebrow">{t("study.historyEyebrow")}</p>
              <h2>{t("study.historyTitle")}</h2>
              <p className="quiet">{t("study.historyBody")}</p>
            </div>
            {sessions.length === 0 ? (
              <p className="quiet">{t("study.emptySessions")}</p>
            ) : (
              <ul className="mini-list" aria-label={t("study.sessionsAria")}>
                {sessions.slice(0, 12).map((session) => (
                  <li key={session.id} className="mini-item has-badge">
                    <div className="mini-item-body">
                      <div className="mini-item-heading">
                        <strong>
                          {session.subjectId
                            ? (subjectNames.get(session.subjectId) ??
                              t("study.deletedSubject"))
                            : t("common.noSubject")}
                        </strong>
                      </div>
                      <span className="quiet mini-item-meta">
                        {t("study.sessionMetaShort", {
                          minutes: session.actualMinutes ?? 0,
                          count: session.interruptions,
                          date: formatDateTime(session.startedAt),
                        })}
                      </span>
                    </div>
                    <span className="item-badge">
                      {modeLabel(session.mode)}
                    </span>
                    <button
                      type="button"
                      className="mini-action danger"
                      aria-label={t("study.deleteSessionAria", {
                        date: formatDateTime(session.startedAt),
                      })}
                      disabled={busy}
                      onClick={() => void handleDeleteSession(session.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
