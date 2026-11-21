import { type FormEvent, useEffect, useState } from "react";
import { Trans } from "react-i18next";
import { CustomSelect } from "../components/CustomSelect";
import { DateField } from "../components/DateField";
import { Tabs } from "../components/Tabs";
import { useTranslation } from "../lib/i18n";
import {
  createExam,
  createTopic,
  deleteExam,
  deleteTopic,
  type Exam,
  type ExamInput,
  type ExamResultStatus,
  linkExamTopic,
  listAcademicYears,
  listExams,
  listExamTopics,
  listSubjects,
  listTerms,
  listTopics,
  type Subject,
  type Topic,
  type TopicInput,
  unlinkExamTopic,
  updateExam,
  type VaultStatus,
} from "../lib/ipc";

const resultStatuses: ExamResultStatus[] = [
  "pending",
  "passed",
  "failed",
  "absent",
];

const pageSizes = [5, 10, 20, 50];

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cpToValue(value: number | null): string {
  return value === null ? "—" : (value / 100).toFixed(2);
}

const emptyExam = {
  id: null as string | null,
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  room: "",
  weight: "",
  resultScore: "",
  resultMax: "",
  resultStatus: "pending" as ExamResultStatus,
  notes: "",
};

const emptyTopic = {
  id: null as string | null,
  name: "",
  parentTopicId: "",
  description: "",
  sortOrder: "0",
};

type ExamForm = typeof emptyExam;

function examInputFromForm(form: ExamForm): ExamInput {
  return {
    title: form.title,
    date: form.date,
    startTime: optionalText(form.startTime),
    endTime: optionalText(form.endTime),
    room: optionalText(form.room),
    weightBp:
      optionalNumber(form.weight) === null
        ? null
        : Math.round((optionalNumber(form.weight) ?? 0) * 100),
    resultScoreCp:
      optionalNumber(form.resultScore) === null
        ? null
        : Math.round((optionalNumber(form.resultScore) ?? 0) * 100),
    resultMaxCp:
      optionalNumber(form.resultMax) === null
        ? null
        : Math.round((optionalNumber(form.resultMax) ?? 0) * 100),
    resultStatus: form.resultStatus,
    notes: optionalText(form.notes),
  };
}

function formFromExam(exam: Exam): ExamForm {
  return {
    id: exam.id,
    title: exam.title,
    date: exam.date,
    startTime: exam.startTime ?? "",
    endTime: exam.endTime ?? "",
    room: exam.room ?? "",
    weight: exam.weightBp === null ? "" : String(exam.weightBp / 100),
    resultScore:
      exam.resultScoreCp === null ? "" : String(exam.resultScoreCp / 100),
    resultMax: exam.resultMaxCp === null ? "" : String(exam.resultMaxCp / 100),
    resultStatus: exam.resultStatus,
    notes: exam.notes ?? "",
  };
}

export function ExamsView({
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [links, setLinks] = useState<Record<string, string[]>>({});
  const [pageSize, setPageSize] = useState(10);
  const [visibleCount, setVisibleCount] = useState(10);
  const [linksLoading, setLinksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [examForm, setExamForm] = useState<ExamForm>(emptyExam);
  const [topicForm, setTopicForm] = useState(emptyTopic);
  const visibleExams = exams.slice(0, visibleCount);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadSubjects() {
      try {
        const years = await listAcademicYears();
        const terms = years[0] ? await listTerms(years[0].id) : [];
        const loaded = terms[0] ? await listSubjects(terms[0].id) : [];
        if (!cancelled) {
          setSubjects(loaded);
          setSubjectId((current) => current || (loaded[0]?.id ?? ""));
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !subjectId) {
      return;
    }
    let cancelled = false;

    async function loadData() {
      try {
        const [loadedExams, loadedTopics] = await Promise.all([
          listExams(null, subjectId),
          listTopics(subjectId),
        ]);
        if (cancelled) {
          return;
        }
        setExams(loadedExams);
        setTopics(loadedTopics);
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [ready, subjectId]);

  // Solo se piden los vínculos de los exámenes visibles. Al ampliar la página
  // se cargan los que faltan y se conserva el resto en memoria.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const missing = exams
      .slice(0, visibleCount)
      .filter((exam) => links[exam.id] === undefined);
    if (missing.length === 0) {
      setLinksLoading(false);
      return;
    }

    let cancelled = false;
    setLinksLoading(true);

    async function loadLinks() {
      try {
        const entries = await Promise.all(
          missing.map(async (exam) => {
            const examTopics = await listExamTopics(exam.id);
            return [exam.id, examTopics.map((link) => link.topicId)] as const;
          }),
        );
        if (!cancelled) {
          setLinks((current) => {
            const next = { ...current };
            for (const [examId, topicIds] of entries) {
              next[examId] = topicIds;
            }
            return next;
          });
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      } finally {
        if (!cancelled) {
          setLinksLoading(false);
        }
      }
    }

    void loadLinks();
    return () => {
      cancelled = true;
    };
  }, [ready, exams, visibleCount, links]);

  async function refresh() {
    if (!subjectId) {
      return;
    }
    const [loadedExams, loadedTopics] = await Promise.all([
      listExams(null, subjectId),
      listTopics(subjectId),
    ]);
    setExams(loadedExams);
    setTopics(loadedTopics);
  }

  async function submitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectId) {
      return;
    }
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      return;
    }
    setError(null);
    try {
      if (examForm.id) {
        await updateExam(examForm.id, examInputFromForm(examForm));
        setNotice(t("exams.examUpdated"));
      } else {
        await createExam(
          subjectId,
          subject.termId,
          examInputFromForm(examForm),
        );
        setNotice(t("exams.examCreated"));
      }
      setExamForm(emptyExam);
      await refresh();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function submitTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subjectId) {
      return;
    }
    setError(null);
    const input: TopicInput = {
      parentTopicId: optionalText(topicForm.parentTopicId),
      name: topicForm.name,
      description: optionalText(topicForm.description),
      sortOrder: Math.round(optionalNumber(topicForm.sortOrder) ?? 0),
    };
    try {
      await createTopic(subjectId, input);
      setTopicForm(emptyTopic);
      setNotice(t("exams.topicCreated"));
      await refresh();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function handleDeleteExam(exam: Exam) {
    setError(null);
    try {
      await deleteExam(exam.id);
      if (examForm.id === exam.id) {
        setExamForm(emptyExam);
      }
      await refresh();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function handleDeleteTopic(topic: Topic) {
    setError(null);
    try {
      await deleteTopic(topic.id);
      await refresh();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function toggleLink(examId: string, topicId: string, checked: boolean) {
    setError(null);
    try {
      if (checked) {
        await linkExamTopic(examId, topicId);
      } else {
        await unlinkExamTopic(examId, topicId);
      }
      setLinks((current) => {
        const existing = new Set(current[examId] ?? []);
        if (checked) {
          existing.add(topicId);
        } else {
          existing.delete(topicId);
        }
        return { ...current, [examId]: [...existing] };
      });
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("exams.eyebrow")}</p>
        <h1>{t("exams.title")}</h1>
        <p className="hero-copy">{t("exams.copy")}</p>
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
          <p>
            <Trans i18nKey="exams.noVaultBody" components={{ b: <b /> }} />
          </p>
          <div className="hero-actions">
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.goToVault")}
            </button>
          </div>
        </section>
      ) : subjects.length === 0 ? (
        <section className="next-card">
          <p className="eyebrow">{t("calendar.subjectsRequired")}</p>
          <h2>{t("calendar.createSubjectFirst")}</h2>
          <p>{t("exams.noSubjectsBody")}</p>
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
            <div className="inline-form">
              <div className="field">
                <span>{t("common.subject")}</span>
                <CustomSelect
                  ariaLabel={t("common.subject")}
                  className="select-field"
                  value={subjectId}
                  onChange={(value) => {
                    setSubjectId(value);
                    setExamForm(emptyExam);
                    setTopicForm(emptyTopic);
                    setLinks({});
                    setVisibleCount(pageSize);
                  }}
                  options={subjects.map((subject) => ({
                    value: subject.id,
                    label: subject.name,
                  }))}
                />
              </div>
            </div>
          </section>

          {error ? (
            <p className="notice error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="notice" role="status">
              {notice}
            </p>
          ) : null}

          <Tabs
            label={t("exams.sectionsAria")}
            initialId="list"
            items={[
              {
                id: "list",
                label: t("exams.listTitle"),
                badge: exams.length,
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="exam-list-title"
                  >
                    <div className="task-board-head">
                      <h2 id="exam-list-title">{t("exams.listTitle")}</h2>
                      <span className="count-chip">{exams.length}</span>
                    </div>
                    {exams.length === 0 ? (
                      <p className="empty-state">{t("exams.noExams")}</p>
                    ) : (
                      <>
                        <div className="list-toolbar">
                          <div className="field narrow">
                            <span>{t("exams.pageSize")}</span>
                            <CustomSelect
                              ariaLabel={t("exams.pageSize")}
                              className="select-field"
                              value={String(pageSize)}
                              onChange={(value) => {
                                const size = Number(value);
                                setPageSize(size);
                                setVisibleCount(size);
                              }}
                              options={pageSizes.map((size) => ({
                                value: String(size),
                                label: String(size),
                              }))}
                            />
                          </div>
                          <span className="quiet">
                            {t("exams.showing", {
                              shown: visibleExams.length,
                              total: exams.length,
                            })}
                          </span>
                        </div>
                        {linksLoading ? (
                          <p className="inline-loading" role="status">
                            {t("exams.loadingLinks")}
                          </p>
                        ) : null}
                        <ul className="mini-list">
                          {visibleExams.map((exam) => (
                            <li
                              key={exam.id}
                              className="mini-item exam-item has-badge"
                            >
                              <div className="mini-item-body">
                                <div className="mini-item-heading">
                                  <strong>{exam.title}</strong>
                                </div>
                                <span className="quiet mini-item-meta">
                                  {exam.date}
                                  {exam.startTime ? ` ${exam.startTime}` : ""}
                                  {exam.endTime ? `–${exam.endTime}` : ""}
                                  {exam.weightBp !== null
                                    ? t("exams.weightSuffix", {
                                        weight: (exam.weightBp / 100).toFixed(
                                          1,
                                        ),
                                      })
                                    : ""}
                                  {exam.resultScoreCp !== null &&
                                  exam.resultMaxCp !== null
                                    ? t("exams.scoreSuffix", {
                                        score: cpToValue(exam.resultScoreCp),
                                        max: cpToValue(exam.resultMaxCp),
                                      })
                                    : ""}
                                </span>
                                {topics.length > 0 ? (
                                  links[exam.id] === undefined ? (
                                    <span className="quiet">
                                      {t("common.loading")}
                                    </span>
                                  ) : (
                                    <div className="tag-list">
                                      {topics.map((topic) => (
                                        <label
                                          key={topic.id}
                                          className="tag-chip"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={(
                                              links[exam.id] ?? []
                                            ).includes(topic.id)}
                                            onChange={(event) =>
                                              void toggleLink(
                                                exam.id,
                                                topic.id,
                                                event.target.checked,
                                              )
                                            }
                                          />
                                          <span>{topic.name}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )
                                ) : null}
                              </div>
                              {exam.resultStatus !== "pending" ? (
                                <span className="item-badge">
                                  {t(`exams.status.${exam.resultStatus}`)}
                                </span>
                              ) : null}
                              <div className="task-board-head">
                                <button
                                  type="button"
                                  className="mini-action"
                                  onClick={() =>
                                    setExamForm(formFromExam(exam))
                                  }
                                >
                                  {t("common.edit")}
                                </button>
                                <button
                                  type="button"
                                  className="mini-action danger"
                                  aria-label={t("exams.deleteExamAria", {
                                    title: exam.title,
                                  })}
                                  onClick={() => void handleDeleteExam(exam)}
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {visibleExams.length < exams.length ? (
                          <div className="form-actions">
                            <button
                              type="button"
                              className="button tonal"
                              onClick={() =>
                                setVisibleCount((count) => count + pageSize)
                              }
                            >
                              {t("exams.loadMore")}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </section>
                ),
              },
              {
                id: "form",
                label: examForm.id ? t("exams.editExam") : t("exams.newExam"),
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="exam-form-title"
                  >
                    <div className="task-board-head">
                      <h2 id="exam-form-title">
                        {examForm.id ? t("exams.editExam") : t("exams.newExam")}
                      </h2>
                    </div>
                    <form onSubmit={submitExam}>
                      <div className="inline-form">
                        <label className="field">
                          <span>{t("common.title")}</span>
                          <input
                            className="text-field"
                            value={examForm.title}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                title: event.target.value,
                              })
                            }
                            required
                          />
                        </label>
                        <DateField
                          label={t("common.date")}
                          value={examForm.date}
                          onChange={(date) =>
                            setExamForm({ ...examForm, date })
                          }
                          required
                        />
                        <label className="field narrow">
                          <span>{t("common.start")}</span>
                          <input
                            className="text-field"
                            type="time"
                            value={examForm.startTime}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                startTime: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field narrow">
                          <span>{t("common.end")}</span>
                          <input
                            className="text-field"
                            type="time"
                            value={examForm.endTime}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                endTime: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>{t("common.room")}</span>
                          <input
                            className="text-field"
                            value={examForm.room}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                room: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field narrow">
                          <span>{t("exams.weight")}</span>
                          <input
                            className="text-field"
                            type="number"
                            step="0.01"
                            value={examForm.weight}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                weight: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="inline-form">
                        <label className="field narrow">
                          <span>{t("exams.score")}</span>
                          <input
                            className="text-field"
                            type="number"
                            step="0.01"
                            value={examForm.resultScore}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                resultScore: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field narrow">
                          <span>{t("exams.max")}</span>
                          <input
                            className="text-field"
                            type="number"
                            step="0.01"
                            value={examForm.resultMax}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                resultMax: event.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="field">
                          <span>{t("exams.result")}</span>
                          <CustomSelect
                            ariaLabel={t("exams.result")}
                            className="select-field"
                            value={examForm.resultStatus}
                            onChange={(value) =>
                              setExamForm({
                                ...examForm,
                                resultStatus: value as ExamResultStatus,
                              })
                            }
                            options={resultStatuses.map((value) => ({
                              value,
                              label: t(`exams.status.${value}`),
                            }))}
                          />
                        </div>
                        <label className="field">
                          <span>{t("common.notes")}</span>
                          <input
                            className="text-field"
                            value={examForm.notes}
                            onChange={(event) =>
                              setExamForm({
                                ...examForm,
                                notes: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="form-actions">
                        {examForm.id ? (
                          <button
                            type="button"
                            className="button"
                            onClick={() => setExamForm(emptyExam)}
                          >
                            {t("common.cancel")}
                          </button>
                        ) : null}
                        <button
                          type="submit"
                          className="button filled"
                          disabled={
                            examForm.title.trim().length === 0 || !examForm.date
                          }
                        >
                          {examForm.id
                            ? t("exams.saveChanges")
                            : t("exams.createExam")}
                        </button>
                      </div>
                    </form>
                  </section>
                ),
              },
              {
                id: "topics",
                label: t("exams.topics"),
                badge: topics.length,
                content: (
                  <section
                    className="academic-panel"
                    aria-labelledby="topics-title"
                  >
                    <div className="task-board-head">
                      <h2 id="topics-title">{t("exams.topics")}</h2>
                      <span className="count-chip">{topics.length}</span>
                    </div>
                    <ul className="mini-list">
                      {topics.map((topic) => (
                        <li key={topic.id} className="mini-item">
                          <div className="mini-item-body">
                            <strong>{topic.name}</strong>
                            {topic.parentTopicId ? (
                              <span className="quiet mini-item-meta">
                                {t("exams.subtopicOf", {
                                  name:
                                    topics.find(
                                      (item) => item.id === topic.parentTopicId,
                                    )?.name ?? t("exams.anotherTopic"),
                                })}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="mini-action danger"
                            aria-label={t("exams.deleteTopicAria", {
                              name: topic.name,
                            })}
                            onClick={() => void handleDeleteTopic(topic)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <form className="inline-form" onSubmit={submitTopic}>
                      <label className="field">
                        <span>{t("common.name")}</span>
                        <input
                          className="text-field"
                          value={topicForm.name}
                          onChange={(event) =>
                            setTopicForm({
                              ...topicForm,
                              name: event.target.value,
                            })
                          }
                          required
                        />
                      </label>
                      <div className="field">
                        <span>{t("exams.parent")}</span>
                        <CustomSelect
                          ariaLabel={t("exams.parent")}
                          className="select-field"
                          value={topicForm.parentTopicId}
                          onChange={(value) =>
                            setTopicForm({ ...topicForm, parentTopicId: value })
                          }
                          options={[
                            { value: "", label: t("common.noParent") },
                            ...topics.map((topic) => ({
                              value: topic.id,
                              label: topic.name,
                            })),
                          ]}
                        />
                      </div>
                      <label className="field">
                        <span>{t("common.description")}</span>
                        <input
                          className="text-field"
                          value={topicForm.description}
                          onChange={(event) =>
                            setTopicForm({
                              ...topicForm,
                              description: event.target.value,
                            })
                          }
                        />
                      </label>
                      <button
                        type="submit"
                        className="button tonal"
                        disabled={topicForm.name.trim().length === 0}
                      >
                        {t("exams.createTopic")}
                      </button>
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
