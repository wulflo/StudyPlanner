# Study Planner — User Guide

**English** · [Español](USER_GUIDE.es.md)

Study Planner is a local academic organizer: academic years, terms, subjects,
weekly schedules, attendance, exams, grades, tasks, Pomodoro sessions, spaced
review and statistics. Everything lives in a SQLite vault on your device. There
are no accounts, no cloud and no telemetry.

- [1. Install and first run](#1-install-and-first-run)
- [2. The vault](#2-the-vault)
- [3. Navigating the app](#3-navigating-the-app)
- [4. Today](#4-today)
- [5. Calendar](#5-calendar)
- [6. Tasks](#6-tasks)
- [7. Subjects](#7-subjects)
- [8. Schedule and attendance](#8-schedule-and-attendance)
- [9. Exams and topics](#9-exams-and-topics)
- [10. Grades](#10-grades)
- [11. Study and Pomodoro](#11-study-and-pomodoro)
- [12. Strengths and spaced review](#12-strengths-and-spaced-review)
- [13. Statistics](#13-statistics)
- [14. Backups, restore, export and import](#14-backups-restore-export-and-import)
- [15. Settings](#15-settings)
- [16. Data, privacy and offline use](#16-data-privacy-and-offline-use)
- [17. Troubleshooting](#17-troubleshooting)

## 1. Install and first run

Study Planner is distributed for Linux, Windows and macOS.

| Platform | Package |
| :--- | :--- |
| Linux | AppImage, `.deb`, `.rpm`, or the strict Snap `study-planner` |
| Windows | NSIS installer, MSI, or MSIX (Microsoft Store) |
| macOS | `.dmg` |

Typical installation:

- **AppImage** — make it executable (`chmod +x Study-Planner*.AppImage`) and run it.
- **Debian/Ubuntu** — `sudo apt install ./study-planner_*.deb`.
- **Fedora/openSUSE** — `sudo dnf install ./study-planner-*.rpm`.
- **Snap** — `sudo snap install study-planner`.
- **Windows/macOS** — run the installer and open the app.

On first launch the app asks you to choose a vault folder. Nothing is stored
until you do. If you only want to inspect the interface, the web build
(`npm run dev`) works, but the folder picker and all data features require the
desktop app (`npm run tauri dev` or an installed package).

Requirements for building from source are listed in the
[README](../README.md#requirements).

## 2. The vault

The vault is the folder where Study Planner keeps your data. Choose a folder
outside the repository; the app validates it and locks it against a second
instance.

```text
<vault>/omega/                        live database, primary backup, attachments
<vault>/longlife/<device>/<date>/     daily snapshots (last 7 per device)
```

- **omega** holds the SQLite database with every record plus the verified main
  backup. It is the single source of truth.
- **longlife** holds daily snapshots. Incomplete snapshots are discarded.
- The full path is never shown in the interface; only the folder name is used.
- To move your data, choose another folder and import an export, or copy the
  whole vault folder while the app is closed.

The **Vault** section also shows diagnostics: schema version, SQLite integrity,
foreign-key violations, device identifier and vault identifier.

> **No encryption.** The database is not encrypted. Confidentiality depends on
> your operating system's full-disk encryption and on who can access the device.

## 3. Navigating the app

The sidebar groups sections into collapsible parents:

| Group | Sections |
| :--- | :--- |
| Daily | Today, Calendar, Tasks |
| Academics | Subjects, Schedule, Exams, Grades |
| Study | Study, Strengths, Statistics |
| System | Vault, Settings |

- Only the group of the active section opens by default; click a group title to
  expand or collapse it.
- The choice is remembered on this device.
- Selecting a section opens its group automatically.
- In narrow windows the sidebar becomes an icon rail. On very narrow windows it
  becomes a horizontal scrolling bar.

Every section starts with a short description. When the vault is not configured,
data sections show a **Vault required** panel with a direct shortcut to the
Vault section.

## 4. Today

The Today view is the home screen:

- **Pending tasks** — open tasks with a checkbox to complete them directly, plus
  a shortcut to the Tasks section.
- **Next steps** — shortcuts to the sections you use most.
- **Principles** — a short reminder of how the app stores and protects data.

## 5. Calendar

The Calendar is a local monthly view of exams and tasks by date.

- Use **← Previous**, **Next →** and **Today** to move between months.
- Each day lists exams (`Exam · title (subject)`) and tasks (`Task · title`).
- The calendar does not sync with external calendars and makes no network
  requests.
- If there are no subjects yet, the view offers a shortcut to create them.

## 6. Tasks

The Tasks section stores tasks, practical work, projects and personal items.

### Create a task

1. Type a title in **New task** and press **Add** for a quick task.
2. Open **More options** to fill the full form:
   - title, subject, parent task (creates a subtask), type and priority;
   - status (`Pending`, `In progress`, `Done`);
   - start date, due date, time and estimated minutes;
   - description and tags;
   - recurrence: `Daily`, `Weekly` or `Monthly`, an interval (`Every N`) and an
     optional end date (`Until`).
3. Save with **Create task** or **Save changes**.

Recurring tasks generate their next occurrence when the current one is
completed. Monthly recurrence uses the last day of shorter months.

### Organize

- **Tags** — create and delete tags; assign them in the task form.
- **Search and filter** — filter by text (title, description or tags), status
  (including an `Open` group), priority and tag. **Clear** resets everything.
- **Saved filters** — give the current filter a name and use **Save filter** to
  reuse it later.

### Complete, edit and delete

- Use the checkbox to complete or reopen a task.
- Use **Edit** to change any field.
- Deleting a task shows an **Undo** panel for 5 minutes. Restoring brings back
  the task and its active links.

## 7. Subjects

The Subjects section builds the academic structure that every other section
uses.

### Academic years and terms

1. Create an **academic year** with a name, start date and end date.
2. Create one or more **terms** inside it. A term has a name, a kind
   (`Semester`, `Trimester`, `Quarter`, `Bimonth`, `Annual`, `Other`) and a date
   range.
3. Create **subjects** inside the selected term: name, code, teacher, room,
   credits, minimum attendance percentage and color.

The color identifies the subject in the weekly grid and in progress views.
Deleting a year, term or subject is blocked while it still has dependent data.

### Study plan (degree cycles)

Below the term list, the **Study plan** panel tracks your degree independently
of terms:

1. Create a **cycle** with a name and an order number.
2. Add **plan subjects** to a cycle: name, optional code, order and an
   **approved** checkbox.
3. Check a subject to mark it as approved. Approved rows stay visible with
   strikethrough and muted color; uncheck to undo.
4. Each cycle shows `approved / total` and the panel shows the overall progress.

Editing an approved subject keeps its approval. Ordering is explicit through the
**Order** field; drag and drop is not used.

## 8. Schedule and attendance

### Weekly grid

Choose a term to see its week. The grid shows one column per day and tonal
blocks per class, colored with the subject color. Use the week navigation to
move between weeks; **Today** returns to the current week. The next upcoming
class is highlighted, and today's classes appear with attendance controls.

### Time slots

Add a slot with:

- subject, day of week, start time and end time;
- recurrence: `Weekly` or `Biweekly`;
- rotation (optional);
- valid-from and valid-to dates (optional);
- room (optional).

The app rejects a slot whose end time is not after its start time.

### Rotations

Rotations alternate the week's classes. Configure:

- **Mode** — `Weekly A/B`, `Week parity` or `Day cycle`;
- **Anchor** — the date that starts the count;
- **Cycle** — the sequence, for example `1, 2, 3, 4`;
- **Labels** — the names shown for each step, for example `A, B`.

`Weekly A/B` advances by ISO week, `Week parity` uses even/odd weeks, and
`Day cycle` advances one step per weekday (weekends do not consume a step).

### Holidays and exceptions

- **Holidays** — add a date and a name. Classes on that date are cancelled.
- **Exceptions** — per slot and date:
  - `Cancelled` removes the class;
  - `Moved` replaces its start time, end time and/or room;
  - `Extra` adds a class that has no base slot.

### Attendance

For each class you can mark **Present**, **Absent**, **Late** or **Justified**.
Present, late and justified count as attendance; absent does not. If a subject
has a minimum attendance percentage, the section warns when it falls below the
threshold.

## 9. Exams and topics

Choose a subject to manage its exams and topics.

### Exams

Create an exam with title, date, start and end time, room, weight (%), score,
maximum score, result and notes. Results can be `Pending`, `Passed`, `Failed` or
`Absent`. The list shows the weight and, when recorded, the score.

### Topics

Topics are hierarchical and belong to the subject:

- create a topic with a name, an optional parent topic and a description;
- subtopics appear indented under their parent;
- topics feed the Strengths, Study priority and Statistics sections.

## 10. Grades

Grades are calculated with integer arithmetic (centipoints and basis points), so
results are deterministic.

### Scales

A scale defines the range and pass mark:

- name, minimum, maximum, pass mark and decimals;
- **default** marks the scale used when none is chosen;
- **Create 0–100 scale** adds a ready-to-use scale and marks it as default.

### Categories

Each subject has weighted categories:

- name, scale, weight (%) and **Drop** (how many lowest entries to discard).

### Entries

Record a grade with title, category, score, maximum, optional weight and date.
A score cannot be negative or exceed its maximum.

### How the final average is computed

1. Each entry becomes a percentage: `score / maximum`.
2. Inside a category, the lowest entries are dropped by ascending percentage,
   then ascending date (undated last), then identifier. At least one entry is
   always kept.
3. The category average is weighted by the category weight.
4. The final result is mapped to the selected scale between its minimum and
   maximum, and compared with the pass mark.

The Grades view shows the final average, a progress bar, whether the subject is
passed, and a per-category breakdown including dropped entries.

## 11. Study and Pomodoro

The Study section combines a timer, an explainable priority queue and a session
history.

### Pomodoro

1. Choose a mode: `Pomodoro`, `Free` or `Review`.
2. Set the planned minutes (1–240; 25 by default).
3. Optionally choose a subject and a topic.
4. Press **Start**, then **Pause** / **Resume** as needed.
5. **Finish session** saves the elapsed minutes; **Discard** throws it away.

When the planned time ends, the app notifies you and lets you close the session
or continue in free mode. The timer uses the device's local clock.

### Priority queue

The queue tells you what to study first. The score is deterministic and each row
shows its reasons:

- weak topic `+4000`, neutral `+2000`, strength `+500`;
- overdue review: `+3000` plus up to `200` per overdue day (capped by the decay
  window, 7 days by default);
- review due within the decay window: more points the closer it is;
- exam within the decay window: more points the closer it is.

Ties are broken by topic identifier. The queue needs topics created in Exams.

### History

Recent sessions show mode, actual minutes, interruptions and date. You can
delete a session; totals and streaks update accordingly.

## 12. Strengths and spaced review

The Strengths section self-assesses topics and schedules review.

### Self-assessment

Choose a subject, then a topic. Record a score from 1 to 5 and an optional note.
The automatic classification projects the score to a percentage:

- **Weak** at or below 40 %;
- **Strength** at or above 70 %;
- **Neutral** in between;
- **Neutral** when the topic has no assessment.

The thresholds are stored as portable settings.

### Manual override

You can override the automatic classification with `Weak`, `Neutral` or
`Strength` and an optional reason. The override wins over the automatic result
until you remove it.

### Spaced review (SM-2)

Each topic keeps its ease factor, interval, repetitions, lapses and next review
date. Recording a review with quality 1–5 applies SM-2:

- ease starts at 2.50 and never drops below 1.30;
- quality below 3 resets repetitions, counts a lapse and sets a 1-day interval;
- quality 3 or more uses intervals of 1 day, then 6 days, then
  `round(interval × ease)`;
- the next review date is the review date plus the interval.

You can also set a review date manually with **Schedule review**. Reviews feed
the priority queue, the Statistics section and local reminders.

## 13. Statistics

Choose a period: **Last 7 days**, **Last 30 days** or **All history**.

- **Time** — total minutes and number of sessions.
- **Consistency** — current streak and all-time best streak.
- **Reviews** — reviews due today or earlier.
- **Time per subject** — horizontal bars with minutes and session counts.
- **Weak subjects** — subjects with weak topics, with a direct link to Strengths.
- **Upcoming reviews** — overdue first, then the next 30 days.

Statistics are calculated from stored sessions and self-assessments; nothing is
sent anywhere.

## 14. Backups, restore, export and import

### Main backup

- **Create backup now** makes an online SQLite copy and verifies it with SHA-256,
  `integrity_check` and `foreign_key_check`.
- The Vault section shows size, integrity, modification date, snapshot count and
  the backup SHA-256.
- A backup is created before every migration and before every restore.

### Restore

**Restore main backup** replaces live data with the verified backup. Before doing
so, the app creates a `pre-restore-*` backup of the current state. Restoring is
confirmed explicitly.

### Snapshots

Daily snapshots live in `longlife/<device>/<date>/`. The last 7 per device are
kept; incomplete snapshots are discarded.

### Export

**Export vault** writes a single canonical `.txt` file containing every table,
attachments and a checksum. The format is documented in
[`EXPORT_FORMAT.md`](EXPORT_FORMAT.md).

> The export is **not encrypted**: it contains all your data in plain text,
> including attachments. Store it somewhere safe.

### Import

**Import into empty vault** is only enabled when the vault has no domain data.
The import is transactional: if anything fails, no partial data is left behind.
Importing into a non-empty vault is blocked by design.

The round-trip guarantee is: export → import into an empty vault → export
produces identical bytes within the same version.

## 15. Settings

### Appearance

- **Mode** — `System` follows the desktop preference; `Light` and `Dark` force
  the theme.
- **Accent color** — violet, blue, teal, green, amber, orange, pink or red.
- Both choices are saved on this device.

### Language

- The interface is available in **English** (default) and **Spanish**.
- The choice is saved on this device and in the vault, so it can travel with
  your data.
- Dates and numbers follow the selected language.

### Background mode

**Keep running in the background** keeps the app in the system tray when you
close the window, so reminders keep working. Use **Quit** on the tray icon to
close it completely. If the desktop has no tray, closing the window ends the
process and Settings says so.

### Notifications

Local reminders cover classes, tasks, exams and reviews:

- **Enable reminders** turns the scheduler on.
- Lead times: classes 10 minutes before, tasks 60 minutes before, exams 24 hours
  before; reviews fire when their due date has passed.
- **Reminder sound** requests the desktop's standard notification sound.
- **Check reminders** runs the scheduler immediately.
- **Send test notification** verifies delivery.
- The delivered list shows recent reminders.

Reminders are calculated in the vault and delivered by the Rust host over D-Bus.
The webview asks for no system permissions and makes no network requests. The
scheduler runs every 60 seconds while the process is alive; it does not run when
the app is closed.

### Updates

The updater is isolated in Rust, opt-in, and uses a fixed host with mandatory
signature verification.

- **Check for updates on startup** is disabled by default and requires a
  configured vault.
- **Check for updates** reads the fixed manifest; it never sends vault data.
- **Install** downloads and verifies the package, then installs it. On Linux the
  system package manager may ask for your administrator password; on Windows the
  app closes to finish; on macOS it reopens.
- **Restore previous version** rolls back when a previous version is available.

The updater is disabled in development builds, when no production public key is
configured, and for Snap and MSIX installations (their stores handle updates).

## 16. Data, privacy and offline use

- No accounts, no cloud, no telemetry.
- The webview has no file, SQL, shell, dialog or HTTP permissions.
- The only network module is the isolated updater, with a fixed URL and
  signature verification.
- The vault is a plain SQLite database; the export is plain text.
- Deleting a record is logical (a deletion timestamp), so backups and exports
  remain consistent.
- Nothing is written outside the vault folder and the app's local configuration.

See [`OFFLINE.md`](OFFLINE.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) for the
technical details.

## 17. Troubleshooting

| Symptom | Cause and fix |
| :--- | :--- |
| The folder picker is disabled | You are running the browser build. Use the desktop app. |
| "Vault required" in a section | Choose a folder in Vault first. |
| Import is blocked | The vault already has data. Import only works into an empty vault. |
| A subject, term or year will not delete | It still has dependent records. Delete the dependants first. |
| Attendance warns below the minimum | The subject has a minimum attendance percentage and the recorded classes are below it. |
| No reminders arrive | Enable reminders, keep the app open or in the background, and check the desktop notification service (D-Bus on Linux). |
| The window closes instead of staying in the tray | The desktop has no tray support; install `libayatana-appindicator3` on Linux. |
| The updater is disabled | Development build, missing public key, Snap or MSIX installation. |
| The language changed on another device | The language is stored per device and in the vault; the last choice wins. |
| A backup or export looks old | Backups are created on demand, before migrations and before restores; snapshots are daily. |

If the database reports an integrity problem, stop using the vault, copy the
whole folder somewhere safe, and restore the verified backup or import a recent
export.

---

Related documentation: [`README`](../README.md) ·
[`ARCHITECTURE`](ARCHITECTURE.md) · [`DATA_MODEL`](DATA_MODEL.md) ·
[`EXPORT_FORMAT`](EXPORT_FORMAT.md) · [`NOTIFICATIONS`](NOTIFICATIONS.md) ·
[`UPDATER`](UPDATER.md)
