import { useEffect, useState } from "react";
import { Trans } from "react-i18next";
import { ResizeHandles } from "./components/ResizeHandles";
import { WindowControls } from "./components/WindowControls";
import {
  hasStoredLanguage,
  intlLocale,
  normalizeLanguage,
  setAppLanguage,
  useTranslation,
} from "./lib/i18n";
import {
  type AppInfo,
  chooseVault,
  createBackup,
  createTask,
  deleteTask,
  exportVault,
  getAppInfo,
  getAppLocale,
  getVaultStatus,
  importVault,
  listTasks,
  restoreMainBackup,
  runningInTauri,
  setTaskDone,
  type Task,
  type VaultStatus,
} from "./lib/ipc";
import { useTheme } from "./lib/theme";
import { AcademicView } from "./views/AcademicView";
import { CalendarView } from "./views/CalendarView";
import { ExamsView } from "./views/ExamsView";
import { GradesView } from "./views/GradesView";
import { ScheduleView } from "./views/ScheduleView";
import { SettingsView } from "./views/SettingsView";
import { StatsView } from "./views/StatsView";
import { StrengthsView } from "./views/StrengthsView";
import { StudyView } from "./views/StudyView";
import { TasksView } from "./views/TasksView";
import { TodaySchedule } from "./views/TodaySchedule";
import "./styles.css";

const navGroups = [
  {
    id: "daily",
    icon: "daily",
    items: [
      { id: "today", icon: "today" },
      { id: "calendar", icon: "calendar" },
      { id: "tasks", icon: "tasks" },
    ],
  },
  {
    id: "academics",
    icon: "academics",
    items: [
      { id: "subjects", icon: "subjects" },
      { id: "schedule", icon: "schedule" },
      { id: "exams", icon: "exams" },
      { id: "grades", icon: "grades" },
    ],
  },
  {
    id: "study",
    icon: "studyGroup",
    items: [
      { id: "study", icon: "study" },
      { id: "strengths", icon: "strengths" },
      { id: "stats", icon: "stats" },
    ],
  },
  {
    id: "system",
    icon: "system",
    items: [
      { id: "vault", icon: "vault" },
      { id: "settings", icon: "settings" },
    ],
  },
] as const;

type SectionId = (typeof navGroups)[number]["items"][number]["id"];
type NavGroupId = (typeof navGroups)[number]["id"];

const NAV_EXPANDED_KEY = "study-planner.nav.expanded";

function groupForSection(section: SectionId): NavGroupId {
  return (
    navGroups.find((group) => group.items.some((item) => item.id === section))
      ?.id ?? "daily"
  );
}

function readExpandedGroups(): Set<NavGroupId> {
  const fallback = new Set<NavGroupId>([groupForSection("today")]);
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(NAV_EXPANDED_KEY);
    if (!stored) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    const valid = parsed.filter((id): id is NavGroupId =>
      navGroups.some((group) => group.id === id),
    );
    return valid.length > 0 ? new Set(valid) : fallback;
  } catch {
    return fallback;
  }
}

const iconPaths: Record<string, string> = {
  daily:
    "M12 3 3 10v11h6v-6h6v6h6V10l-9-7Zm0 2.4 7 5.4V19h-2v-6H7v6H5v-8.2l7-5.4Z",
  academics:
    "M12 3 2 8l10 5 8-4v6h2V8L12 3ZM6 12.4V16c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.6l-6 3-6-3Z",
  studyGroup:
    "M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Zm-3 17h6v2H9v-2Zm1-4v-1.4l-1.2-1a5 5 0 1 1 6.4 0l-1.2 1V15h-4Z",
  system:
    "M4 6h7v2H4V6Zm9 0h7v2h-7V6ZM4 16h3v2H4v-2Zm5 0h11v2H9v-2ZM8 4h2v6H8V4Zm6 10h2v6h-2v-6Z",
  today:
    "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 3v2h10V7H7Zm0 4v2h4v-2H7Zm6 0v2h4v-2h-4Zm-6 4v2h4v-2H7Z",
  subjects:
    "M6 3h11a1 1 0 0 1 1 1v16l-6.5-3.5L5 20V4a1 1 0 0 1 1-1Zm1 2v12.5l4.5-2.4 4.5 2.4V5H7Z",
  schedule: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v5l3 2-1 1.7-4-2.7V7h2Z",
  calendar:
    "M7 3h2v2h6V3h2v2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V3Zm12 7H5v9h14v-9ZM6 11h3v3H6v-3Z",
  tasks:
    "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4v2h2V8H8Zm4 0v2h5V8h-5Zm-4 4v2h2v-2H8Zm4 0v2h5v-2h-5Z",
  exams: "M6 3h9l4 4v14H6V3Zm8 2v3h3l-3-3ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z",
  grades: "M4 20V10h4v10H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z",
  study:
    "M12 5.5C10 4.2 7.6 3.6 5 3.6H3v14h2c2.6 0 5 .6 7 1.9 2-1.3 4.4-1.9 7-1.9h2v-14h-2c-2.6 0-5 .6-7 1.9Zm1 12.2V7.2c1.6-.8 3.3-1.2 5-1.2v10.5c-1.8 0-3.5.4-5 1.2Z",
  strengths:
    "M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z",
  stats: "M4 19h16v2H4v-2Zm1-7h3v5H5v-5Zm5-5h3v10h-3V7Zm5 3h3v7h-3v-7Z",
  vault:
    "M12 2l8 4v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-4Zm0 3.2L7 7.5V12c0 3.4 2 6 5 7.2 3-1.2 5-3.8 5-7.2V7.5l-5-2.3Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.4 4a6.6 6.6 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7.8 7.8 0 0 0-1.7-1L16 3.5h-4l-.4 2.4a7.8 7.8 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a6.6 6.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.8 1.7 1l.4 2.4h4l.4-2.4c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1Z",
};

const dateFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });

const dateTimeFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter(locale).format(date);
}

function formatDateTime(value: string | number, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : dateTimeFormatter(locale).format(date);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function Icon({ name }: { name: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name] ?? iconPaths.today} />
    </svg>
  );
}

function TaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete?: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const done = task.status === "done";
  const action = done ? t("today.reopen") : t("today.complete");

  return (
    <li className={`task-row${done ? " is-done" : ""}`}>
      <input
        type="checkbox"
        className="task-check"
        checked={done}
        onChange={() => onToggle(task)}
        aria-label={t("today.toggleAria", { action, title: task.title })}
      />
      <span className="task-title">{task.title}</span>
      <span className="task-meta">
        {done
          ? t("today.done")
          : task.status === "in_progress"
            ? t("today.inProgress")
            : formatDate(task.createdAt, intlLocale())}
      </span>
      {onDelete ? (
        <button
          type="button"
          className="task-delete"
          onClick={() => onDelete(task)}
          aria-label={t("today.deleteAria", { title: task.title })}
        >
          ×
        </button>
      ) : null}
    </li>
  );
}

function TodayView({
  vault,
  tasks,
  onOpenTasks,
  onOpenVault,
  onGoSubjects,
  onToggleTask,
}: {
  vault: VaultStatus | null;
  tasks: Task[];
  onOpenTasks: () => void;
  onOpenVault: () => void;
  onGoSubjects: () => void;
  onToggleTask: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const openTasks = tasks.filter((task) => task.status !== "done");

  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          {ready
            ? t("today.eyebrowReady", {
                name: vault?.name ?? t("common.ready"),
              })
            : t("today.eyebrowFirst")}
        </p>
        <h1>{ready ? t("today.titleReady") : t("today.titleFirst")}</h1>
        <p className="hero-copy">
          {ready ? t("today.copyReady") : t("today.copyFirst")}
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="button filled"
            onClick={ready ? onOpenTasks : onOpenVault}
          >
            {ready ? t("today.viewTasks") : t("common.configureVault")}
          </button>
        </div>
      </section>

      {ready ? (
        <TodaySchedule vault={vault} onGoSubjects={onGoSubjects} />
      ) : null}

      {ready ? (
        <section className="status-card" aria-labelledby="pending-title">
          <div>
            <p className="eyebrow">{t("today.pendingEyebrow")}</p>
            <h2 id="pending-title">{t("today.pendingTitle")}</h2>
            <p>
              {openTasks.length === 0
                ? t("today.noOpenTasks")
                : t("today.openTasks", { count: openTasks.length })}
            </p>
            <button
              type="button"
              className="button tonal"
              onClick={onOpenTasks}
            >
              {t("today.manageTasks")}
            </button>
          </div>
          {openTasks.length === 0 ? (
            <p className="notice">{t("today.firstTaskNotice")}</p>
          ) : (
            <ul
              className="task-list compact"
              aria-label={t("today.pendingAria")}
            >
              {openTasks.slice(0, 4).map((task) => (
                <TaskItem key={task.id} task={task} onToggle={onToggleTask} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}

function VaultView({
  vault,
  error,
  notice,
  choosing,
  backingUp,
  exporting,
  importing,
  restoring,
  onChoose,
  onCreateBackup,
  onExport,
  onImport,
  onRestore,
}: {
  vault: VaultStatus | null;
  error: string | null;
  notice: string | null;
  choosing: boolean;
  backingUp: boolean;
  exporting: boolean;
  importing: boolean;
  restoring: boolean;
  onChoose: () => void;
  onCreateBackup: () => void;
  onExport: () => void;
  onImport: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const latestSnapshot = vault?.snapshots[0] ?? null;
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const busy = choosing || backingUp || exporting || importing || restoring;
  const locale = intlLocale();

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("vault.eyebrow")}</p>
        <h1>{t("vault.title")}</h1>
        <p className="hero-copy">{t("vault.copy")}</p>
        <div className="hero-actions">
          <button
            type="button"
            className="button filled"
            onClick={onChoose}
            disabled={!runningInTauri || choosing}
            title={runningInTauri ? undefined : t("vault.pickerTooltip")}
          >
            {choosing
              ? t("vault.openPicker")
              : vault?.ready
                ? t("vault.changeFolder")
                : t("vault.chooseFolder")}
          </button>
        </div>
      </section>

      {!runningInTauri ? (
        <p className="notice">
          <Trans
            i18nKey="vault.browserNotice"
            components={{ code: <code /> }}
          />
        </p>
      ) : error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="vault-grid" aria-label={t("vault.partsAria")}>
        <article className="card">
          <span className="card-kicker">{t("vault.statusKicker")}</span>
          <h2>
            {vault?.ready
              ? (vault.name ?? t("vault.openedTitle"))
              : vault?.message
                ? t("vault.failedTitle")
                : t("vault.unsetTitle")}
          </h2>
          <p>
            {vault?.ready
              ? t("vault.readyBody")
              : (vault?.message ?? t("vault.unsetBody"))}
          </p>
        </article>
        <article className="card">
          <span className="card-kicker">{t("vault.liveKicker")}</span>
          <h2>{t("vault.liveTitle")}</h2>
          <p>{t("vault.liveBody")}</p>
        </article>
        <article className="card">
          <span className="card-kicker">{t("vault.continuityKicker")}</span>
          <h2>{t("vault.continuityTitle")}</h2>
          <p>{t("vault.continuityBody")}</p>
        </article>
      </section>

      {vault?.ready ? (
        <section className="status-card" aria-labelledby="backup-title">
          <div>
            <p className="eyebrow">{t("vault.backupsEyebrow")}</p>
            <h2 id="backup-title">{t("vault.backupTitle")}</h2>
            <p>
              <Trans
                i18nKey="vault.backupBody"
                components={{ code: <code /> }}
              />
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="button tonal"
                onClick={onCreateBackup}
                disabled={busy}
              >
                {backingUp
                  ? t("vault.creatingBackup")
                  : t("vault.createBackup")}
              </button>
              <button
                type="button"
                className="button tonal"
                onClick={() => setConfirmingRestore(true)}
                disabled={busy || !vault.backup}
              >
                {t("vault.restoreBackup")}
              </button>
            </div>
            {confirmingRestore ? (
              <div
                className="confirm-card"
                role="alertdialog"
                aria-labelledby="restore-confirm-title"
              >
                <p id="restore-confirm-title">
                  <Trans
                    i18nKey="vault.confirmRestore"
                    components={{ code: <code /> }}
                  />
                </p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => setConfirmingRestore(false)}
                    disabled={restoring}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    className="button filled"
                    onClick={() => {
                      setConfirmingRestore(false);
                      onRestore();
                    }}
                    disabled={restoring}
                  >
                    {restoring
                      ? t("vault.restoring")
                      : t("vault.confirmRestoreAction")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <dl className="status-grid">
            <div>
              <dt>{t("vault.size")}</dt>
              <dd>
                {vault.backup ? formatBytes(vault.backup.sizeBytes) : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("vault.integrity")}</dt>
              <dd>{vault.backup?.integrity ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("vault.modified")}</dt>
              <dd>
                {vault.backup
                  ? formatDateTime(vault.backup.modifiedAtMillis, locale)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("vault.snapshots")}</dt>
              <dd>
                {vault.snapshots.length} / 7
                {latestSnapshot ? ` · ${latestSnapshot.date}` : ""}
              </dd>
            </div>
            <div className="span-2">
              <dt>{t("vault.backupSha")}</dt>
              <dd className="mono">
                {vault.backup
                  ? `${vault.backup.sha256.slice(0, 24)}…`
                  : t("vault.noBackupYet")}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {vault?.ready ? (
        <section className="status-card" aria-labelledby="transfer-title">
          <div>
            <p className="eyebrow">{t("vault.portabilityEyebrow")}</p>
            <h2 id="transfer-title">{t("vault.transferTitle")}</h2>
            <p>
              <Trans
                i18nKey="vault.transferBody"
                components={{ code: <code /> }}
              />
            </p>
            <p className="notice">{t("vault.transferWarning")}</p>
            <div className="hero-actions">
              <button
                type="button"
                className="button tonal"
                onClick={onExport}
                disabled={busy}
              >
                {exporting ? t("vault.exporting") : t("vault.exportVault")}
              </button>
              <button
                type="button"
                className="button tonal"
                onClick={onImport}
                disabled={busy || vault.hasData}
                title={
                  vault.hasData ? t("vault.importBlockedTooltip") : undefined
                }
              >
                {importing ? t("vault.importing") : t("vault.importEmpty")}
              </button>
            </div>
            {vault.hasData ? (
              <p className="notice">{t("vault.importBlockedNotice")}</p>
            ) : (
              <p className="notice">
                <Trans
                  i18nKey="vault.importAvailableNotice"
                  components={{ code: <code /> }}
                />
              </p>
            )}
          </div>
          <dl className="status-grid">
            <div>
              <dt>{t("vault.domainData")}</dt>
              <dd>{vault.hasData ? t("vault.present") : t("vault.none")}</dd>
            </div>
            <div>
              <dt>{t("vault.importLabel")}</dt>
              <dd>
                {vault.hasData
                  ? t("vault.importBlocked")
                  : t("vault.importAvailable")}
              </dd>
            </div>
            <div className="span-2">
              <dt>{t("vault.roundTrip")}</dt>
              <dd>{t("vault.roundTripBody")}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {vault?.ready ? (
        <section className="status-card" aria-labelledby="vault-title">
          <div>
            <p className="eyebrow">{t("vault.diagnosticsEyebrow")}</p>
            <h2 id="vault-title">{t("vault.diagnosticsTitle")}</h2>
            <p>{t("vault.integrityVerified")}</p>
          </div>
          <dl className="status-grid">
            <div>
              <dt>{t("vault.schema")}</dt>
              <dd>v{vault.schemaVersion}</dd>
            </div>
            <div>
              <dt>{t("vault.integrity")}</dt>
              <dd>{vault.integrity}</dd>
            </div>
            <div>
              <dt>{t("vault.foreignKeys")}</dt>
              <dd>
                {t("vault.foreignKeyViolations", {
                  count: vault.foreignKeyViolations,
                })}
              </dd>
            </div>
            <div>
              <dt>{t("vault.device")}</dt>
              <dd>{vault.device ?? "—"}</dd>
            </div>
            <div className="span-2">
              <dt>{t("vault.vaultId")}</dt>
              <dd className="mono">{vault.vaultId}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </>
  );
}

function App() {
  const { t } = useTranslation();
  const [active, setActive] = useState<SectionId>("today");
  const [expandedGroups, setExpandedGroups] =
    useState<Set<NavGroupId>>(readExpandedGroups);
  const {
    mode: themeMode,
    accent,
    setMode: setThemeMode,
    setAccent,
  } = useTheme();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        NAV_EXPANDED_KEY,
        JSON.stringify([...expandedGroups]),
      );
    } catch {
      // La navegación sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }, [expandedGroups]);

  useEffect(() => {
    const groupId = groupForSection(active);
    setExpandedGroups((current) => {
      if (current.has(groupId)) {
        return current;
      }
      const next = new Set(current);
      next.add(groupId);
      return next;
    });
  }, [active]);

  useEffect(() => {
    if (!runningInTauri) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const appInfo = await getAppInfo();
        if (!cancelled) {
          setInfo(appInfo);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }

      try {
        const status = await getVaultStatus();
        if (cancelled) {
          return;
        }
        setVault(status);
        if (status.ready) {
          if (!hasStoredLanguage() && typeof getAppLocale === "function") {
            try {
              const storedLocale = await getAppLocale();
              if (storedLocale && !cancelled) {
                await setAppLanguage(normalizeLanguage(storedLocale));
              }
            } catch {
              // La bóveda puede no exponer el ajuste todavía; se usa inglés.
            }
          }
          const stored = await listTasks();
          if (!cancelled) {
            setTasks(stored);
          }
        }
      } catch (reason) {
        if (!cancelled) {
          setVaultError(messageOf(reason));
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChooseVault() {
    setChoosing(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const status = await chooseVault();
      if (!status) {
        return;
      }
      setVault(status);
      if (
        status.ready &&
        !hasStoredLanguage() &&
        typeof getAppLocale === "function"
      ) {
        try {
          const storedLocale = await getAppLocale();
          if (storedLocale) {
            await setAppLanguage(normalizeLanguage(storedLocale));
          }
        } catch {
          // Se mantiene el inglés por defecto.
        }
      }
      setTasks(status.ready ? await listTasks() : []);
      setTaskError(null);
    } catch (reason) {
      setVaultError(messageOf(reason));
    } finally {
      setChoosing(false);
    }
  }

  async function handleCreateBackup() {
    setBackingUp(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const status = await createBackup();
      setVault(status);
      setVaultNotice(t("vault.backupCreated"));
    } catch (reason) {
      setVaultError(messageOf(reason));
    } finally {
      setBackingUp(false);
    }
  }

  async function handleExportVault() {
    setExporting(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const report = await exportVault();
      if (!report) {
        return;
      }
      setVaultNotice(
        t("vault.exportReady", {
          fileName: report.fileName,
          rows: report.rows,
          sha: report.sha256.slice(0, 16),
        }),
      );
    } catch (reason) {
      setVaultError(messageOf(reason));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportVault() {
    setImporting(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const outcome = await importVault();
      if (!outcome) {
        return;
      }
      setVault(outcome.status);
      setTasks(await listTasks());
      setTaskError(null);
      setVaultNotice(
        t("vault.importDone", {
          fileName: outcome.fileName,
          rows: outcome.rows,
          attachments: outcome.attachments,
        }),
      );
    } catch (reason) {
      setVaultError(messageOf(reason));
    } finally {
      setImporting(false);
    }
  }

  async function handleRestoreBackup() {
    setRestoring(true);
    setVaultError(null);
    setVaultNotice(null);
    try {
      const status = await restoreMainBackup();
      setVault(status);
      setTasks(await listTasks());
      setTaskError(null);
      setVaultNotice(t("vault.restoreDone"));
    } catch (reason) {
      setVaultError(messageOf(reason));
    } finally {
      setRestoring(false);
    }
  }

  async function handleCreateTask(title: string): Promise<boolean> {
    setTaskError(null);
    try {
      await createTask(title);
      setTasks(await listTasks());
      return true;
    } catch (reason) {
      setTaskError(messageOf(reason));
      return false;
    }
  }

  async function handleToggleTask(task: Task): Promise<boolean> {
    setTaskError(null);
    try {
      await setTaskDone(task.id, task.status !== "done");
      setTasks(await listTasks());
      return true;
    } catch (reason) {
      setTaskError(messageOf(reason));
      return false;
    }
  }

  async function handleDeleteTask(task: Task): Promise<boolean> {
    setTaskError(null);
    try {
      await deleteTask(task.id);
      setTasks(await listTasks());
      return true;
    } catch (reason) {
      setTaskError(messageOf(reason));
      return false;
    }
  }

  function navigate(section: SectionId) {
    setActive(section);
    const groupId = groupForSection(section);
    setExpandedGroups((current) => {
      if (current.has(groupId)) {
        return current;
      }
      const next = new Set(current);
      next.add(groupId);
      return next;
    });
  }

  function toggleGroup(groupId: NavGroupId) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  return (
    <div className="app">
      <ResizeHandles />
      <header className="topbar" data-tauri-drag-region="deep">
        <div className="brand">
          <img
            src="/study-planner.png"
            alt=""
            className="brand-mark"
            width={30}
            height={30}
          />
          <span className="brand-name">Study Planner</span>
        </div>
        <div className="topbar-end">
          <div className="topbar-meta">
            <span className="quiet">{t("app.tagline")}</span>
            <span className="version">{info ? `v${info.version}` : null}</span>
          </div>
          <WindowControls />
        </div>
      </header>

      <div className="shell">
        <nav className="nav-rail" aria-label={t("nav.aria")}>
          {navGroups.map((group) => {
            const expanded = expandedGroups.has(group.id);
            const panelId = `nav-group-${group.id}`;
            return (
              <div
                className={`nav-group${
                  expanded ? " is-expanded" : " is-collapsed"
                }`}
                key={group.id}
              >
                <button
                  type="button"
                  className="nav-group-toggle"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={t(
                    expanded ? "nav.collapseGroup" : "nav.expandGroup",
                    { group: t(`nav.groups.${group.id}`) },
                  )}
                  title={t(`nav.groups.${group.id}`)}
                  onClick={() => toggleGroup(group.id)}
                >
                  <Icon name={group.icon} />
                  <span className="nav-group-label">
                    {t(`nav.groups.${group.id}`)}
                  </span>
                  <svg
                    className="nav-group-chevron"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M5 7.5 10 12.5 15 7.5" />
                  </svg>
                </button>
                <div className="nav-group-items" id={panelId}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-item${
                        active === item.id ? " is-active" : ""
                      }`}
                      aria-current={active === item.id ? "page" : undefined}
                      aria-label={t(`nav.${item.id}`)}
                      title={t(`nav.${item.id}`)}
                      onClick={() => navigate(item.id)}
                    >
                      <Icon name={item.icon} />
                      <span>{t(`nav.${item.id}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <main className="main">
          {error ? (
            <p className="notice error" role="alert">
              {error}
            </p>
          ) : null}

          {active === "today" ? (
            <TodayView
              vault={vault}
              tasks={tasks}
              onOpenTasks={() => navigate("tasks")}
              onOpenVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
              onToggleTask={handleToggleTask}
            />
          ) : null}

          {active === "tasks" ? (
            <TasksView
              vault={vault}
              tasks={tasks}
              error={taskError}
              onGoVault={() => navigate("vault")}
              onCreate={handleCreateTask}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onTasksChanged={setTasks}
            />
          ) : null}

          {active === "subjects" ? (
            <AcademicView vault={vault} onGoVault={() => navigate("vault")} />
          ) : null}

          {active === "schedule" ? (
            <ScheduleView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
            />
          ) : null}

          {active === "calendar" ? (
            <CalendarView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
              onBack={() => navigate("today")}
            />
          ) : null}

          {active === "exams" ? (
            <ExamsView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
            />
          ) : null}

          {active === "grades" ? (
            <GradesView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
            />
          ) : null}

          {active === "study" ? (
            <StudyView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
              onGoStrengths={() => navigate("strengths")}
            />
          ) : null}

          {active === "strengths" ? (
            <StrengthsView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoSubjects={() => navigate("subjects")}
              onGoExams={() => navigate("exams")}
            />
          ) : null}

          {active === "stats" ? (
            <StatsView
              vault={vault}
              onGoVault={() => navigate("vault")}
              onGoStrengths={() => navigate("strengths")}
            />
          ) : null}

          {active === "vault" ? (
            <VaultView
              vault={vault}
              error={vaultError ?? vault?.message ?? null}
              notice={vaultNotice}
              choosing={choosing}
              backingUp={backingUp}
              exporting={exporting}
              importing={importing}
              restoring={restoring}
              onChoose={handleChooseVault}
              onCreateBackup={handleCreateBackup}
              onExport={handleExportVault}
              onImport={handleImportVault}
              onRestore={handleRestoreBackup}
            />
          ) : null}

          {active === "settings" ? (
            <SettingsView
              vault={vault}
              onGoVault={() => navigate("vault")}
              themeMode={themeMode}
              accent={accent}
              onThemeModeChange={setThemeMode}
              onAccentChange={setAccent}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;
