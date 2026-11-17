import { type FormEvent, useEffect, useState } from "react";
import { safeColor } from "../lib/color";
import { useTranslation } from "../lib/i18n";
import {
  type AcademicYear,
  createAcademicYear,
  createSubject,
  createTerm,
  deleteAcademicYear,
  deleteSubject,
  deleteTerm,
  listAcademicYears,
  listSubjects,
  listTerms,
  type Subject,
  type SubjectInput,
  type Term,
  type TermInput,
  type TermKind,
  updateAcademicYear,
  updateSubject,
  updateTerm,
  type VaultStatus,
} from "../lib/ipc";

const termKindKeys: Record<TermKind, string> = {
  semester: "academic.kind.semester",
  trimester: "academic.kind.trimester",
  quarter: "academic.kind.quarter",
  bimonth: "academic.kind.bimonth",
  annual: "academic.kind.annual",
  other: "academic.kind.other",
};

const emptyYearForm = {
  id: null as string | null,
  name: "",
  startDate: `${new Date().getFullYear()}-03-01`,
  endDate: `${new Date().getFullYear()}-12-20`,
};

const emptyTermForm = {
  id: null as string | null,
  name: "",
  kind: "semester" as TermKind,
  startDate: "",
  endDate: "",
};

const emptySubjectForm = {
  id: null as string | null,
  name: "",
  code: "",
  color: "#6750A4",
  teacher: "",
  room: "",
  credits: "",
  attendanceMin: "",
};

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

function percentToBp(value: string): number | null {
  const parsed = optionalNumber(value);
  return parsed === null ? null : Math.round(parsed * 100);
}

function bpToPercent(value: number | null): string {
  return value === null ? "" : String(value / 100);
}

function subjectInputFromForm(form: typeof emptySubjectForm): SubjectInput {
  return {
    name: form.name,
    code: optionalText(form.code),
    color: form.color,
    teacher: optionalText(form.teacher),
    room: optionalText(form.room),
    credits: optionalNumber(form.credits),
    attendanceMinBp: percentToBp(form.attendanceMin),
  };
}

function termInputFromForm(form: typeof emptyTermForm): TermInput {
  return {
    name: form.name,
    kind: form.kind,
    startDate: form.startDate,
    endDate: form.endDate,
  };
}

export function AcademicView({
  vault,
  onGoVault,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [yearForm, setYearForm] = useState(emptyYearForm);
  const [termForm, setTermForm] = useState(emptyTermForm);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loadedYears = await listAcademicYears();
        if (cancelled) {
          return;
        }
        setYears(loadedYears);
        const nextYear = loadedYears[0]?.id ?? null;
        setYearId(nextYear);

        const loadedTerms = nextYear ? await listTerms(nextYear) : [];
        if (cancelled) {
          return;
        }
        setTerms(loadedTerms);
        const nextTerm = loadedTerms[0]?.id ?? null;
        setTermId(nextTerm);

        const loadedSubjects = nextTerm ? await listSubjects(nextTerm) : [];
        if (!cancelled) {
          setSubjects(loadedSubjects);
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
  }, [ready]);

  async function refresh(
    preferredYear: string | null = yearId,
    preferredTerm: string | null = termId,
  ) {
    const loadedYears = await listAcademicYears();
    setYears(loadedYears);
    const nextYear =
      loadedYears.find((year) => year.id === preferredYear)?.id ??
      loadedYears[0]?.id ??
      null;
    setYearId(nextYear);

    const loadedTerms = nextYear ? await listTerms(nextYear) : [];
    setTerms(loadedTerms);
    const nextTerm =
      loadedTerms.find((term) => term.id === preferredTerm)?.id ??
      loadedTerms[0]?.id ??
      null;
    setTermId(nextTerm);

    const loadedSubjects = nextTerm ? await listSubjects(nextTerm) : [];
    setSubjects(loadedSubjects);
  }

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

  async function selectYear(nextYearId: string) {
    setYearId(nextYearId);
    setTermId(null);
    setSubjects([]);
    setError(null);
    try {
      const loadedTerms = await listTerms(nextYearId);
      setTerms(loadedTerms);
      const nextTerm = loadedTerms[0]?.id ?? null;
      setTermId(nextTerm);
      setSubjects(nextTerm ? await listSubjects(nextTerm) : []);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function selectTerm(nextTermId: string) {
    setTermId(nextTermId);
    setError(null);
    try {
      setSubjects(await listSubjects(nextTermId));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function submitYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (yearForm.id) {
        await updateAcademicYear(
          yearForm.id,
          yearForm.name,
          yearForm.startDate,
          yearForm.endDate,
        );
        setNotice(t("academic.yearUpdated"));
      } else {
        const created = await createAcademicYear(
          yearForm.name,
          yearForm.startDate,
          yearForm.endDate,
        );
        setNotice(t("academic.yearCreated"));
        setYearForm(emptyYearForm);
        await refresh(created.id, null);
        return;
      }
      setYearForm(emptyYearForm);
      await refresh(yearId, null);
    });
  }

  async function submitTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!yearId) {
      setError(t("academic.requiredYear"));
      return;
    }
    await run(async () => {
      if (termForm.id) {
        await updateTerm(termForm.id, termInputFromForm(termForm));
        setNotice(t("academic.termUpdated"));
      } else {
        const created = await createTerm(yearId, termInputFromForm(termForm));
        setNotice(t("academic.termCreated"));
        setTermForm(emptyTermForm);
        await refresh(yearId, created.id);
        return;
      }
      setTermForm(emptyTermForm);
      await refresh(yearId, termId);
    });
  }

  async function submitSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termId) {
      setError(t("academic.requiredTerm"));
      return;
    }
    await run(async () => {
      if (subjectForm.id) {
        await updateSubject(subjectForm.id, subjectInputFromForm(subjectForm));
        setNotice(t("academic.subjectUpdated"));
      } else {
        await createSubject(termId, subjectInputFromForm(subjectForm));
        setNotice(t("academic.subjectCreated"));
      }
      setSubjectForm(emptySubjectForm);
      await refresh(yearId, termId);
    });
  }

  async function removeYear(year: AcademicYear) {
    await run(async () => {
      await deleteAcademicYear(year.id);
      setNotice(t("academic.yearDeleted", { name: year.name }));
      if (yearForm.id === year.id) {
        setYearForm(emptyYearForm);
      }
      await refresh(null, null);
    });
  }

  async function removeTerm(term: Term) {
    await run(async () => {
      await deleteTerm(term.id);
      setNotice(t("academic.termDeleted", { name: term.name }));
      if (termForm.id === term.id) {
        setTermForm(emptyTermForm);
      }
      await refresh(yearId, null);
    });
  }

  async function removeSubject(subject: Subject) {
    await run(async () => {
      await deleteSubject(subject.id);
      setNotice(t("academic.subjectDeleted", { name: subject.name }));
      if (subjectForm.id === subject.id) {
        setSubjectForm(emptySubjectForm);
      }
      await refresh(yearId, termId);
    });
  }

  if (!ready) {
    return (
      <>
        <section className="hero section-hero">
          <p className="eyebrow">{t("academic.eyebrow")}</p>
          <h1>{t("academic.title")}</h1>
          <p className="hero-copy">{t("academic.copyLocked")}</p>
        </section>
        <section className="next-card">
          <p className="eyebrow">{t("common.vaultRequired")}</p>
          <h2>{t("common.chooseVaultFirst")}</h2>
          <p>{vault?.message ?? t("academic.noVaultBody")}</p>
          <button type="button" className="button filled" onClick={onGoVault}>
            {t("common.goToVault")}
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("academic.eyebrow")}</p>
        <h1>{t("academic.title")}</h1>
        <p className="hero-copy">{t("academic.copyReady")}</p>
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

      {loading ? <p className="notice">{t("academic.loading")}</p> : null}

      <div className="academic-grid">
        <section className="academic-panel" aria-labelledby="years-title">
          <div className="task-board-head">
            <h2 id="years-title">{t("academic.yearsTitle")}</h2>
            <span className="count-chip">{years.length}</span>
          </div>
          {years.length === 0 ? (
            <p className="empty-state">{t("academic.noYears")}</p>
          ) : (
            <ul className="mini-list">
              {years.map((year) => (
                <li key={year.id}>
                  <button
                    type="button"
                    className={`mini-item${year.id === yearId ? " is-active" : ""}`}
                    onClick={() => void selectYear(year.id)}
                  >
                    <span>{year.name}</span>
                    <span className="quiet">
                      {year.startDate} → {year.endDate}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mini-action"
                    onClick={() => {
                      setYearForm({
                        id: year.id,
                        name: year.name,
                        startDate: year.startDate,
                        endDate: year.endDate,
                      });
                    }}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="mini-action danger"
                    onClick={() => void removeYear(year)}
                    disabled={busy}
                    aria-label={t("academic.deleteYearAria", {
                      name: year.name,
                    })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="inline-form" onSubmit={submitYear}>
            <label className="field">
              <span>{t("common.name")}</span>
              <input
                className="text-field"
                value={yearForm.name}
                onChange={(event) =>
                  setYearForm({ ...yearForm, name: event.target.value })
                }
                placeholder={t("academic.yearNamePlaceholder")}
                maxLength={120}
                required
              />
            </label>
            <label className="field">
              <span>{t("common.start")}</span>
              <input
                className="text-field"
                type="date"
                value={yearForm.startDate}
                onChange={(event) =>
                  setYearForm({ ...yearForm, startDate: event.target.value })
                }
                required
              />
            </label>
            <label className="field">
              <span>{t("common.end")}</span>
              <input
                className="text-field"
                type="date"
                value={yearForm.endDate}
                onChange={(event) =>
                  setYearForm({ ...yearForm, endDate: event.target.value })
                }
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="button filled" disabled={busy}>
                {busy
                  ? t("common.saving")
                  : yearForm.id
                    ? t("academic.saveYear")
                    : t("academic.addYear")}
              </button>
              {yearForm.id ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => setYearForm(emptyYearForm)}
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="academic-panel" aria-labelledby="terms-title">
          <div className="task-board-head">
            <h2 id="terms-title">{t("academic.termsTitle")}</h2>
            <span className="count-chip">{terms.length}</span>
          </div>
          {!yearId ? (
            <p className="empty-state">{t("academic.chooseYear")}</p>
          ) : terms.length === 0 ? (
            <p className="empty-state">{t("academic.yearNoTerms")}</p>
          ) : (
            <ul className="mini-list">
              {terms.map((term) => (
                <li key={term.id}>
                  <button
                    type="button"
                    className={`mini-item${term.id === termId ? " is-active" : ""}`}
                    onClick={() => void selectTerm(term.id)}
                  >
                    <span>{term.name}</span>
                    <span className="quiet">
                      {t(termKindKeys[term.kind])} · {term.startDate} →{" "}
                      {term.endDate}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mini-action"
                    onClick={() =>
                      setTermForm({
                        id: term.id,
                        name: term.name,
                        kind: term.kind,
                        startDate: term.startDate,
                        endDate: term.endDate,
                      })
                    }
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="mini-action danger"
                    onClick={() => void removeTerm(term)}
                    disabled={busy}
                    aria-label={t("academic.deleteTermAria", {
                      name: term.name,
                    })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="inline-form" onSubmit={submitTerm}>
            <label className="field">
              <span>{t("common.name")}</span>
              <input
                className="text-field"
                value={termForm.name}
                onChange={(event) =>
                  setTermForm({ ...termForm, name: event.target.value })
                }
                placeholder={t("academic.termNamePlaceholder")}
                maxLength={120}
                required
              />
            </label>
            <label className="field">
              <span>{t("common.type")}</span>
              <select
                className="select-field"
                value={termForm.kind}
                onChange={(event) =>
                  setTermForm({
                    ...termForm,
                    kind: event.target.value as TermKind,
                  })
                }
              >
                {Object.entries(termKindKeys).map(([value, labelKey]) => (
                  <option key={value} value={value}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("common.start")}</span>
              <input
                className="text-field"
                type="date"
                value={termForm.startDate}
                onChange={(event) =>
                  setTermForm({ ...termForm, startDate: event.target.value })
                }
                required
              />
            </label>
            <label className="field">
              <span>{t("common.end")}</span>
              <input
                className="text-field"
                type="date"
                value={termForm.endDate}
                onChange={(event) =>
                  setTermForm({ ...termForm, endDate: event.target.value })
                }
                required
              />
            </label>
            <div className="form-actions">
              <button
                type="submit"
                className="button filled"
                disabled={busy || !yearId}
              >
                {busy
                  ? t("common.saving")
                  : termForm.id
                    ? t("academic.saveTerm")
                    : t("academic.addTerm")}
              </button>
              {termForm.id ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => setTermForm(emptyTermForm)}
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>

      <section className="academic-panel" aria-labelledby="subjects-title">
        <div className="task-board-head">
          <h2 id="subjects-title">{t("academic.subjectsTitle")}</h2>
          <span className="count-chip">{subjects.length}</span>
        </div>
        {!termId ? (
          <p className="empty-state">{t("academic.chooseTerm")}</p>
        ) : subjects.length === 0 ? (
          <p className="empty-state">{t("academic.termNoSubjects")}</p>
        ) : (
          <ul className="subject-grid">
            {subjects.map((subject) => (
              <li className="subject-card" key={subject.id}>
                <span
                  className="subject-dot"
                  style={{ background: safeColor(subject.color) }}
                  aria-hidden="true"
                />
                <div>
                  <h3>{subject.name}</h3>
                  <p className="quiet">
                    {[
                      subject.code,
                      subject.teacher,
                      subject.room,
                      subject.credits === null
                        ? null
                        : t("academic.creditsValue", {
                            credits: subject.credits,
                          }),
                    ]
                      .filter(Boolean)
                      .join(" · ") || t("academic.noExtra")}
                  </p>
                  <p className="quiet">
                    {t("academic.attendanceLabel")}{" "}
                    {subject.attendanceMinBp === null
                      ? t("academic.noThreshold")
                      : `${bpToPercent(subject.attendanceMinBp)}%`}
                  </p>
                </div>
                <div className="subject-actions">
                  <button
                    type="button"
                    className="mini-action"
                    onClick={() =>
                      setSubjectForm({
                        id: subject.id,
                        name: subject.name,
                        code: subject.code ?? "",
                        color: safeColor(subject.color),
                        teacher: subject.teacher ?? "",
                        room: subject.room ?? "",
                        credits:
                          subject.credits === null
                            ? ""
                            : String(subject.credits),
                        attendanceMin: bpToPercent(subject.attendanceMinBp),
                      })
                    }
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="mini-action danger"
                    onClick={() => void removeSubject(subject)}
                    disabled={busy}
                    aria-label={t("academic.deleteSubjectAria", {
                      name: subject.name,
                    })}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form className="inline-form subject-form" onSubmit={submitSubject}>
          <label className="field">
            <span>{t("common.subject")}</span>
            <input
              className="text-field"
              value={subjectForm.name}
              onChange={(event) =>
                setSubjectForm({ ...subjectForm, name: event.target.value })
              }
              placeholder={t("academic.subjectNamePlaceholder")}
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span>{t("academic.code")}</span>
            <input
              className="text-field"
              value={subjectForm.code}
              onChange={(event) =>
                setSubjectForm({ ...subjectForm, code: event.target.value })
              }
              maxLength={40}
            />
          </label>
          <label className="field">
            <span>{t("academic.teacher")}</span>
            <input
              className="text-field"
              value={subjectForm.teacher}
              onChange={(event) =>
                setSubjectForm({ ...subjectForm, teacher: event.target.value })
              }
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>{t("common.room")}</span>
            <input
              className="text-field"
              value={subjectForm.room}
              onChange={(event) =>
                setSubjectForm({ ...subjectForm, room: event.target.value })
              }
              maxLength={120}
            />
          </label>
          <label className="field narrow">
            <span>{t("academic.credits")}</span>
            <input
              className="text-field"
              type="number"
              min={0}
              value={subjectForm.credits}
              onChange={(event) =>
                setSubjectForm({ ...subjectForm, credits: event.target.value })
              }
            />
          </label>
          <label className="field narrow">
            <span>{t("academic.attendanceMin")}</span>
            <input
              className="text-field"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={subjectForm.attendanceMin}
              onChange={(event) =>
                setSubjectForm({
                  ...subjectForm,
                  attendanceMin: event.target.value,
                })
              }
            />
          </label>
          <label className="field narrow">
            <span>{t("common.color")}</span>
            <input
              className="color-field"
              type="color"
              value={safeColor(subjectForm.color)}
              onChange={(event) =>
                setSubjectForm({ ...subjectForm, color: event.target.value })
              }
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="button filled" disabled={busy}>
              {busy
                ? t("common.saving")
                : subjectForm.id
                  ? t("academic.saveSubject")
                  : t("academic.addSubject")}
            </button>
            {subjectForm.id ? (
              <button
                type="button"
                className="button"
                onClick={() => setSubjectForm(emptySubjectForm)}
              >
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </>
  );
}
