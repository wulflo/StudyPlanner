<div align="center">

<img src="public/study-planner.png" alt="Study Planner" width="112" />

# Study Planner

**Personal academic organization — strictly local.**

Schedules, subjects, exams, grades, tasks, notes, and spaced repetition in a single SQLite vault.
No accounts, no cloud, no telemetry.

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](#license)
[![Status: v0.2.5](https://img.shields.io/badge/status-v0.2.5-brightgreen.svg)](CHANGELOG.md)
[![Tauri 2.12](https://img.shields.io/badge/Tauri-2.12-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Platforms: Linux | Windows | macOS](https://img.shields.io/badge/platforms-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey.svg)](#requirements)

[English](README.md) · [Español](README.es.md) · [Releases](https://github.com/wulflo/StudyPlanner/releases) · [User guide](docs/USER_GUIDE.en.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

---

## Contents

- [Project status](#project-status)
- [Features](#features)
- [Design principles](#design-principles)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Installation](#installation)
- [Verification](#verification)
- [Documentation](#documentation)
- [Project structure](#project-structure)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Project status

> **Phases 0 through 5 are complete and released.** `v0.2.5` ships with a signed cross-platform updater, local notifications, and Microsoft Store packaging.

| Milestone | Highlights |
| :--- | :--- |
| **v0.2.5** | Deletion dead ends fixed (saved rotations, orphan attendance, tasks with subtasks); subjects from every year and term reachable across the app; the current term opens by default. |
| **v0.2.4** | Full UI/UX refinement: opaque borders, accent-derived surfaces, structured list rows, and a corrected Study layout. |
| **Distribution** | AppImage, `.deb`, `.rpm`, Snap, Windows (NSIS/MSI/MSIX), and macOS. |
| **Everyday use** | Light, dark, and system themes; accent colors; background tray mode; reminders with optional sound. |

## Features

**Plan and organize**

- **Today** — a single daily view of classes, due tasks, exams, and reviews.
- **Calendar** — month view mixing class sessions, exams, tasks, and spaced-repetition events.
- **Tasks** — subtasks, due dates, priorities, and categories.
- **Subjects** — academic years, terms, and degree study plans, with every subject reachable from every view.
- **Schedule** — weekly grid with time slots, rotations, holidays, exceptions, and per-slot attendance.

**Study and measure**

- **Exams and topics** — exam dates, topic tracking, and results that flow into grades.
- **Grades** — custom scales, weighted categories, and fixed-point precision for the final average.
- **Study and Pomodoro** — timer, an explainable priority queue, and session history.
- **Strengths and spaced review** — self-assessment, manual override, and SM-2 scheduling.
- **Statistics** — progress and performance across subjects and terms.

**Own and protect your data**

- **Verified continuity** — SHA-256, `integrity_check`, and `foreign_key_check` on every backup.
- **Full export** — one canonical `.txt` file can rebuild the entire vault, byte for byte.
- **Offline by design** — the UI never touches the network, and no data leaves the device.

## Design principles

- **Local first.** You choose a root folder (the vault), and the app creates `<vault>/omega` for live data and the verified primary backup, plus `<vault>/longlife` for daily snapshots. The path is validated and never changes silently.
- **Verified continuity.** Every backup is checked with SHA-256, `integrity_check`, and `foreign_key_check`. The app preserves the backup from before each migration, the last 7 snapshots per device, and a `pre-restore-*.db` backup before every restore.
- **No network in the UI.** The webview has no file, SQL, shell, dialog, or HTTP permissions. The only exception is the isolated Rust updater: opt-in, with a fixed URL and mandatory signature verification.
- **Full export.** A single canonical `.txt` file can rebuild the vault. `export → import → export` produces identical bytes on the same version, and imports are only accepted into an empty vault.
- **No vault encryption.** This is an explicit user decision. Confidentiality depends on the operating system's full-disk encryption and physical custody of the device.
- **Continuity.** Every phase leaves behind tests, a changelog, and `docs/CHECKLIST.md` so work can resume without internet access. Tauri's transitive MPL-2.0 dependency is accepted as a scoped exception (ADR-017); see `THIRD_PARTY_LICENSES.md`.

## Tech stack

| Layer | Technology |
| :--- | :--- |
| UI | React 19, TypeScript, Vite 8, Zustand, date-fns, Material Color Utilities |
| Host | Tauri 2.12 (Rust) |
| Persistence | SQLite via `rusqlite` (bundled), WAL, versioned migrations |
| Export | Rust (`study-planner-transfer`), custom canonical format |
| Updater | Isolated Rust crate (`study-planner-updater`), opt-in, minisign signatures |
| Packaging | AppImage, deb, rpm, exe/msi/msix, dmg, and a `strict` snap |
| Tests | Vitest + Testing Library; `cargo test` |

## Requirements

- **Linux x86_64** (tested on CachyOS/Arch). Windows x64 and macOS arm64 build and update, but do not have local notifications or OS-level code signing.
- **Node.js 22+** and npm.
- **Stable Rust 1.90+** with `cargo`.
- **WebKitGTK 4.1**, GTK 3, libsoup 3, and the rest of Tauri's Linux dependencies.
- On Linux, **`libayatana-appindicator3`** for the background-mode tray icon. Without it, the app still runs, but closing the window ends the process.
- **`rg` (ripgrep)** for `scripts/audit-network.sh`; the script falls back to `grep` when ripgrep is not installed.

## Installation

### Download

Grab the package for your platform from the [latest release](https://github.com/wulflo/StudyPlanner/releases):

| Platform | Packages |
| :--- | :--- |
| Linux | AppImage, `.deb`, `.rpm`, Snap |
| Windows | NSIS, MSI, MSIX |
| macOS | DMG |

### Build from source

```bash
git clone https://github.com/wulflo/StudyPlanner.git
cd StudyPlanner
npm install
npm run tauri dev
```

To run only the frontend, without the Tauri IPC layer:

```bash
npm run dev
```

## Verification

| Command | What it runs |
| :--- | :--- |
| `npm run check` | Type checking, linting, frontend tests, and a production build |
| `npm run check:all` | All of the above, plus Rust formatting, Clippy, and Rust tests |
| `./scripts/check.sh` | `check:all` plus the Tauri host check, Snap version check, and audits |
| `./scripts/audit-network.sh` | Static audit of network access, permissions, and secrets |

## Documentation

| Document | Contents |
| :--- | :--- |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | Status, phases, rules, and next steps |
| [`docs/USER_GUIDE.en.md`](docs/USER_GUIDE.en.md) | User guide (English) |
| [`docs/USER_GUIDE.es.md`](docs/USER_GUIDE.es.md) | Guía del usuario (español) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, security boundaries, and flows |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Schema and conventions |
| [`docs/EXPORT_FORMAT.md`](docs/EXPORT_FORMAT.md) | The `.txt` export contract |
| [`docs/UPDATER.md`](docs/UPDATER.md) | Design of the isolated updater |
| [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) | Local reminders, sound, and background mode |
| [`docs/RELEASE.md`](docs/RELEASE.md) | Cross-platform workflow, signing, and secrets |
| [`docs/SNAP.md`](docs/SNAP.md) | Strict snap, build, and publication |
| [`docs/KEYS.md`](docs/KEYS.md) | Signing-key custody |
| [`PRIVACY.md`](PRIVACY.md) | Privacy policy for the Microsoft Store |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisions and rejected alternatives |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Working without internet access |
| [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) | Licenses and exceptions |
| [`CHANGELOG.md`](CHANGELOG.md) | Changes by version |

## Project structure

```text
src/                           React UI
src-tauri/                     Tauri host, commands, CSP, and permissions
crates/study-planner-core/     pure domain, constants, IDs
crates/study-planner-store/    SQLite, migrations, backups
crates/study-planner-transfer/ export/import
crates/study-planner-updater/  isolated network access (Phase 5)
docs/                          persistent documentation
scripts/                       verification and auditing
fixtures/export/               round-trip fixtures
```

The vault lives outside the repository:

```text
<vault>/omega/                          live data, primary backup, attachments, and local log
<vault>/longlife/<device>/<date>/       daily snapshots (7 per device)
```

## Security

- No keys, passwords, or databases are stored in the repository.
- The snap uses `strict` confinement, only `home`/`removable-media`, and no network plugs; see `docs/SNAP.md`.
- Contributions that add network access, accounts, telemetry, or broad frontend permissions are not accepted.
- The updater's private key and passphrase are kept outside the repository; see `docs/KEYS.md`.
- If you find a security issue, use GitHub's [private advisory](https://github.com/wulflo/StudyPlanner/security/advisories/new). Do not open a public issue. See [`SECURITY.md`](SECURITY.md).

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, coding guidelines, test requirements, and the pull-request process.

## License

Released under **MIT OR Apache-2.0**. Platform dependencies (WebKitGTK/GTK) are LGPL and dynamically linked; see [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
