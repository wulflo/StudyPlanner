import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { DateField } from "../components/DateField";
import { Tabs } from "../components/Tabs";
import { safeColor } from "../lib/color";
import { useTranslation } from "../lib/i18n";
import {
  type AcademicYear,
  createAcademicYear,
  createStudyCycle,
  createStudyPlanSubject,
  createSubject,
  createTerm,
  createTopic,
  deleteAcademicYear,
  deleteStudyCycle,
  deleteStudyPlanSubject,
  deleteSubject,
  deleteTerm,
  deleteTopic,
  listAcademicYears,
  listStudyCycles,
  listStudyPlanSubjects,
  listSubjects,
  listTerms,
  listTopicStudies,
  reviewTopic,
  type StudyCycle,
  type StudyCycleInput,
  type StudyPlanSubject,
  type StudyPlanSubjectInput,
  type Subject,
  type SubjectInput,
  setStudyPlanSubjectApproved,
  type Term,
  type TermInput,
  type TermKind,
  type TopicStudy,
  updateAcademicYear,
  updateStudyCycle,
  updateStudyPlanSubject,
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

const emptyCycleForm = {
  id: null as string | null,
  name: "",
  position: "0",
};

const emptyPlanSubjectForm = {
  id: null as string | null,
  cycleId: "",
  name: "",
  code: "",
  approved: false,
  position: "0",
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

type StudyRange = "week" | "month" | "all";

const STUDY_PAGE_SIZE = 25;

function studyRangeBounds(range: StudyRange): {
  from: string | null;
  to: string | null;
} {
  if (range === "all") {
    return { from: null, to: null };
  }
  const today = new Date();
  const bounds =
    range === "week"
      ? {
          start: startOfWeek(today, { weekStartsOn: 1 }),
          end: endOfWeek(today, { weekStartsOn: 1 }),
        }
      : { start: startOfMonth(today), end: endOfMonth(today) };
  return {
    from: format(bounds.start, "yyyy-MM-dd"),
    to: format(bounds.end, "yyyy-MM-dd"),
  };
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

function positionFromForm(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function cycleInputFromForm(form: typeof emptyCycleForm): StudyCycleInput {
  return {
    name: form.name,
    position: positionFromForm(form.position),
  };
}

function planSubjectInputFromForm(
  form: typeof emptyPlanSubjectForm,
): StudyPlanSubjectInput {
  return {
    name: form.name,
    code: optionalText(form.code),
    approved: form.approved,
    position: positionFromForm(form.position),
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
  const [cycles, setCycles] = useState<StudyCycle[]>([]);
  const [planSubjects, setPlanSubjects] = useState<StudyPlanSubject[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [yearForm, setYearForm] = useState(emptyYearForm);
  const [termForm, setTermForm] = useState(emptyTermForm);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [cycleForm, setCycleForm] = useState(emptyCycleForm);
  const [planSubjectForm, setPlanSubjectForm] = useState(emptyPlanSubjectForm);
  const [addingCycleId, setAddingCycleId] = useState<string | null>(null);
  const [newPlanSubjectName, setNewPlanSubjectName] = useState("");
  const [newPlanSubjectCode, setNewPlanSubjectCode] = useState("");
  const [studySubjectId, setStudySubjectId] = useState("all");
  const [newTopicSubjectId, setNewTopicSubjectId] = useState("");
  const [studies, setStudies] = useState<TopicStudy[]>([]);
  const [studyLoading, setStudyLoading] = useState(false);
  const [topicForm, setTopicForm] = useState({ name: "", description: "" });
  const [reviewDate, setReviewDate] = useState(todayIso);
  const [reviewQuality, setReviewQuality] = useState("4");
  const [studyRange, setStudyRange] = useState<StudyRange>("week");
  const [studyLimit, setStudyLimit] = useState(STUDY_PAGE_SIZE);
  const studyRequest = useRef(0);

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
        const [loadedCycles, loadedPlanSubjects] = await Promise.all([
          listStudyCycles(),
          listStudyPlanSubjects(null),
        ]);
        if (!cancelled) {
          setSubjects(loadedSubjects);
          setCycles(loadedCycles);
          setPlanSubjects(loadedPlanSubjects);
          setPlanSubjectForm((current) =>
            current.cycleId || loadedCycles.length === 0
              ? current
              : { ...current, cycleId: loadedCycles[0].id },
          );
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

  useEffect(() => {
    setStudySubjectId((current) =>
      current === "all" || subjects.some((subject) => subject.id === current)
        ? current
        : "all",
    );
    setNewTopicSubjectId((current) =>
      subjects.some((subject) => subject.id === current)
        ? current
        : (subjects[0]?.id ?? ""),
    );
  }, [subjects]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (subjects.length === 0) {
      setStudies([]);
      setStudyLoading(false);
      return;
    }

    const request = ++studyRequest.current;
    let cancelled = false;
    setStudyLoading(true);
    setStudyLimit(STUDY_PAGE_SIZE);

    async function loadStudies() {
      try {
        const bounds = studyRangeBounds(studyRange);
        const loaded = await listTopicStudies(
          studySubjectId === "all" ? null : studySubjectId,
          todayIso(),
          bounds.from,
          bounds.to,
        );
        if (!cancelled && request === studyRequest.current) {
          setStudies(loaded);
        }
      } catch (reason) {
        if (!cancelled && request === studyRequest.current) {
          setError(messageOf(reason));
        }
      } finally {
        if (!cancelled && request === studyRequest.current) {
          setStudyLoading(false);
        }
      }
    }

    void loadStudies();

    return () => {
      cancelled = true;
    };
  }, [ready, studySubjectId, studyRange, subjects.length]);

  async function refreshStudies() {
    if (!ready || subjects.length === 0) {
      setStudies([]);
      return;
    }
    const bounds = studyRangeBounds(studyRange);
    setStudies(
      await listTopicStudies(
        studySubjectId === "all" ? null : studySubjectId,
        todayIso(),
        bounds.from,
        bounds.to,
      ),
    );
  }

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

    const [loadedCycles, loadedPlanSubjects] = await Promise.all([
      listStudyCycles(),
      listStudyPlanSubjects(null),
    ]);
    setCycles(loadedCycles);
    setPlanSubjects(loadedPlanSubjects);
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
      // El año podía contener el término o la materia que se estaba editando.
      setYearForm(emptyYearForm);
      setTermForm(emptyTermForm);
      setSubjectForm(emptySubjectForm);
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
      // Las materias del término desaparecen con él.
      setSubjectForm(emptySubjectForm);
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

  async function submitStudyTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTopicSubjectId) {
      setError(t("academic.chooseStudySubject"));
      return;
    }
    await run(async () => {
      await createTopic(newTopicSubjectId, {
        parentTopicId: null,
        name: topicForm.name,
        description: optionalText(topicForm.description),
        sortOrder: studies.filter(
          (topic) => topic.subjectId === newTopicSubjectId,
        ).length,
      });
      setTopicForm({ name: "", description: "" });
      setStudySubjectId(newTopicSubjectId);
      setStudyRange("all");
      setStudyLimit(STUDY_PAGE_SIZE);
      setStudies(
        await listTopicStudies(newTopicSubjectId, todayIso(), null, null),
      );
      setNotice(t("academic.studyTopicCreated"));
    });
  }

  async function removeStudyTopic(topic: TopicStudy) {
    await run(async () => {
      await deleteTopic(topic.topicId);
      await refreshStudies();
      setNotice(t("academic.studyTopicDeleted", { name: topic.name }));
    });
  }

  async function handleStudyReview(topic: TopicStudy) {
    await run(async () => {
      const item = await reviewTopic(
        topic.topicId,
        Number(reviewQuality),
        reviewDate || todayIso(),
      );
      await refreshStudies();
      setNotice(
        t("academic.studyReviewRegistered", {
          date: item.dueDate ?? t("academic.noReviewDate"),
        }),
      );
    });
  }

  async function submitCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const input = cycleInputFromForm(cycleForm);
      if (cycleForm.id) {
        await updateStudyCycle(cycleForm.id, input);
        setNotice(t("academic.cycleUpdated"));
      } else {
        const created = await createStudyCycle({
          ...input,
          position: cycles.length,
        });
        setNotice(t("academic.cycleCreated"));
        setPlanSubjectForm((current) =>
          current.cycleId ? current : { ...current, cycleId: created.id },
        );
      }
      setCycleForm(emptyCycleForm);
      await refresh(yearId, termId);
    });
  }

  async function removeCycle(cycle: StudyCycle) {
    await run(async () => {
      await deleteStudyCycle(cycle.id);
      setNotice(t("academic.cycleDeleted", { name: cycle.name }));
      if (cycleForm.id === cycle.id) {
        setCycleForm(emptyCycleForm);
      }
      if (planSubjectForm.cycleId === cycle.id) {
        setPlanSubjectForm(emptyPlanSubjectForm);
      }
      await refresh(yearId, termId);
    });
  }

  async function submitPlanSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planSubjectForm.cycleId) {
      setError(t("academic.requiredCycle"));
      return;
    }
    await run(async () => {
      if (planSubjectForm.id) {
        await updateStudyPlanSubject(
          planSubjectForm.id,
          planSubjectInputFromForm(planSubjectForm),
        );
        setNotice(t("academic.planSubjectUpdated"));
      } else {
        await createStudyPlanSubject(
          planSubjectForm.cycleId,
          planSubjectInputFromForm(planSubjectForm),
        );
        setNotice(t("academic.planSubjectCreated"));
      }
      setPlanSubjectForm({
        ...emptyPlanSubjectForm,
        cycleId: planSubjectForm.cycleId,
      });
      await refresh(yearId, termId);
    });
  }

  async function removePlanSubject(subject: StudyPlanSubject) {
    await run(async () => {
      await deleteStudyPlanSubject(subject.id);
      setNotice(t("academic.planSubjectDeleted", { name: subject.name }));
      if (planSubjectForm.id === subject.id) {
        setPlanSubjectForm({
          ...emptyPlanSubjectForm,
          cycleId: subject.cycleId,
        });
      }
      await refresh(yearId, termId);
    });
  }

  async function togglePlanSubject(
    subject: StudyPlanSubject,
    approved: boolean,
  ) {
    await run(async () => {
      await setStudyPlanSubjectApproved(subject.id, approved);
      await refresh(yearId, termId);
    });
  }

  async function addPlanSubjectInline(
    event: FormEvent<HTMLFormElement>,
    cycle: StudyCycle,
  ) {
    event.preventDefault();
    const name = newPlanSubjectName.trim();
    if (name.length === 0) {
      return;
    }
    await run(async () => {
      await createStudyPlanSubject(cycle.id, {
        name,
        code: optionalText(newPlanSubjectCode),
        approved: false,
        position: planSubjects.filter((subject) => subject.cycleId === cycle.id)
          .length,
      });
      setNotice(t("academic.planSubjectCreated"));
      setNewPlanSubjectName("");
      setNewPlanSubjectCode("");
      setAddingCycleId(null);
      await refresh(yearId, termId);
    });
  }

  async function moveCycle(cycle: StudyCycle, direction: -1 | 1) {
    const ordered = [...cycles].sort(
      (left, right) =>
        left.position - right.position || left.name.localeCompare(right.name),
    );
    const index = ordered.findIndex((item) => item.id === cycle.id);
    const target = ordered[index + direction];
    if (!target) {
      return;
    }
    await run(async () => {
      await updateStudyCycle(cycle.id, {
        name: cycle.name,
        position: target.position,
      });
      await updateStudyCycle(target.id, {
        name: target.name,
        position: cycle.position,
      });
      await refresh(yearId, termId);
    });
  }

  async function movePlanSubject(subject: StudyPlanSubject, direction: -1 | 1) {
    const siblings = planSubjects
      .filter((item) => item.cycleId === subject.cycleId)
      .sort(
        (left, right) =>
          left.position - right.position || left.name.localeCompare(right.name),
      );
    const index = siblings.findIndex((item) => item.id === subject.id);
    const target = siblings[index + direction];
    if (!target) {
      return;
    }
    await run(async () => {
      await updateStudyPlanSubject(subject.id, {
        name: subject.name,
        code: subject.code,
        approved: subject.approved,
        position: target.position,
      });
      await updateStudyPlanSubject(target.id, {
        name: target.name,
        code: target.code,
        approved: target.approved,
        position: subject.position,
      });
      await refresh(yearId, termId);
    });
  }

  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects],
  );
  const sortedStudies = useMemo(() => {
    const scheduledDate = (topic: TopicStudy) =>
      topic.reviewItem?.dueDate ?? topic.nextExamDate ?? "9999-12-31";
    return [...studies].sort(
      (left, right) =>
        scheduledDate(left).localeCompare(scheduledDate(right)) ||
        left.name.localeCompare(right.name),
    );
  }, [studies]);

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
          <div className="hero-actions">
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.goToVault")}
            </button>
          </div>
        </section>
      </>
    );
  }

  const approvedTotal = planSubjects.filter(
    (subject) => subject.approved,
  ).length;
  const overallPercent =
    planSubjects.length === 0
      ? 0
      : Math.round((approvedTotal / planSubjects.length) * 100);
  const visibleStudies = sortedStudies.slice(0, studyLimit);
  const hasMoreStudies = sortedStudies.length > visibleStudies.length;

  function planSubjectsOf(cycleId: string): StudyPlanSubject[] {
    return planSubjects
      .filter((subject) => subject.cycleId === cycleId)
      .sort(
        (left, right) =>
          left.position - right.position || left.name.localeCompare(right.name),
      );
  }

  const orderedCycles = [...cycles].sort(
    (left, right) =>
      left.position - right.position || left.name.localeCompare(right.name),
  );

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

      <Tabs
        label={t("academic.sectionsAria")}
        initialId="subjects"
        items={[
          {
            id: "structure",
            label: t("academic.structureTab"),
            content: (
              <div className="academic-grid">
                <section
                  className="academic-panel"
                  aria-labelledby="years-title"
                >
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
                    <DateField
                      label={t("common.start")}
                      value={yearForm.startDate}
                      onChange={(startDate) =>
                        setYearForm({ ...yearForm, startDate })
                      }
                      required
                    />
                    <DateField
                      label={t("common.end")}
                      value={yearForm.endDate}
                      onChange={(endDate) =>
                        setYearForm({ ...yearForm, endDate })
                      }
                      required
                    />
                    <div className="form-actions">
                      <button
                        type="submit"
                        className="button filled"
                        disabled={busy}
                      >
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

                <section
                  className="academic-panel"
                  aria-labelledby="terms-title"
                >
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
                    <div className="field">
                      <span>{t("common.type")}</span>
                      <CustomSelect
                        ariaLabel={t("common.type")}
                        className="select-field"
                        value={termForm.kind}
                        onChange={(value) =>
                          setTermForm({ ...termForm, kind: value as TermKind })
                        }
                        options={Object.entries(termKindKeys).map(
                          ([value, labelKey]) => ({
                            value,
                            label: t(labelKey),
                          }),
                        )}
                      />
                    </div>
                    <DateField
                      label={t("common.start")}
                      value={termForm.startDate}
                      onChange={(startDate) =>
                        setTermForm({ ...termForm, startDate })
                      }
                      required
                    />
                    <DateField
                      label={t("common.end")}
                      value={termForm.endDate}
                      onChange={(endDate) =>
                        setTermForm({ ...termForm, endDate })
                      }
                      required
                    />
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
            ),
          },
          {
            id: "subjects",
            label: t("academic.subjectsTitle"),
            badge: subjects.length,
            content: (
              <section
                className="academic-panel"
                aria-labelledby="subjects-title"
              >
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
                                attendanceMin: bpToPercent(
                                  subject.attendanceMinBp,
                                ),
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

                <form
                  className="inline-form subject-form"
                  onSubmit={submitSubject}
                >
                  <label className="field">
                    <span>{t("common.subject")}</span>
                    <input
                      className="text-field"
                      value={subjectForm.name}
                      onChange={(event) =>
                        setSubjectForm({
                          ...subjectForm,
                          name: event.target.value,
                        })
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
                        setSubjectForm({
                          ...subjectForm,
                          code: event.target.value,
                        })
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
                        setSubjectForm({
                          ...subjectForm,
                          teacher: event.target.value,
                        })
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
                        setSubjectForm({
                          ...subjectForm,
                          room: event.target.value,
                        })
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
                        setSubjectForm({
                          ...subjectForm,
                          credits: event.target.value,
                        })
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
                        setSubjectForm({
                          ...subjectForm,
                          color: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="button filled"
                      disabled={busy}
                    >
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
            ),
          },
          {
            id: "topics",
            label: t("academic.studyTopicsTitle"),
            badge: studies.length,
            content: (
              <section
                className="academic-panel"
                aria-labelledby="study-topics-title"
              >
                <div className="task-board-head">
                  <h2 id="study-topics-title">
                    {t("academic.studyTopicsTitle")}
                  </h2>
                  <span className="count-chip">{studies.length}</span>
                </div>
                <p className="quiet">{t("academic.studyTopicsCopy")}</p>

                {subjects.length === 0 ? (
                  <p className="empty-state">{t("academic.chooseTerm")}</p>
                ) : (
                  <>
                    <div className="study-filters">
                      <div className="field">
                        <span>{t("academic.studySubject")}</span>
                        <CustomSelect
                          ariaLabel={t("academic.studySubject")}
                          className="select-field"
                          value={studySubjectId}
                          onChange={setStudySubjectId}
                          options={[
                            { value: "all", label: t("academic.allSubjects") },
                            ...subjects.map((subject) => ({
                              value: subject.id,
                              label: subject.name,
                            })),
                          ]}
                        />
                      </div>
                      <fieldset
                        className="study-range"
                        aria-label={t("academic.studyRangeAria")}
                      >
                        {(["week", "month", "all"] as const).map((range) => (
                          <button
                            key={range}
                            type="button"
                            className={`chip-toggle${
                              studyRange === range ? " is-active" : ""
                            }`}
                            aria-pressed={studyRange === range}
                            onClick={() => setStudyRange(range)}
                          >
                            {t(`academic.studyRange.${range}`)}
                          </button>
                        ))}
                      </fieldset>
                    </div>

                    <div className="inline-form">
                      <div className="field narrow">
                        <span>{t("academic.reviewQuality")}</span>
                        <CustomSelect
                          ariaLabel={t("academic.reviewQuality")}
                          className="select-field"
                          value={reviewQuality}
                          onChange={setReviewQuality}
                          options={[1, 2, 3, 4, 5].map((value) => ({
                            value: String(value),
                            label: String(value),
                          }))}
                        />
                      </div>
                      <DateField
                        label={t("academic.reviewDate")}
                        value={reviewDate}
                        onChange={setReviewDate}
                      />
                    </div>

                    {studyLoading ? (
                      <p className="quiet" role="status">
                        {t("common.loading")}
                      </p>
                    ) : visibleStudies.length === 0 ? (
                      <p className="empty-state">
                        {studyRange === "all"
                          ? t("academic.noStudyTopics")
                          : t("academic.noStudyTopicsRange")}
                      </p>
                    ) : (
                      <>
                        <ul className="mini-list">
                          {visibleStudies.map((topic) => (
                            <li
                              key={topic.topicId}
                              className="mini-item has-badge"
                            >
                              <div className="mini-item-body">
                                <div className="mini-item-heading">
                                  <strong>{topic.name}</strong>
                                </div>
                                <span className="quiet mini-item-meta">
                                  {t("academic.lastReview")}:{" "}
                                  {topic.reviewItem?.lastReviewedAt
                                    ? topic.reviewItem.lastReviewedAt.slice(
                                        0,
                                        10,
                                      )
                                    : t("academic.neverReviewed")}{" "}
                                  · {t("academic.nextReview")}:{" "}
                                  {topic.reviewItem?.dueDate ??
                                    t("academic.noReviewDate")}
                                  {topic.nextExamDate
                                    ? ` · ${t("academic.nextExam")}: ${topic.nextExamDate}`
                                    : ""}
                                </span>
                              </div>
                              {studySubjectId === "all" ? (
                                <span className="item-badge">
                                  {subjectNameById.get(topic.subjectId) ??
                                    t("common.noSubject")}
                                </span>
                              ) : null}
                              <div className="task-board-head">
                                <button
                                  type="button"
                                  className="mini-action"
                                  disabled={busy}
                                  onClick={() => void handleStudyReview(topic)}
                                >
                                  {t("academic.markReview")}
                                </button>
                                <button
                                  type="button"
                                  className="mini-action danger"
                                  disabled={busy}
                                  aria-label={t(
                                    "academic.deleteStudyTopicAria",
                                    {
                                      name: topic.name,
                                    },
                                  )}
                                  onClick={() => void removeStudyTopic(topic)}
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {hasMoreStudies ? (
                          <button
                            type="button"
                            className="button tonal"
                            onClick={() =>
                              setStudyLimit(
                                (current) => current + STUDY_PAGE_SIZE,
                              )
                            }
                          >
                            {t("academic.showMoreTopics", {
                              shown: visibleStudies.length,
                              total: sortedStudies.length,
                            })}
                          </button>
                        ) : null}
                      </>
                    )}

                    <form className="inline-form" onSubmit={submitStudyTopic}>
                      <div className="field">
                        <span>{t("academic.topicSubject")}</span>
                        <CustomSelect
                          ariaLabel={t("academic.topicSubject")}
                          className="select-field"
                          value={newTopicSubjectId}
                          onChange={setNewTopicSubjectId}
                          options={subjects.map((subject) => ({
                            value: subject.id,
                            label: subject.name,
                          }))}
                        />
                      </div>
                      <label className="field">
                        <span>{t("academic.studyTopicName")}</span>
                        <input
                          className="text-field"
                          value={topicForm.name}
                          onChange={(event) =>
                            setTopicForm({
                              ...topicForm,
                              name: event.target.value,
                            })
                          }
                          placeholder={t("academic.studyTopicNamePlaceholder")}
                          maxLength={160}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>{t("academic.studyTopicDescription")}</span>
                        <input
                          className="text-field"
                          value={topicForm.description}
                          onChange={(event) =>
                            setTopicForm({
                              ...topicForm,
                              description: event.target.value,
                            })
                          }
                          maxLength={400}
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="button tonal"
                          disabled={busy || topicForm.name.trim().length === 0}
                        >
                          {t("academic.addStudyTopic")}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </section>
            ),
          },
          {
            id: "plan",
            label: t("academic.studyPlanTitle"),
            badge: cycles.length,
            content: (
              <section
                className="academic-panel study-plan-panel"
                aria-labelledby="study-plan-title"
              >
                <div className="task-board-head">
                  <h2 id="study-plan-title">{t("academic.studyPlanTitle")}</h2>
                  <span className="count-chip">{cycles.length}</span>
                </div>
                <p className="quiet">{t("academic.studyPlanCopy")}</p>

                {planSubjects.length > 0 ? (
                  <div className="study-plan-summary">
                    <div className="study-plan-summary-head">
                      <span>
                        {t("academic.overallProgress", {
                          approved: approvedTotal,
                          total: planSubjects.length,
                        })}
                      </span>
                      <span className="quiet">{overallPercent}%</span>
                    </div>
                    <div
                      className="cycle-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={overallPercent}
                      aria-label={t("academic.overallProgress", {
                        approved: approvedTotal,
                        total: planSubjects.length,
                      })}
                    >
                      <span style={{ width: `${overallPercent}%` }} />
                    </div>
                  </div>
                ) : null}

                {cycles.length === 0 ? (
                  <p className="empty-state">{t("academic.noCycles")}</p>
                ) : (
                  <div className="study-plan-cycles">
                    {orderedCycles.map((cycle, cycleIndex) => {
                      const cycleSubjects = planSubjectsOf(cycle.id);
                      const approved = cycleSubjects.filter(
                        (subject) => subject.approved,
                      ).length;
                      const percent =
                        cycleSubjects.length === 0
                          ? 0
                          : Math.round((approved / cycleSubjects.length) * 100);
                      return (
                        <section
                          className="study-cycle"
                          key={cycle.id}
                          aria-labelledby={`cycle-${cycle.id}`}
                        >
                          <header className="study-cycle-head">
                            <div className="study-cycle-title">
                              <h3 id={`cycle-${cycle.id}`}>{cycle.name}</h3>
                              <span className="quiet">
                                {t("academic.cycleProgress", {
                                  approved,
                                  total: cycleSubjects.length,
                                })}
                              </span>
                            </div>
                            <span className="count-chip">
                              {approved}/{cycleSubjects.length}
                            </span>
                            <div className="subject-actions">
                              <button
                                type="button"
                                className="mini-action"
                                onClick={() => void moveCycle(cycle, -1)}
                                disabled={busy || cycleIndex === 0}
                                aria-label={t("academic.moveCycleUpAria", {
                                  name: cycle.name,
                                })}
                                title={t("academic.moveUp")}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="mini-action"
                                onClick={() => void moveCycle(cycle, 1)}
                                disabled={
                                  busy ||
                                  cycleIndex === orderedCycles.length - 1
                                }
                                aria-label={t("academic.moveCycleDownAria", {
                                  name: cycle.name,
                                })}
                                title={t("academic.moveDown")}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="mini-action"
                                onClick={() =>
                                  setCycleForm({
                                    id: cycle.id,
                                    name: cycle.name,
                                    position: String(cycle.position),
                                  })
                                }
                              >
                                {t("common.edit")}
                              </button>
                              <button
                                type="button"
                                className="mini-action danger"
                                onClick={() => void removeCycle(cycle)}
                                disabled={busy}
                                aria-label={t("academic.deleteCycleAria", {
                                  name: cycle.name,
                                })}
                              >
                                ×
                              </button>
                            </div>
                          </header>
                          <div
                            className="cycle-progress"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            aria-label={t("academic.cycleProgress", {
                              approved,
                              total: cycleSubjects.length,
                            })}
                          >
                            <span style={{ width: `${percent}%` }} />
                          </div>

                          {cycleSubjects.length === 0 ? (
                            <p className="empty-state">
                              {t("academic.cycleNoSubjects")}
                            </p>
                          ) : (
                            <ul className="cycle-subjects">
                              {cycleSubjects.map((subject, subjectIndex) => (
                                <li
                                  className={`cycle-subject${
                                    subject.approved ? " is-approved" : ""
                                  }`}
                                  key={subject.id}
                                >
                                  {planSubjectForm.id === subject.id ? (
                                    <form
                                      className="cycle-subject-edit"
                                      onSubmit={submitPlanSubject}
                                    >
                                      <label className="field">
                                        <span>
                                          {t("academic.planSubjectLabel")}
                                        </span>
                                        <input
                                          className="text-field"
                                          value={planSubjectForm.name}
                                          onChange={(event) =>
                                            setPlanSubjectForm({
                                              ...planSubjectForm,
                                              name: event.target.value,
                                            })
                                          }
                                          placeholder={t(
                                            "academic.subjectNamePlaceholder",
                                          )}
                                          maxLength={120}
                                          required
                                        />
                                      </label>
                                      <label className="field">
                                        <span>{t("academic.code")}</span>
                                        <input
                                          className="text-field"
                                          value={planSubjectForm.code}
                                          onChange={(event) =>
                                            setPlanSubjectForm({
                                              ...planSubjectForm,
                                              code: event.target.value,
                                            })
                                          }
                                          maxLength={40}
                                        />
                                      </label>
                                      <div className="form-actions">
                                        <button
                                          type="submit"
                                          className="button filled"
                                          disabled={busy}
                                        >
                                          {busy
                                            ? t("common.saving")
                                            : t("academic.savePlanSubject")}
                                        </button>
                                        <button
                                          type="button"
                                          className="button"
                                          onClick={() =>
                                            setPlanSubjectForm({
                                              ...emptyPlanSubjectForm,
                                              cycleId: planSubjectForm.cycleId,
                                            })
                                          }
                                        >
                                          {t("common.cancel")}
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <>
                                      <label className="cycle-subject-check">
                                        <input
                                          type="checkbox"
                                          checked={subject.approved}
                                          onChange={(event) =>
                                            void togglePlanSubject(
                                              subject,
                                              event.target.checked,
                                            )
                                          }
                                          aria-label={t(
                                            "academic.approveSubjectAria",
                                            {
                                              name: subject.name,
                                            },
                                          )}
                                        />
                                        <span className="cycle-subject-name">
                                          {subject.name}
                                        </span>
                                        {subject.code ? (
                                          <span className="quiet">
                                            {subject.code}
                                          </span>
                                        ) : null}
                                      </label>
                                      <div className="subject-actions">
                                        <button
                                          type="button"
                                          className="mini-action"
                                          onClick={() =>
                                            void movePlanSubject(subject, -1)
                                          }
                                          disabled={busy || subjectIndex === 0}
                                          aria-label={t(
                                            "academic.movePlanSubjectUpAria",
                                            { name: subject.name },
                                          )}
                                          title={t("academic.moveUp")}
                                        >
                                          ↑
                                        </button>
                                        <button
                                          type="button"
                                          className="mini-action"
                                          onClick={() =>
                                            void movePlanSubject(subject, 1)
                                          }
                                          disabled={
                                            busy ||
                                            subjectIndex ===
                                              cycleSubjects.length - 1
                                          }
                                          aria-label={t(
                                            "academic.movePlanSubjectDownAria",
                                            { name: subject.name },
                                          )}
                                          title={t("academic.moveDown")}
                                        >
                                          ↓
                                        </button>
                                        <button
                                          type="button"
                                          className="mini-action"
                                          onClick={() =>
                                            setPlanSubjectForm({
                                              id: subject.id,
                                              cycleId: subject.cycleId,
                                              name: subject.name,
                                              code: subject.code ?? "",
                                              approved: subject.approved,
                                              position: String(
                                                subject.position,
                                              ),
                                            })
                                          }
                                        >
                                          {t("common.edit")}
                                        </button>
                                        <button
                                          type="button"
                                          className="mini-action danger"
                                          onClick={() =>
                                            void removePlanSubject(subject)
                                          }
                                          disabled={busy}
                                          aria-label={t(
                                            "academic.deletePlanSubjectAria",
                                            { name: subject.name },
                                          )}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {addingCycleId === cycle.id ? (
                            <form
                              className="cycle-add-form"
                              onSubmit={(event) =>
                                void addPlanSubjectInline(event, cycle)
                              }
                            >
                              <label className="field">
                                <span>{t("academic.planSubjectLabel")}</span>
                                <input
                                  className="text-field"
                                  value={newPlanSubjectName}
                                  onChange={(event) =>
                                    setNewPlanSubjectName(event.target.value)
                                  }
                                  placeholder={t(
                                    "academic.addSubjectPlaceholder",
                                  )}
                                  maxLength={120}
                                  required
                                />
                              </label>
                              <label className="field narrow">
                                <span>{t("academic.code")}</span>
                                <input
                                  className="text-field"
                                  value={newPlanSubjectCode}
                                  onChange={(event) =>
                                    setNewPlanSubjectCode(event.target.value)
                                  }
                                  maxLength={40}
                                />
                              </label>
                              <div className="form-actions">
                                <button
                                  type="submit"
                                  className="button filled"
                                  disabled={busy}
                                >
                                  {busy
                                    ? t("common.saving")
                                    : t("academic.addPlanSubject")}
                                </button>
                                <button
                                  type="button"
                                  className="button"
                                  onClick={() => {
                                    setAddingCycleId(null);
                                    setNewPlanSubjectName("");
                                    setNewPlanSubjectCode("");
                                  }}
                                >
                                  {t("common.cancel")}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="mini-action cycle-add"
                              onClick={() => {
                                setAddingCycleId(cycle.id);
                                setNewPlanSubjectName("");
                                setNewPlanSubjectCode("");
                              }}
                            >
                              + {t("academic.addPlanSubject")}
                            </button>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}

                <form className="inline-form" onSubmit={submitCycle}>
                  <label className="field">
                    <span>{t("common.name")}</span>
                    <input
                      className="text-field"
                      value={cycleForm.name}
                      onChange={(event) =>
                        setCycleForm({ ...cycleForm, name: event.target.value })
                      }
                      placeholder={t("academic.cycleNamePlaceholder")}
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
                      {busy
                        ? t("common.saving")
                        : cycleForm.id
                          ? t("academic.saveCycle")
                          : t("academic.addCycle")}
                    </button>
                    {cycleForm.id ? (
                      <button
                        type="button"
                        className="button"
                        onClick={() => setCycleForm(emptyCycleForm)}
                      >
                        {t("common.cancel")}
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>
            ),
          },
        ]}
      />
    </>
  );
}
