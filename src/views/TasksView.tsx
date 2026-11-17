import { type FormEvent, useEffect, useMemo, useState } from "react";
import { intlLocale, useTranslation } from "../lib/i18n";
import {
  createSavedFilter,
  createTag,
  createTaskFull,
  deleteSavedFilter,
  deleteTag,
  listAcademicYears,
  listSavedFilters,
  listSubjects,
  listTags,
  listTasks,
  listTerms,
  listUndoEntries,
  type SavedFilter,
  type Subject,
  searchTasks,
  type Tag,
  type Task,
  type TaskFilter,
  type TaskInput,
  type TaskPriority,
  type TaskRecurrenceKind,
  type TaskStatus,
  type TaskType,
  type UndoEntry,
  undoEntry,
  updateTask,
  type VaultStatus,
} from "../lib/ipc";
import { parseTaskFilter } from "../lib/taskFilter";

const priorityLabels: Record<TaskPriority, string> = {
  low: "tasks.priorities.low",
  medium: "tasks.priorities.medium",
  high: "tasks.priorities.high",
  urgent: "tasks.priorities.urgent",
};

const typeLabels: Record<TaskType, string> = {
  task: "tasks.taskTypes.task",
  practical: "tasks.taskTypes.practical",
  project: "tasks.taskTypes.project",
  personal: "tasks.taskTypes.personal",
};

const recurrenceLabels: Record<TaskRecurrenceKind, string> = {
  daily: "tasks.recurrences.daily",
  weekly: "tasks.recurrences.weekly",
  monthly: "tasks.recurrences.monthly",
};

const statusLabels: Record<TaskStatus, string> = {
  pending: "tasks.statuses.pending",
  in_progress: "tasks.statuses.in_progress",
  done: "tasks.statuses.done",
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

function formatDue(task: Task): string {
  if (!task.dueDate) {
    return "";
  }
  return task.dueTime ? `${task.dueDate} ${task.dueTime}` : task.dueDate;
}

const emptyForm = {
  id: null as string | null,
  title: "",
  description: "",
  subjectId: "",
  parentTaskId: "",
  taskType: "task" as TaskType,
  priority: "medium" as TaskPriority,
  important: false,
  startDate: "",
  dueDate: "",
  dueTime: "",
  estimateMinutes: "",
  status: "pending" as TaskStatus,
  recurring: false,
  recurrenceKind: "weekly" as TaskRecurrenceKind,
  recurrenceInterval: "1",
  recurrenceUntil: "",
  tagIds: [] as string[],
};

type TaskForm = typeof emptyForm;

function inputFromForm(form: TaskForm): TaskInput {
  return {
    subjectId: optionalText(form.subjectId),
    parentTaskId: optionalText(form.parentTaskId),
    taskType: form.taskType,
    title: form.title,
    description: optionalText(form.description),
    startDate: optionalText(form.startDate),
    dueDate: optionalText(form.dueDate),
    dueTime: optionalText(form.dueTime),
    priority: ["low", "medium", "high", "urgent"].indexOf(form.priority),
    important: form.important,
    estimateMinutes: optionalNumber(form.estimateMinutes),
    status: form.status,
    recurrence:
      form.recurring && form.dueDate.trim().length > 0
        ? {
            kind: form.recurrenceKind,
            interval: Math.max(1, optionalNumber(form.recurrenceInterval) ?? 1),
            until: optionalText(form.recurrenceUntil),
          }
        : null,
    tagIds: form.tagIds,
  };
}

function formFromTask(task: Task): TaskForm {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    subjectId: task.subjectId ?? "",
    parentTaskId: task.parentTaskId ?? "",
    taskType: task.taskType,
    priority: task.priority,
    important: task.important,
    startDate: task.startDate ?? "",
    dueDate: task.dueDate ?? "",
    dueTime: task.dueTime ?? "",
    estimateMinutes: task.estimateMinutes?.toString() ?? "",
    status: task.status,
    recurring: task.recurrence !== null,
    recurrenceKind: task.recurrence?.kind ?? "weekly",
    recurrenceInterval: task.recurrence?.interval.toString() ?? "1",
    recurrenceUntil: task.recurrence?.until ?? "",
    tagIds: (task.tags ?? []).map((tag) => tag.id),
  };
}

export function TasksView({
  vault,
  tasks,
  error,
  onGoVault,
  onCreate,
  onToggle,
  onDelete,
  onTasksChanged,
}: {
  vault: VaultStatus | null;
  tasks: Task[];
  error: string | null;
  onGoVault: () => void;
  onCreate: (title: string) => Promise<boolean>;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTasksChanged: (tasks: Task[]) => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [undo, setUndo] = useState<UndoEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "open" | TaskStatus>(
    "",
  );
  const [filterPriority, setFilterPriority] = useState("");
  const [filterTagId, setFilterTagId] = useState("");
  const [searchResults, setSearchResults] = useState<Task[] | null>(null);
  const [filterName, setFilterName] = useState("");
  const [tagName, setTagName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const activeFilter = useMemo(() => {
    const filter: TaskFilter = {};
    if (filterText.trim().length > 0) {
      filter.text = filterText.trim();
    }
    if (filterStatus) {
      filter.status = filterStatus;
    }
    if (filterPriority) {
      filter.priority = Number(filterPriority);
    }
    if (filterTagId) {
      filter.tagId = filterTagId;
    }
    return filter;
  }, [filterText, filterStatus, filterPriority, filterTagId]);

  const filterIsActive = Object.keys(activeFilter).length > 0;

  const visible = searchResults ?? tasks;
  const openTasks = visible.filter((task) => task.status !== "done");
  const doneTasks = visible.filter((task) => task.status === "done");

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function loadAux() {
      try {
        const [loadedTags, loadedUndo, loadedFilters] = await Promise.all([
          listTags(),
          listUndoEntries(),
          listSavedFilters("tasks"),
        ]);
        if (cancelled) {
          return;
        }
        setTags(loadedTags);
        setUndo(loadedUndo);
        setFilters(loadedFilters);
      } catch (reason) {
        if (!cancelled) {
          setLocalError(messageOf(reason));
        }
      }

      try {
        const years = await listAcademicYears();
        const terms = years[0] ? await listTerms(years[0].id) : [];
        const loadedSubjects = terms[0] ? await listSubjects(terms[0].id) : [];
        if (!cancelled) {
          setSubjects(loadedSubjects);
        }
      } catch (reason) {
        if (!cancelled) {
          setLocalError(messageOf(reason));
        }
      }
    }

    void loadAux();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run the search when the task list changes
  useEffect(() => {
    if (!filterIsActive) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    async function run() {
      try {
        const results = await searchTasks(activeFilter);
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (reason) {
        if (!cancelled) {
          setLocalError(messageOf(reason));
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeFilter, filterIsActive, tasks]);

  async function refreshAux() {
    const [loadedTags, loadedUndo, loadedFilters] = await Promise.all([
      listTags(),
      listUndoEntries(),
      listSavedFilters("tasks"),
    ]);
    setTags(loadedTags);
    setUndo(loadedUndo);
    setFilters(loadedFilters);
  }

  async function refreshTasks() {
    const loaded = await listTasks();
    onTasksChanged(loaded);
    if (filterIsActive) {
      setSearchResults(await searchTasks(activeFilter));
    }
  }

  async function submitQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    const created = await onCreate(trimmed);
    setSubmitting(false);
    if (created) {
      setTitle("");
      await refreshAux();
      await refreshTasks();
    }
  }

  function startCreate() {
    setForm(emptyForm);
    setShowForm(true);
    setLocalError(null);
  }

  function startEdit(task: Task) {
    setForm(formFromTask(task));
    setShowForm(true);
    setLocalError(null);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.title.trim().length === 0 || saving) {
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const input = inputFromForm(form);
      if (form.id) {
        await updateTask(form.id, input);
        setNotice(t("tasks.taskUpdated"));
      } else {
        await createTaskFull(input);
        setNotice(t("tasks.taskCreated"));
      }
      setShowForm(false);
      setForm(emptyForm);
      await refreshAux();
      await refreshTasks();
    } catch (reason) {
      setLocalError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(task: Task) {
    setLocalError(null);
    onToggle(task);
    if (filterIsActive) {
      // La vista global se actualiza en App; re-evaluamos el filtro enseguida.
      window.setTimeout(() => {
        void searchTasks(activeFilter).then(setSearchResults);
      }, 0);
    }
  }

  async function handleDelete(task: Task) {
    setLocalError(null);
    onDelete(task);
    window.setTimeout(async () => {
      try {
        await refreshAux();
        await refreshTasks();
        setNotice(t("tasks.taskDeletedNotice"));
      } catch (reason) {
        setLocalError(messageOf(reason));
      }
    }, 0);
  }

  async function handleUndo(entry: UndoEntry) {
    setLocalError(null);
    try {
      await undoEntry(entry.id);
      await refreshAux();
      await refreshTasks();
      setNotice(t("tasks.taskRestored"));
    } catch (reason) {
      setLocalError(messageOf(reason));
    }
  }

  async function handleCreateTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tagName.trim().length === 0) {
      return;
    }
    setLocalError(null);
    try {
      const created = await createTag(tagName.trim());
      setTagName("");
      setTags((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (reason) {
      setLocalError(messageOf(reason));
    }
  }

  async function handleDeleteTag(tag: Tag) {
    setLocalError(null);
    try {
      await deleteTag(tag.id);
      if (filterTagId === tag.id) {
        setFilterTagId("");
      }
      await refreshAux();
      await refreshTasks();
    } catch (reason) {
      setLocalError(messageOf(reason));
    }
  }

  async function handleSaveFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filterName.trim().length === 0) {
      return;
    }
    setLocalError(null);
    try {
      await createSavedFilter(
        "tasks",
        filterName.trim(),
        JSON.stringify(activeFilter),
      );
      setFilterName("");
      await refreshAux();
      setNotice(t("tasks.filterSaved"));
    } catch (reason) {
      setLocalError(messageOf(reason));
    }
  }

  async function applySavedFilter(saved: SavedFilter) {
    const parsed = parseTaskFilter(saved.queryJson);
    if (!parsed) {
      setLocalError(t("tasks.filterInvalid"));
      return;
    }
    setFilterText(parsed.text ?? "");
    setFilterStatus(parsed.status ?? "");
    setFilterPriority(
      parsed.priority === null || parsed.priority === undefined
        ? ""
        : String(parsed.priority),
    );
    setFilterTagId(parsed.tagId ?? "");
  }

  async function handleDeleteFilter(saved: SavedFilter) {
    try {
      await deleteSavedFilter(saved.id);
      await refreshAux();
    } catch (reason) {
      setLocalError(messageOf(reason));
    }
  }

  const parentOptions = tasks.filter(
    (task) => task.parentTaskId === null && task.id !== form.id,
  );

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("tasks.eyebrow")}</p>
        <h1>{t("tasks.title")}</h1>
        <p className="hero-copy">{t("tasks.copy")}</p>
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
          <p>{vault?.message ?? t("tasks.noVaultBody")}</p>
          <div className="hero-actions">
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.goToVault")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <form className="task-composer" onSubmit={submitQuick}>
            <label className="sr-only" htmlFor="task-title">
              {t("tasks.newTaskLabel")}
            </label>
            <input
              id="task-title"
              className="text-field"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("tasks.newTaskPlaceholder")}
              maxLength={200}
              autoComplete="off"
              disabled={submitting}
            />
            <button
              type="submit"
              className="button filled"
              disabled={submitting || title.trim().length === 0}
            >
              {submitting ? t("common.saving") : t("tasks.add")}
            </button>
            <button
              type="button"
              className="button tonal"
              onClick={showForm ? () => setShowForm(false) : startCreate}
            >
              {showForm ? t("tasks.closeForm") : t("tasks.moreOptions")}
            </button>
          </form>

          {error || localError ? (
            <p className="notice error" role="alert">
              {localError ?? error}
            </p>
          ) : null}
          {notice ? (
            <p className="notice" role="status">
              {notice}
            </p>
          ) : null}

          {undo.length > 0 ? (
            <section className="status-card" aria-labelledby="undo-title">
              <div>
                <p className="eyebrow">{t("tasks.undoEyebrow")}</p>
                <h2 id="undo-title">{t("tasks.recentActions")}</h2>
                <p>{t("tasks.availableFiveMinutes")}</p>
              </div>
              <ul className="mini-list">
                {undo.map((entry) => (
                  <li key={entry.id} className="mini-item">
                    <span>
                      {entry.action === "delete_task"
                        ? t("tasks.taskDeleted")
                        : entry.action}
                      <span className="quiet">
                        {" "}
                        {t("tasks.expiresAt", {
                          time: new Date(entry.expiresAt).toLocaleTimeString(
                            intlLocale(),
                          ),
                        })}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="button tonal"
                      onClick={() => void handleUndo(entry)}
                    >
                      {t("tasks.undoAction")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="academic-panel" aria-labelledby="filter-title">
            <div className="task-board-head">
              <h2 id="filter-title">{t("tasks.searchTitle")}</h2>
              {filterIsActive ? (
                <button
                  type="button"
                  className="button tonal"
                  onClick={() => {
                    setFilterText("");
                    setFilterStatus("");
                    setFilterPriority("");
                    setFilterTagId("");
                  }}
                >
                  {t("tasks.clearFilters")}
                </button>
              ) : null}
            </div>
            <div className="inline-form">
              <label className="field">
                <span>{t("tasks.textFilter")}</span>
                <input
                  className="text-field"
                  type="search"
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder={t("tasks.searchPlaceholder")}
                />
              </label>
              <label className="field">
                <span>{t("tasks.statusFilter")}</span>
                <select
                  className="select-field"
                  value={filterStatus}
                  onChange={(event) =>
                    setFilterStatus(
                      event.target.value as "" | "open" | TaskStatus,
                    )
                  }
                >
                  <option value="">{t("tasks.allStatuses")}</option>
                  <option value="open">{t("tasks.statusOpen")}</option>
                  <option value="pending">{t("tasks.statusPending")}</option>
                  <option value="in_progress">
                    {t("tasks.statuses.in_progress")}
                  </option>
                  <option value="done">{t("tasks.statusDone")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("tasks.priorityFilter")}</span>
                <select
                  className="select-field"
                  value={filterPriority}
                  onChange={(event) => setFilterPriority(event.target.value)}
                >
                  <option value="">{t("tasks.allPriorities")}</option>
                  <option value="3">{t("tasks.priorities.urgent")}</option>
                  <option value="2">{t("tasks.priorities.high")}</option>
                  <option value="1">{t("tasks.priorities.medium")}</option>
                  <option value="0">{t("tasks.priorities.low")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("tasks.tagFilter")}</span>
                <select
                  className="select-field"
                  value={filterTagId}
                  onChange={(event) => setFilterTagId(event.target.value)}
                >
                  <option value="">{t("tasks.allTags")}</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="inline-form">
              <form className="inline-form" onSubmit={handleSaveFilter}>
                <label className="field">
                  <span>{t("tasks.filterName")}</span>
                  <input
                    className="text-field"
                    value={filterName}
                    onChange={(event) => setFilterName(event.target.value)}
                    placeholder={t("tasks.filterNamePlaceholder")}
                  />
                </label>
                <button
                  type="submit"
                  className="button tonal"
                  disabled={filterName.trim().length === 0 || !filterIsActive}
                >
                  {t("tasks.saveFilter")}
                </button>
              </form>
              {filters.length > 0 ? (
                <ul className="mini-list">
                  {filters.map((saved) => (
                    <li key={saved.id} className="mini-item">
                      <button
                        type="button"
                        className="mini-action"
                        onClick={() => void applySavedFilter(saved)}
                      >
                        {saved.name}
                      </button>
                      <button
                        type="button"
                        className="mini-action danger"
                        onClick={() => void handleDeleteFilter(saved)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section className="academic-panel" aria-labelledby="tags-title">
            <div className="task-board-head">
              <h2 id="tags-title">{t("tasks.tagsTitle")}</h2>
              <span className="count-chip">{tags.length}</span>
            </div>
            <form className="inline-form" onSubmit={handleCreateTag}>
              <label className="field">
                <span>{t("tasks.newTag")}</span>
                <input
                  className="text-field"
                  value={tagName}
                  onChange={(event) => setTagName(event.target.value)}
                  maxLength={40}
                  placeholder={t("tasks.tagNamePlaceholder")}
                />
              </label>
              <button
                type="submit"
                className="button tonal"
                disabled={tagName.trim().length === 0}
              >
                {t("tasks.createTag")}
              </button>
            </form>
            {tags.length > 0 ? (
              <ul className="tag-list">
                {tags.map((tag) => (
                  <li key={tag.id} className="tag-chip">
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      className="mini-action danger"
                      aria-label={t("tasks.deleteTagAria", { name: tag.name })}
                      onClick={() => void handleDeleteTag(tag)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {showForm ? (
            <form className="academic-panel" onSubmit={submitForm}>
              <div className="task-board-head">
                <h2>
                  {form.id ? t("tasks.editTask") : t("tasks.newTaskFull")}
                </h2>
              </div>
              <div className="inline-form">
                <label className="field">
                  <span>{t("common.title")}</span>
                  <input
                    className="text-field"
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    maxLength={200}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("common.subject")}</span>
                  <select
                    className="select-field"
                    value={form.subjectId}
                    onChange={(event) =>
                      setForm({ ...form, subjectId: event.target.value })
                    }
                  >
                    <option value="">{t("common.noSubject")}</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("tasks.parentTask")}</span>
                  <select
                    className="select-field"
                    value={form.parentTaskId}
                    onChange={(event) =>
                      setForm({ ...form, parentTaskId: event.target.value })
                    }
                  >
                    <option value="">{t("common.noParent")}</option>
                    {parentOptions.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("common.type")}</span>
                  <select
                    className="select-field"
                    value={form.taskType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        taskType: event.target.value as TaskType,
                      })
                    }
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("tasks.priorityFilter")}</span>
                  <select
                    className="select-field"
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority: event.target.value as TaskPriority,
                      })
                    }
                  >
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("tasks.statusFilter")}</span>
                  <select
                    className="select-field"
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as TaskStatus,
                      })
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("common.start")}</span>
                  <input
                    className="text-field"
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm({ ...form, startDate: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("common.deadline")}</span>
                  <input
                    className="text-field"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm({ ...form, dueDate: event.target.value })
                    }
                  />
                </label>
                <label className="field narrow">
                  <span>{t("common.time")}</span>
                  <input
                    className="text-field"
                    type="time"
                    value={form.dueTime}
                    onChange={(event) =>
                      setForm({ ...form, dueTime: event.target.value })
                    }
                  />
                </label>
                <label className="field narrow">
                  <span>{t("common.estimateMinutes")}</span>
                  <input
                    className="text-field"
                    type="number"
                    min={0}
                    value={form.estimateMinutes}
                    onChange={(event) =>
                      setForm({ ...form, estimateMinutes: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("common.description")}</span>
                  <input
                    className="text-field"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="inline-form">
                <label className="field">
                  <span>{t("tasks.recurring")}</span>
                  <input
                    type="checkbox"
                    checked={form.recurring}
                    onChange={(event) =>
                      setForm({ ...form, recurring: event.target.checked })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("tasks.recurrenceLabel")}</span>
                  <select
                    className="select-field"
                    value={form.recurrenceKind}
                    disabled={!form.recurring}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        recurrenceKind: event.target
                          .value as TaskRecurrenceKind,
                      })
                    }
                  >
                    {Object.entries(recurrenceLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field narrow">
                  <span>{t("tasks.every")}</span>
                  <input
                    className="text-field"
                    type="number"
                    min={1}
                    value={form.recurrenceInterval}
                    disabled={!form.recurring}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        recurrenceInterval: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("tasks.until")}</span>
                  <input
                    className="text-field"
                    type="date"
                    value={form.recurrenceUntil}
                    disabled={!form.recurring}
                    onChange={(event) =>
                      setForm({ ...form, recurrenceUntil: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("tasks.important")}</span>
                  <input
                    type="checkbox"
                    checked={form.important}
                    onChange={(event) =>
                      setForm({ ...form, important: event.target.checked })
                    }
                  />
                </label>
              </div>

              <fieldset className="field">
                <legend>{t("tasks.tagsTitle")}</legend>
                <div className="tag-list">
                  {tags.length === 0 ? (
                    <span className="quiet">{t("tasks.noTagsYet")}</span>
                  ) : (
                    tags.map((tag) => (
                      <label key={tag.id} className="tag-chip">
                        <input
                          type="checkbox"
                          checked={form.tagIds.includes(tag.id)}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              tagIds: event.target.checked
                                ? [...form.tagIds, tag.id]
                                : form.tagIds.filter((id) => id !== tag.id),
                            })
                          }
                        />
                        <span>{tag.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </fieldset>

              <div className="form-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="button filled"
                  disabled={saving || form.title.trim().length === 0}
                >
                  {saving
                    ? t("common.saving")
                    : form.id
                      ? t("tasks.saveChanges")
                      : t("tasks.createTask")}
                </button>
              </div>
            </form>
          ) : null}

          <section className="task-board" aria-labelledby="open-title">
            <div className="task-board-head">
              <h2 id="open-title">{t("tasks.openTitle")}</h2>
              <span className="count-chip">{openTasks.length}</span>
            </div>
            {openTasks.length === 0 ? (
              <p className="empty-state">{t("tasks.emptyOpen")}</p>
            ) : (
              <ul className="task-list">
                {openTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={startEdit}
                  />
                ))}
              </ul>
            )}
          </section>

          {doneTasks.length > 0 ? (
            <section className="task-board" aria-labelledby="done-title">
              <div className="task-board-head">
                <h2 id="done-title">{t("tasks.doneTitle")}</h2>
                <span className="count-chip">{doneTasks.length}</span>
              </div>
              <ul className="task-list">
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={startEdit}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const done = task.status === "done";
  const action = done ? "Reabrir" : "Completar";

  return (
    <li className={`task-row${done ? " is-done" : ""}`}>
      <input
        type="checkbox"
        className="task-check"
        checked={done}
        onChange={() => onToggle(task)}
        aria-label={`${action} «${task.title}»`}
      />
      <span className="task-title">
        {task.title}
        {task.parentTaskId ? <span className="quiet"> · subtarea</span> : null}
      </span>
      <span className="task-meta">
        {task.priority && task.priority !== "low" ? (
          <span className={`priority-chip priority-${task.priority}`}>
            {priorityLabels[task.priority] ?? task.priority}
          </span>
        ) : null}
        {task.dueDate ? ` ${formatDue(task)}` : ""}
        {(task.tags ?? []).length > 0
          ? ` · ${(task.tags ?? []).map((tag) => tag.name).join(", ")}`
          : ""}
        {task.recurrence ? ` · ${recurrenceLabels[task.recurrence.kind]}` : ""}
      </span>
      <button
        type="button"
        className="mini-action"
        onClick={() => onEdit(task)}
        aria-label={`Editar «${task.title}»`}
      >
        Editar
      </button>
      <button
        type="button"
        className="task-delete"
        onClick={() => onDelete(task)}
        aria-label={`Eliminar «${task.title}»`}
      >
        ×
      </button>
    </li>
  );
}
