import { format, subDays } from "date-fns";
import { useEffect, useState } from "react";
import { useTranslation } from "../lib/i18n";
import { getStudyStats, type StudyStats, type VaultStatus } from "../lib/ipc";

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

type Period = "7" | "30" | "all";

export function StatsView({
  vault,
  onGoVault,
  onGoStrengths,
}: {
  vault: VaultStatus | null;
  onGoVault: () => void;
  onGoStrengths: () => void;
}) {
  const { t } = useTranslation();
  const ready = vault?.ready === true;
  const [period, setPeriod] = useState<Period>("30");
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from =
    period === "all"
      ? null
      : format(subDays(new Date(), Number(period) - 1), "yyyy-MM-dd");

  function percentText(valueBp: number | null): string {
    return valueBp === null
      ? t("common.noData")
      : `${(valueBp / 100).toFixed(0)} %`;
  }

  function minutesText(minutes: number): string {
    if (minutes < 60) {
      return t("stats.minutesText", { minutes });
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0
      ? t("stats.hoursText", { hours })
      : t("stats.hoursMinutesText", { hours, minutes: rest });
  }

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getStudyStats(from, todayIso());
        if (!cancelled) {
          setStats(loaded);
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
  }, [ready, from]);

  return (
    <>
      <section className="hero section-hero">
        <p className="eyebrow">{t("stats.eyebrow")}</p>
        <h1>{t("stats.title")}</h1>
        <p className="hero-copy">{t("stats.copy")}</p>
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
          <p>{t("stats.noVaultBody")}</p>
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

          <section className="academic-panel">
            <label className="field narrow">
              <span>{t("stats.period")}</span>
              <select
                className="select-field"
                aria-label={t("stats.periodAria")}
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
              >
                <option value="7">{t("stats.last7")}</option>
                <option value="30">{t("stats.last30")}</option>
                <option value="all">{t("stats.allHistory")}</option>
              </select>
            </label>
            <div className="study-summary">
              <span className="status-pill">
                {t("stats.sessions", {
                  count: stats?.totals.sessionCount ?? 0,
                })}
              </span>
              <span className="status-pill">
                {t("stats.streakDays", {
                  count: stats?.totals.currentStreakDays ?? 0,
                })}
              </span>
              <span className="status-pill">
                {t("stats.dueReviews", { count: stats?.dueReviews ?? 0 })}
              </span>
            </div>
          </section>

          {!stats || stats.totals.sessionCount === 0 ? (
            <section className="next-card">
              <p className="eyebrow">{t("stats.noSessionsEyebrow")}</p>
              <h2>{t("stats.noSessionsTitle")}</h2>
              <p>{t("stats.noSessionsBody")}</p>
            </section>
          ) : (
            <>
              <section
                className="study-cards"
                aria-label={t("stats.totalsAria")}
              >
                <article className="card">
                  <span className="card-kicker">{t("stats.timeKicker")}</span>
                  <h2>{minutesText(stats.totals.totalMinutes)}</h2>
                  <p>
                    {t("stats.sessionsRegistered", {
                      count: stats.totals.sessionCount,
                    })}
                  </p>
                </article>
                <article className="card">
                  <span className="card-kicker">
                    {t("stats.consistencyKicker")}
                  </span>
                  <h2>
                    {t("stats.days", { count: stats.totals.currentStreakDays })}
                  </h2>
                  <p>
                    {t("stats.streakBody", {
                      count: stats.totals.longestStreakDays,
                    })}
                  </p>
                </article>
                <article className="card">
                  <span className="card-kicker">
                    {t("stats.reviewsKicker")}
                  </span>
                  <h2>{stats.dueReviews}</h2>
                  <p>{t("stats.dueToday")}</p>
                </article>
              </section>

              <section className="status-card">
                <div>
                  <p className="eyebrow">{t("stats.timeBySubject")}</p>
                  <h2>{t("stats.hoursTitle")}</h2>
                </div>
                <ul
                  className="bar-list"
                  aria-label={t("stats.minutesBySubjectAria")}
                >
                  {stats.minutesBySubject.map((item) => {
                    const max = Math.max(
                      ...stats.minutesBySubject.map((entry) => entry.minutes),
                      1,
                    );
                    const width = Math.round((item.minutes / max) * 100);
                    return (
                      <li key={item.subjectId ?? "sin-materia"}>
                        <div className="bar-head">
                          <strong>
                            {item.subjectName ?? t("common.noSubject")}
                          </strong>
                          <span className="quiet">
                            {minutesText(item.minutes)} ·{" "}
                            {t("stats.sessionsCount", {
                              count: item.sessions,
                            })}
                          </span>
                        </div>
                        <div className="bar-track" aria-hidden="true">
                          <span style={{ width: `${width}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <div className="study-layout">
            <section className="status-card">
              <div>
                <p className="eyebrow">{t("stats.weakSubjects")}</p>
                <h2>{t("stats.weakTitle")}</h2>
                <p className="quiet">{t("stats.weakBody")}</p>
                <button
                  type="button"
                  className="button tonal"
                  onClick={onGoStrengths}
                >
                  {t("common.goToStrengths")}
                </button>
              </div>
              {!stats || stats.weakSubjects.length === 0 ? (
                <p className="quiet">{t("stats.noWeak")}</p>
              ) : (
                <ul className="mini-list" aria-label={t("stats.weakListAria")}>
                  {stats.weakSubjects.map((item) => (
                    <li key={item.subjectId} className="mini-item">
                      <div>
                        <strong>{item.subjectName}</strong>
                        <span className="quiet">
                          {t("stats.weakLine", {
                            weak: item.weakTopics,
                            total: item.topicCount,
                            average: percentText(item.averageScoreBp),
                          })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="status-card">
              <div>
                <p className="eyebrow">{t("stats.upcomingReviews")}</p>
                <h2>{t("stats.agendaTitle")}</h2>
                <p className="quiet">{t("stats.agendaBody")}</p>
              </div>
              {!stats || stats.upcomingReviews.length === 0 ? (
                <p className="quiet">{t("stats.noUpcoming")}</p>
              ) : (
                <ul className="mini-list" aria-label={t("stats.upcomingAria")}>
                  {stats.upcomingReviews.map((review) => (
                    <li key={review.topicId} className="mini-item">
                      <div>
                        <strong>{review.topicName}</strong>
                        <span className="quiet">
                          {t("stats.reviewLine", {
                            subject: review.subjectName,
                            date: review.dueDate,
                            relative:
                              review.daysUntil < 0
                                ? t("stats.overdue", {
                                    count: Math.abs(review.daysUntil),
                                  })
                                : review.daysUntil === 0
                                  ? t("stats.today")
                                  : t("stats.inDays", {
                                      count: review.daysUntil,
                                    }),
                          })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
