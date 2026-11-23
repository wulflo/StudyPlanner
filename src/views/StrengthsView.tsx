import { format } from "date-fns";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { DateField } from "../components/DateField";
import { useTranslation } from "../lib/i18n";
import {
  clearStrengthOverride,
  createSelfAssessment,
  listAllSubjects,
  listTopicStudies,
  reviewTopic,
  type StrengthClassification,
  type Subject,
  setReviewDue,
  setStrengthOverride,
  type TopicStudy,
  type VaultStatus,
} from "../lib/ipc";

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function scoreText(score: number): string {
  return `${score} / 5`;
}

export function StrengthsView({
  vault,
  onGoVault,
  onGoSubjects,
  onGoExams,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
  onGoSubjects: () => void;
  onGoExams: () => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [studies, setStudies] = useState<TopicStudy[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState("3");
  const [note, setNote] = useState("");
  const [overrideClass, setOverrideClass] =
    useState<StrengthClassification>("neutral");
  const [overrideReason, setOverrideReason] = useState("");
  const [quality, setQuality] = useState("4");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadStructure() {
      try {
        const loadedSubjects = await listAllSubjects();
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
      setStudies([]);
      return;
    }
    let cancelled = false;

    async function loadStudies() {
      try {
        const loaded = await listTopicStudies(subjectId, todayIso());
        if (!cancelled) {
          setStudies(loaded);
          setSelectedId((current) =>
            current && loaded.some((item) => item.topicId === current)
              ? current
              : (loaded[0]?.topicId ?? null),
          );
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadStudies();
    return () => {
      cancelled = true;
    };
  }, [ready, subjectId]);

  const selected = useMemo(
    () => studies.find((item) => item.topicId === selectedId) ?? null,
    [studies, selectedId],
  );

  const counts = useMemo(() => {
    const base = { weak: 0, neutral: 0, strength: 0, due: 0 };
    for (const study of studies) {
      base[study.classification] += 1;
      if (study.reviewItem?.dueDate && study.reviewItem.dueDate <= todayIso()) {
        base.due += 1;
      }
    }
    return base;
  }, [studies]);

  async function reload() {
    if (!subjectId) {
      return;
    }
    const loaded = await listTopicStudies(subjectId, todayIso());
    setStudies(loaded);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  function selectTopic(topic: TopicStudy) {
    setSelectedId(topic.topicId);
    setScore(String(topic.latestAssessment?.score ?? 3));
    setNote("");
    setOverrideClass(topic.overrideClassification ?? "neutral");
    setOverrideReason(topic.overrideReason ?? "");
    setQuality("4");
    setDueDate(topic.reviewItem?.dueDate ?? "");
    setNotice(null);
    setError(null);
  }

  async function handleAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    await run(async () => {
      await createSelfAssessment(
        selected.topicId,
        Number(score),
        note.trim() || null,
      );
      await reload();
      setNote("");
      setNotice(t("strengths.assessmentSaved"));
    });
  }

  async function handleOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    await run(async () => {
      await setStrengthOverride(
        selected.topicId,
        overrideClass,
        overrideReason.trim() || null,
      );
      await reload();
      setNotice(t("strengths.overrideApplied"));
    });
  }

  async function handleClearOverride() {
    if (!selected) {
      return;
    }
    await run(async () => {
      await clearStrengthOverride(selected.topicId);
      await reload();
      setOverrideReason("");
      setNotice(t("strengths.overrideCleared"));
    });
  }

  async function handleReview() {
    if (!selected) {
      return;
    }
    await run(async () => {
      const item = await reviewTopic(
        selected.topicId,
        Number(quality),
        todayIso(),
      );
      await reload();
      setDueDate(item.dueDate ?? "");
      setNotice(
        t("strengths.reviewRegistered", {
          date: item.dueDate ?? t("strengths.noDate"),
        }),
      );
    });
  }

  async function handleScheduleReview() {
    if (!selected || !dueDate) {
      setError(t("strengths.chooseDate"));
      return;
    }
    await run(async () => {
      await setReviewDue(selected.topicId, dueDate);
      await reload();
      setNotice(t("strengths.reviewUpdated"));
    });
  }

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("strengths.eyebrow")}</p>
        <h1>{t("strengths.title")}</h1>
        <p className="hero-copy">{t("strengths.copy")}</p>
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
          <p>{t("strengths.noVaultBody")}</p>
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
              <p>{t("strengths.noSubjectsBody")}</p>
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
                <div className="field">
                  <span>{t("common.subject")}</span>
                  <CustomSelect
                    ariaLabel={t("common.subject")}
                    className="select-field"
                    value={subjectId}
                    onChange={(value) => {
                      setSubjectId(value);
                      setSelectedId(null);
                      setNotice(null);
                      setError(null);
                    }}
                    options={subjects.map((subject) => ({
                      value: subject.id,
                      label: subject.name,
                    }))}
                  />
                </div>
                <div className="study-summary">
                  <span className="status-pill is-low">
                    {t("strengths.counts.weak", { count: counts.weak })}
                  </span>
                  <span className="status-pill">
                    {t("strengths.counts.neutral", { count: counts.neutral })}
                  </span>
                  <span className="status-pill is-ok">
                    {t("strengths.counts.strength", {
                      count: counts.strength,
                    })}
                  </span>
                  <span className="status-pill">
                    {t("strengths.counts.due", { count: counts.due })}
                  </span>
                </div>
              </section>

              {studies.length === 0 ? (
                <section className="next-card">
                  <p className="eyebrow">{t("strengths.topicsRequired")}</p>
                  <h2>{t("strengths.noTopicsTitle")}</h2>
                  <p>{t("strengths.noTopicsBody")}</p>
                  <div className="hero-actions">
                    <button
                      type="button"
                      className="button filled"
                      onClick={onGoExams}
                    >
                      {t("common.goToExams")}
                    </button>
                  </div>
                </section>
              ) : (
                <div className="study-layout">
                  <ul
                    className="mini-list"
                    aria-label={t("strengths.topicsAria")}
                  >
                    {studies.map((study) => (
                      <li key={study.topicId}>
                        <button
                          type="button"
                          className={`mini-item study-topic${
                            selectedId === study.topicId ? " is-active" : ""
                          }`}
                          onClick={() => selectTopic(study)}
                        >
                          <span
                            className={`strength-chip is-${study.classification}`}
                          >
                            {t(
                              `strengths.classificationLabel.${study.classification}`,
                            )}
                          </span>
                          <strong>{study.name}</strong>
                          <span className="quiet">
                            {study.latestAssessment
                              ? t("strengths.lastScore", {
                                  score: scoreText(
                                    study.latestAssessment.score,
                                  ),
                                })
                              : t("strengths.notEvaluated")}
                          </span>
                          {study.reviewItem?.dueDate ? (
                            <span className="quiet">
                              {t("strengths.reviewDate", {
                                date: study.reviewItem.dueDate,
                              })}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {selected ? (
                    <section className="status-card study-detail">
                      <div>
                        <p className="eyebrow">
                          {t("strengths.selectedEyebrow")}
                        </p>
                        <h2>{selected.name}</h2>
                        <p className="quiet">
                          {t("strengths.autoClassification", {
                            classification: t(
                              `strengths.classificationLabel.${selected.derivedClassification}`,
                            ),
                          })}
                          {selected.overrideClassification
                            ? t("strengths.overrideSuffix", {
                                classification: t(
                                  `strengths.classificationLabel.${selected.overrideClassification}`,
                                ),
                              })
                            : ""}
                        </p>
                        {selected.description ? (
                          <p>{selected.description}</p>
                        ) : null}
                        {selected.nextExamDate ? (
                          <p className="quiet">
                            {t("strengths.nextExam", {
                              date: selected.nextExamDate,
                            })}
                          </p>
                        ) : null}
                      </div>

                      <div className="study-detail-grid">
                        <form
                          className="inline-form study-detail-block"
                          onSubmit={handleAssessment}
                        >
                          <p className="eyebrow">
                            {t("strengths.selfAssessment")}
                          </p>
                          <div className="field narrow">
                            <span>{t("strengths.score")}</span>
                            <CustomSelect
                              className="select-field"
                              ariaLabel={t("strengths.assessmentAria")}
                              value={score}
                              onChange={setScore}
                              options={[1, 2, 3, 4, 5].map((value) => ({
                                value: String(value),
                                label: String(value),
                              }))}
                            />
                          </div>
                          <label className="field">
                            <span>{t("strengths.noteOptional")}</span>
                            <input
                              className="text-field"
                              aria-label={t("strengths.noteAria")}
                              value={note}
                              maxLength={120}
                              onChange={(event) => setNote(event.target.value)}
                            />
                          </label>
                          <button
                            type="submit"
                            className="button filled"
                            disabled={busy}
                          >
                            {t("strengths.saveAssessment")}
                          </button>
                        </form>

                        <form
                          className="inline-form study-detail-block"
                          onSubmit={handleOverride}
                        >
                          <p className="eyebrow">
                            {t("strengths.manualOverride")}
                          </p>
                          <div className="field narrow">
                            <span>{t("strengths.classification")}</span>
                            <CustomSelect
                              className="select-field"
                              ariaLabel={t("strengths.manualClassAria")}
                              value={overrideClass}
                              onChange={(value) =>
                                setOverrideClass(
                                  value as StrengthClassification,
                                )
                              }
                              options={[
                                {
                                  value: "weak",
                                  label: t(
                                    "strengths.classificationLabel.weak",
                                  ),
                                },
                                {
                                  value: "neutral",
                                  label: t(
                                    "strengths.classificationLabel.neutral",
                                  ),
                                },
                                {
                                  value: "strength",
                                  label: t(
                                    "strengths.classificationLabel.strength",
                                  ),
                                },
                              ]}
                            />
                          </div>
                          <label className="field">
                            <span>{t("strengths.reasonOptional")}</span>
                            <input
                              className="text-field"
                              aria-label={t("strengths.reasonAria")}
                              value={overrideReason}
                              maxLength={120}
                              onChange={(event) =>
                                setOverrideReason(event.target.value)
                              }
                            />
                          </label>
                          <div className="form-actions">
                            <button
                              type="submit"
                              className="button tonal"
                              disabled={busy}
                            >
                              {t("strengths.applyOverride")}
                            </button>
                            {selected.overrideClassification ? (
                              <button
                                type="button"
                                className="mini-action danger"
                                disabled={busy}
                                onClick={() => void handleClearOverride()}
                              >
                                {t("strengths.removeOverride")}
                              </button>
                            ) : null}
                          </div>
                        </form>

                        <div className="inline-form study-detail-block">
                          <p className="eyebrow">
                            {t("strengths.spacedReview")}
                          </p>
                          {selected.reviewItem ? (
                            <ul className="stats-list">
                              <li>
                                <span>{t("strengths.ease")}</span>
                                <strong>
                                  {(
                                    selected.reviewItem.easeFactorCp / 100
                                  ).toFixed(2)}
                                </strong>
                              </li>
                              <li>
                                <span>{t("strengths.interval")}</span>
                                <strong>
                                  {t("common.dayCount", {
                                    count: selected.reviewItem.intervalDays,
                                  })}
                                </strong>
                              </li>
                              <li>
                                <span>{t("strengths.repetitions")}</span>
                                <strong>
                                  {selected.reviewItem.repetitions}
                                </strong>
                              </li>
                              <li>
                                <span>{t("strengths.lapses")}</span>
                                <strong>{selected.reviewItem.lapses}</strong>
                              </li>
                              <li>
                                <span>{t("strengths.nextReview")}</span>
                                <strong>
                                  {selected.reviewItem.dueDate ??
                                    t("strengths.noDate")}
                                </strong>
                              </li>
                            </ul>
                          ) : (
                            <p className="quiet">{t("strengths.noReview")}</p>
                          )}

                          <div className="field narrow">
                            <span>{t("strengths.reviewQuality")}</span>
                            <CustomSelect
                              className="select-field"
                              ariaLabel={t("strengths.reviewQualityAria")}
                              value={quality}
                              onChange={setQuality}
                              options={[1, 2, 3, 4, 5].map((value) => ({
                                value: String(value),
                                label: String(value),
                              }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="button filled"
                            disabled={busy}
                            onClick={() => void handleReview()}
                          >
                            {t("strengths.registerReview")}
                          </button>
                        </div>

                        <div className="inline-form study-detail-block">
                          <p className="eyebrow">
                            {t("strengths.scheduleReview")}
                          </p>
                          <DateField
                            label={t("common.date")}
                            ariaLabel={t("strengths.reviewDateAria")}
                            value={dueDate}
                            onChange={setDueDate}
                          />
                          <button
                            type="button"
                            className="button tonal"
                            disabled={busy}
                            onClick={() => void handleScheduleReview()}
                          >
                            {t("strengths.saveDate")}
                          </button>
                        </div>
                      </div>

                      {selected.latestAssessment ? (
                        <p className="quiet">
                          {t("strengths.lastAssessment", {
                            score: scoreText(selected.latestAssessment.score),
                            source: selected.latestAssessment.source,
                            date: selected.latestAssessment.assessedAt.slice(
                              0,
                              10,
                            ),
                          })}
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
