import { type CSSProperties, useEffect, useState } from "react";
import {
  type AppLanguage,
  intlLocale,
  LANGUAGES,
  normalizeLanguage,
  setAppLanguage,
  useTranslation,
} from "../lib/i18n";
import {
  type BackgroundStatus,
  checkUpdates,
  getBackgroundStatus,
  getNotificationStatus,
  getUpdaterStatus,
  installUpdate,
  type NotificationStatus,
  openRepository,
  rollbackUpdate,
  runNotificationScan,
  runningInTauri,
  sendTestNotification,
  setAppLocale,
  setBackgroundMode,
  setNotificationsEnabled,
  setNotificationsSound,
  setUpdaterAutoCheck,
  type UpdateInfo,
  type UpdaterStatus,
  type VaultStatus,
} from "../lib/ipc";
import {
  ACCENTS,
  type AccentId,
  THEME_MODES,
  type ThemeMode,
} from "../lib/theme";

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function eventTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString(intlLocale());
}

export function SettingsView({
  vault,
  onGoVault,
  themeMode,
  accent,
  onThemeModeChange,
  onAccentChange,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
  themeMode: ThemeMode;
  accent: AccentId;
  onThemeModeChange: (mode: ThemeMode) => void;
  onAccentChange: (accent: AccentId) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.language);
  const ready = vault?.ready === true;
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [background, setBackground] = useState<BackgroundStatus | null>(null);
  const [notifications, setNotifications] = useState<NotificationStatus | null>(
    null,
  );
  const [candidate, setCandidate] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [notifying, setNotifying] = useState(false);

  async function handleOpenRepository() {
    try {
      await openRepository();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function loadCore() {
    const [loadedStatus, loadedBackground] = await Promise.all([
      getUpdaterStatus(),
      getBackgroundStatus(),
    ]);
    setStatus(loadedStatus);
    setBackground(loadedBackground);
  }

  async function loadVaultData() {
    const loadedNotifications = await getNotificationStatus();
    setNotifications(loadedNotifications);
  }

  async function load() {
    try {
      await loadCore();
      if (ready) {
        await loadVaultData();
      }
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const [loadedStatus, loadedBackground] = await Promise.all([
          getUpdaterStatus(),
          getBackgroundStatus(),
        ]);
        if (!cancelled) {
          setStatus(loadedStatus);
          setBackground(loadedBackground);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }

      if (!ready) {
        return;
      }

      try {
        const loadedNotifications = await getNotificationStatus();
        if (!cancelled) {
          setNotifications(loadedNotifications);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(messageOf(reason));
        }
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function handleToggleAutoCheck(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      setStatus(await setUpdaterAutoCheck(enabled));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBackground(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      setBackground(await setBackgroundMode(enabled));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setNotice(null);
    setCandidate(null);
    try {
      const found = await checkUpdates();
      setCandidate(found);
      setNotice(
        found
          ? t("settings.updateAvailable", { version: found.version })
          : t("settings.upToDate"),
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setChecking(false);
    }
  }

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await installUpdate();
      setCandidate(null);
      setNotice(
        `${t("settings.installed", { version: outcome.version })}${
          outcome.restartRequired ? t("settings.installedRestart") : ""
        }`,
      );
      await load();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setInstalling(false);
    }
  }

  async function handleRollback() {
    setInstalling(true);
    setError(null);
    setNotice(null);
    try {
      await rollbackUpdate();
      setNotice(t("settings.rollbackDone"));
      await load();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setInstalling(false);
    }
  }

  async function handleToggleNotifications(enabled: boolean) {
    setNotifying(true);
    setError(null);
    try {
      setNotifications(await setNotificationsEnabled(enabled));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setNotifying(false);
    }
  }

  async function handleToggleSound(enabled: boolean) {
    setNotifying(true);
    setError(null);
    try {
      setNotifications(await setNotificationsSound(enabled));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setNotifying(false);
    }
  }

  async function handleScanNotifications() {
    setNotifying(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await runNotificationScan();
      setNotifications(await getNotificationStatus());
      setNotice(
        `${t("settings.scanResult", { delivered: outcome.delivered, failed: "" })}${
          outcome.failed > 0
            ? t("settings.scanFailed", { failed: outcome.failed })
            : ""
        }`,
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setNotifying(false);
    }
  }

  async function handleTestNotification() {
    setNotifying(true);
    setError(null);
    setNotice(null);
    try {
      await sendTestNotification();
      setNotice(t("settings.testSent"));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setNotifying(false);
    }
  }

  const busy = saving || checking || installing || notifying;
  const snapManaged = status?.managedBySnap === true;
  const canInstall = status?.canInstall === true;
  const updaterBlockedReason = !status
    ? t("settings.updaterLoading")
    : snapManaged
      ? t("settings.snapBlocked")
      : !status.publicKeyConfigured
        ? t("settings.publicKeyBlocked")
        : !canInstall
          ? status.runtime === "development"
            ? t("settings.developmentBlocked")
            : t("settings.noAutoUpdates")
          : null;
  const canCheckUpdates = !busy && updaterBlockedReason === null;
  const runtimeLabel = status
    ? t(`settings.runtime.${status.runtime}`)
    : t("settings.unknown");
  // En MSIX el actualizador queda oculto: las actualizaciones las gestiona
  // Microsoft Store o el instalador de sideloading.
  const msix = status?.runtime === "msix";

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("settings.eyebrow")}</p>
        <h1>{t("settings.title")}</h1>
        <p className="hero-copy">{t("settings.copy")}</p>
        <div className="hero-actions">
          {ready ? (
            <span className="status-pill is-ok">
              {t("settings.vaultPill", {
                name: vault?.name ?? t("settings.vaultReady"),
              })}
            </span>
          ) : (
            <button type="button" className="button filled" onClick={onGoVault}>
              {t("common.configureVault")}
            </button>
          )}
          <button
            type="button"
            className="button tonal"
            disabled={!runningInTauri}
            title={
              runningInTauri
                ? t("settings.repositoryTitle")
                : t("settings.repositoryDesktop")
            }
            onClick={() => void handleOpenRepository()}
          >
            {t("settings.repository")}
          </button>
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

      <div className="study-layout">
        <section
          className="status-card settings-card appearance-card"
          aria-labelledby="appearance-title"
        >
          <div>
            <p className="eyebrow">{t("settings.appearanceEyebrow")}</p>
            <h2 id="appearance-title">{t("settings.appearanceTitle")}</h2>
            <p className="quiet">{t("settings.appearanceHint")}</p>
          </div>

          <div className="preference-block">
            <span className="preference-label">{t("settings.mode")}</span>
            <fieldset className="segmented" aria-label={t("settings.modeAria")}>
              {THEME_MODES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`segment${themeMode === option.id ? " is-selected" : ""}`}
                  aria-pressed={themeMode === option.id}
                  onClick={() => onThemeModeChange(option.id)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </fieldset>
          </div>

          <div className="preference-block">
            <span className="preference-label">{t("settings.accent")}</span>
            <fieldset
              className="accent-grid"
              aria-label={t("settings.accentAria")}
            >
              {ACCENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`accent-swatch${accent === option.id ? " is-selected" : ""}`}
                  style={{ "--swatch": option.swatch } as CSSProperties}
                  aria-label={t(option.labelKey)}
                  aria-pressed={accent === option.id}
                  title={t(option.labelKey)}
                  onClick={() => onAccentChange(option.id)}
                >
                  <span className="accent-dot" />
                  <span className="accent-name">{t(option.labelKey)}</span>
                </button>
              ))}
            </fieldset>
          </div>

          <div className="preference-block">
            <span className="preference-label">
              {t("settings.languageTitle")}
            </span>
            <fieldset
              className="segmented"
              aria-label={t("settings.languageAria")}
            >
              {LANGUAGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`segment${language === option.id ? " is-selected" : ""}`}
                  aria-pressed={language === option.id}
                  onClick={() => {
                    const next = option.id as AppLanguage;
                    void setAppLanguage(next);
                    // El idioma también se guarda en la bóveda para otros equipos;
                    // si la bóveda aún no está lista, localStorage ya lo conserva.
                    if (typeof setAppLocale === "function") {
                      void setAppLocale(next).catch(() => undefined);
                    }
                  }}
                >
                  {option.id === "es"
                    ? t("settings.spanish")
                    : t("settings.english")}
                </button>
              ))}
            </fieldset>
            <p className="quiet">{t("settings.languageHint")}</p>
          </div>

          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={background?.enabled ?? true}
              disabled={busy || !background}
              onChange={(event) =>
                void handleToggleBackground(event.target.checked)
              }
            />
            <span>
              <strong>{t("settings.backgroundTitle")}</strong>
              <span className="quiet">
                {t("settings.backgroundHint")}
                {background && !background.trayAvailable
                  ? t("settings.trayMissing")
                  : ""}
              </span>
            </span>
          </label>
          {!ready ? (
            <p className="quiet">{t("settings.backgroundNoVault")}</p>
          ) : null}
        </section>

        {!msix ? (
          <section
            className="status-card settings-card"
            aria-labelledby="updater-title"
          >
            <div>
              <p className="eyebrow">{t("settings.updaterEyebrow")}</p>
              <h2 id="updater-title">{t("settings.updaterTitle")}</h2>
              <p className="quiet">
                {t("settings.updaterMeta", {
                  version: status?.currentVersion ?? t("settings.unknown"),
                  host: status?.updateHost ?? "github.com",
                  runtime: runtimeLabel,
                })}
              </p>
            </div>

            {status && !status.publicKeyConfigured ? (
              <p className="notice">{t("settings.publicKeyNotice")}</p>
            ) : null}

            {snapManaged ? (
              <p className="notice">{t("settings.snapNotice")}</p>
            ) : null}

            {status?.runtime === "deb" || status?.runtime === "rpm" ? (
              <p className="quiet">{t("settings.debRpmNotice")}</p>
            ) : null}

            {status?.runtime === "windows" || status?.runtime === "macos" ? (
              <p className="quiet">{t("settings.windowsMacNotice")}</p>
            ) : null}

            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={status?.autoCheck ?? false}
                disabled={busy || !status || !ready || snapManaged}
                onChange={(event) =>
                  void handleToggleAutoCheck(event.target.checked)
                }
              />
              <span>
                <strong>{t("settings.autoCheckTitle")}</strong>
                <span className="quiet">
                  {t("settings.autoCheckHint")}
                  {!ready ? t("settings.autoCheckVaultRequired") : ""}
                </span>
              </span>
            </label>

            <div className="hero-actions">
              <button
                type="button"
                className="button filled"
                disabled={!canCheckUpdates}
                onClick={() => void handleCheck()}
              >
                {checking ? t("settings.checking") : t("settings.checkUpdates")}
              </button>
              {candidate ? (
                <button
                  type="button"
                  className="button tonal"
                  disabled={busy || !canInstall}
                  onClick={() => void handleInstall()}
                >
                  {installing
                    ? t("settings.installing")
                    : t("settings.installVersion", {
                        version: candidate.version,
                      })}
                </button>
              ) : null}
              {status?.canRollback ? (
                <button
                  type="button"
                  className="button"
                  disabled={busy || snapManaged}
                  onClick={() => void handleRollback()}
                >
                  {t("settings.rollback")}
                </button>
              ) : null}
            </div>

            {status &&
            updaterBlockedReason &&
            !snapManaged &&
            status.publicKeyConfigured ? (
              <p className="quiet">{updaterBlockedReason}</p>
            ) : null}

            {candidate ? (
              <div className="nested-card">
                <p className="eyebrow">{t("settings.newVersion")}</p>
                <h3>{candidate.version}</h3>
                {candidate.pubDate ? (
                  <p className="quiet">
                    {t("settings.published", { date: candidate.pubDate })}
                  </p>
                ) : null}
                <p>{candidate.notes || t("settings.noReleaseNotes")}</p>
              </div>
            ) : null}
          </section>
        ) : (
          <p className="quiet">{t("settings.msixNotice")}</p>
        )}

        {!ready ? (
          <section className="next-card">
            <p className="eyebrow">{t("settings.vaultRequiredEyebrow")}</p>
            <h2>{t("settings.vaultRequiredTitle")}</h2>
            <p>{t("settings.vaultRequiredBody")}</p>
            <div className="hero-actions">
              <button
                type="button"
                className="button filled"
                onClick={onGoVault}
              >
                {t("common.goToVault")}
              </button>
            </div>
          </section>
        ) : (
          <section
            className="status-card settings-card"
            aria-labelledby="notifications-title"
          >
            <div>
              <p className="eyebrow">{t("settings.notificationsEyebrow")}</p>
              <h2 id="notifications-title">
                {t("settings.notificationsTitle")}
              </h2>
              <p className="quiet">{t("settings.notificationsHint")}</p>
            </div>

            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={notifications?.enabled ?? false}
                disabled={busy || !notifications}
                onChange={(event) =>
                  void handleToggleNotifications(event.target.checked)
                }
              />
              <span>
                <strong>{t("settings.enableReminders")}</strong>
                <span className="quiet">
                  {t("settings.reminderDetails", {
                    class: notifications?.classLeadMinutes ?? 10,
                    task: notifications?.taskLeadMinutes ?? 60,
                    exam: notifications?.examLeadHours ?? 24,
                  })}
                </span>
              </span>
            </label>

            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={notifications?.sound ?? true}
                disabled={busy || !notifications}
                onChange={(event) =>
                  void handleToggleSound(event.target.checked)
                }
              />
              <span>
                <strong>{t("settings.soundTitle")}</strong>
                <span className="quiet">{t("settings.soundHint")}</span>
              </span>
            </label>

            <div className="hero-actions">
              <button
                type="button"
                className="button filled"
                disabled={busy || !notifications?.enabled}
                onClick={() => void handleScanNotifications()}
              >
                {notifying
                  ? t("settings.reviewing")
                  : t("settings.reviewReminders")}
              </button>
              <button
                type="button"
                className="button tonal"
                disabled={notifying}
                onClick={() => void handleTestNotification()}
              >
                {t("settings.testNotification")}
              </button>
            </div>

            {notifications && notifications.recent.length > 0 ? (
              <ul
                className="mini-list"
                aria-label={t("settings.deliveredAria")}
              >
                {notifications.recent.map((record) => (
                  <li key={record.id} className="mini-item">
                    <div className="mini-item-body">
                      <div className="mini-item-heading">
                        <strong>
                          {t(`settings.notificationKind.${record.kind}`, {
                            defaultValue: record.kind,
                          })}
                        </strong>
                      </div>
                      <span className="quiet mini-item-meta">
                        {eventTime(record.firedAt ?? record.scheduledAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet">{t("settings.noDelivered")}</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
