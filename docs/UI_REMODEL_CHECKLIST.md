# UI remodel — persistent checklist

> **Last updated:** 2026-11-22
> **Scope:** English-first locale, removal of development phase labels, custom select component, Material 3 visual refresh, collapsible sidebar, subjects study-plan tracker, bilingual documentation and tests.
> **Related:** [`CHECKLIST.md`](CHECKLIST.md) · [`USER_GUIDE.en.md`](USER_GUIDE.en.md) · [`USER_GUIDE.es.md`](USER_GUIDE.es.md)

This checklist is the single source of truth for resuming this UI remodel offline. Mark an item `[x]` only after the change is implemented **and** verified (test, `npm run check`, or a reproducible manual check). Keep short notes with the files touched.

## Working agreement (read before every part)

1. **One part at a time.** Do not mix the sidebar, the selectors, the study-plan tracker and the radius audit in the same change unless they are explicitly grouped below.
2. **Write before editing.** Add the files that will be touched to the running log *before* changing them, so an interrupted session can be resumed without guessing.
3. **Verify each part.** Run `npm run typecheck`, the focused Vitest file(s), and `npm run lint` before marking a block done. Run the full `npm run check` at the end of a phase.
4. **Keep the old behaviour.** Navigation ids, `nav.*` translation keys, IPC payloads and existing tests must keep working unless the item explicitly says otherwise.
5. **No remote assets.** No CDNs, remote fonts, HTTP calls from `src/`, or `backdrop-filter`.

### Part tracker

| Part | Scope | State |
| --- | --- | --- |
| 1 | Dropdown selectors + button radius | done (2026-11-22) |
| 2 | Collapsible sidebar with subsections | done 2026-11-22 |
| 3 | Subjects: degree cycles and approved-subject tracking | done (2026-11-22) |
| 4 | Study-plan row spacing + empty-state card padding | done (2026-11-22) |
| 5 | Release v0.2.2 (version bump, docs, tag, workflows) | done (2026-11-22) |

## Phase 0 — Continuity and baseline

- [x] Create this checklist and link it from `docs/CHECKLIST.md`.
  - Files: `docs/UI_REMODEL_CHECKLIST.md`, `docs/CHECKLIST.md`.
- [x] Record the baseline: `npm ci` and `npm run check` pass before changes.
  - Notes: baseline command output is stored in the work log; Rust workspace is checked separately with `cargo test --workspace`.
- [x] Confirm the offline/network rules: no remote fonts, no CDNs, no HTTP calls from `src/`, no `backdrop-filter`.
  - Files reviewed: `src/styles.css`, `src/App.tsx`, `src/lib/theme.ts`, `index.html`.
  - Verification: `bash scripts/audit-network.sh` green ("sin URLs remotas en la UI"); grep confirms no `backdrop-filter` in `src/` or `index.html` and no remote URLs in `src/`.

## Phase A — English as the default language

- [x] Change the frontend default to `en` while keeping `es` as a supported option.
  - Files: `src/lib/i18n.ts`, `src/locales/en.ts`, `src/locales/es.ts`.
- [x] Make the language choice persist in `localStorage` and in the vault `locale` setting.
  - Files: `src/lib/i18n.ts`, `src/lib/ipc.ts`, `src/views/SettingsView.tsx`, `src-tauri/src/vault.rs`, `src-tauri/src/lib.rs`.
  - Note: `SettingsView` now writes `setAppLocale` on every language change (best effort when the vault is not ready); startup reads `getAppLocale` when no local choice exists.
- [x] Add migration `0003` that updates the seeded `locale` value to `"en"` without editing `0001_initial.sql`.
  - Files: `crates/study-planner-store/migrations/0003_default_locale_english.sql`, `crates/study-planner-store/src/lib.rs`, `crates/study-planner-core/src/lib.rs`.
- [x] Verify checksum integrity: existing vaults migrate forward, new vaults seed `"en"`.
  - Verification: Rust migration test + `cargo test -p study-planner-store`.

## Phase B — Remove "Phase X" / "Fase X" labels

- [x] Remove phase wording from English and Spanish locale strings, eyebrows, badges and hints.
  - Files: `src/locales/en.ts`, `src/locales/es.ts`.
- [x] Rename the development-only `phase-chip` UI hook to a user-facing local chip.
  - Files: `src/App.tsx`, `src/styles.css`.
  - Note: `App.tsx` already used `local-chip`; the stale `.phase-chip` rule was renamed.
- [x] Remove phase comments from styles and source where they are visible or misleading.
  - Files: `src/styles.css`, `src/App.tsx`, all touched views.
- [x] Add a regression test that the rendered UI contains no "Fase"/"Phase" labels.
  - Files: `src/App.test.tsx`.

## Phase C — `CustomSelect`

- [x] Implement `src/components/CustomSelect.tsx` with trigger button + styled listbox.
  - Requirements: label, optional subtitle, optional color dot, `disabled`, internal scroll, keyboard (`Enter`, `Space`, `ArrowDown`, `ArrowUp`, `Escape`, `Home`, `End`), ARIA combobox/listbox/option, close on outside click and focus loss.
- [x] Export the compatible module `src/views/custom-select.ts`.
- [x] Replace every native `<select>` in `src/views/*.tsx`.
  - Files: `AcademicView`, `CalendarView`, `ExamsView`, `GradesView`, `ScheduleView`, `SettingsView`, `StatsView`, `StrengthsView`, `StudyView`, `TasksView`.
  - Note: `ScheduleView` still had 7 native selects; all were converted and its `required` slot check was made explicit in `submitException`.
- [x] Add unit tests for `CustomSelect`.
  - Files: `src/components/CustomSelect.test.tsx`.

## Phase D — Material 3 visual refresh

- [x] Generate complete light/dark CSS tokens from `@material/material-color-utilities` in `src/lib/theme.ts`.
  - Tokens: `--bg`, `--surface`, `--surface-container-low`, `--surface-container`, `--surface-container-high`, `--outline`, `--outline-variant`, `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--success`, `--warning`, `--danger`.
  - Note: the generated scheme is written to `--md-sys-color-*` custom properties; `src/styles.css` keeps the `--bg`/`--surface`/`--outline` aliases.
- [x] Define a spacing scale, modern radii (`10px` inputs/buttons, `14–16px` cards, `999px` badges/filters) and `150ms cubic-bezier(0.2, 0, 0, 1)` transitions.
  - Files: `src/styles.css`.
  - Verification: `--md-space-1..7`, `--md-radius-xs/sm/md/lg/xl/pill`, `--md-motion-duration: 150ms`, `--md-motion-ease: cubic-bezier(0.2, 0, 0, 1)`.
- [x] Remove every `backdrop-filter` and replace translucent window surfaces with solid tonal backgrounds.
  - Files: `src/styles.css`.
  - Verification: grep finds no `backdrop-filter` in `src/`; `scripts/audit-network.sh` green.
- [x] Modernize the app shell and title bar: grouped navigation, SVG icons, pill active state, fluid narrow-window collapse, aligned `WindowControls`.
  - Files: `src/App.tsx`, `src/styles.css`, `src/components/WindowControls.tsx`.
  - Verification: `Icon` SVG set, `navGroups` with `is-expanded`/`is-collapsed`, `.nav-item.is-active` pill, `<=1080px` icon rail, `<=760px` horizontal nav; browser screenshot at 912 px shows the icon rail with the active pill.
- [x] Unify inputs, textareas, buttons (primary, secondary, tonal, ghost, danger) and summary cards.
  - Files: `src/styles.css`, all views with forms.
- [x] Improve `TodaySchedule.tsx`: highlighted next-class card and pending checklist.
  - Files: `src/views/TodaySchedule.tsx`, `src/styles.css`.
  - Note: the next-class card uses `status-card is-next`; the pending checklist lives in the Today view (`App.tsx`) with `today.pending*` strings and per-task toggles.
- [x] Improve `ScheduleView.tsx`: readable weekly grid with tonal subject blocks.
  - Files: `src/views/ScheduleView.tsx`, `src/styles.css`.
  - Note: `.week-grid` with `.week-day` columns and `.occurrence` blocks tinted with `--subject-color`.
- [x] Add visual progress bars to `GradesView.tsx` and `StatsView.tsx`, plus clear empty states with a direct action.
  - Files: `src/views/GradesView.tsx`, `src/views/StatsView.tsx`, `src/styles.css`.
  - Note: final-average `bar-track` in Grades, `bar-list` per subject in Stats, `.empty-state` with `goToSubjects`/`goToStrengths` actions.
  - Verification: `npm run check` green; the vault-gated visual pass remains a manual follow-up outside this checklist.

## Phase E — Bilingual user documentation

- [x] Write `docs/USER_GUIDE.en.md` covering installation/first run, vault (`omega`/`longlife`), academic years/terms/subjects, schedules/rotations/holidays, attendance, exams/topics, grading scales and weighted grades, tasks/subtasks/tags/search, Pomodoro and SM-2 review, backup/restore, `.txt` export/import, theme and language.
  - Verification: 17 sections; spot-checked against `crates/study-planner-core/src/study.rs` (SM-2 and priority score), `notifications.rs` (lead times) and the locale keys.
- [x] Write `docs/USER_GUIDE.es.md` with the same structure in Spanish.
  - Verification: same 17 sections and cross-links; strings match the app's `es` resources.
- [x] Update `README.md` and create `README.es.md` with cross-links and links to both guides.
  - Files: `README.md`, `README.es.md`, `docs/USER_GUIDE.en.md`, `docs/USER_GUIDE.es.md`.
  - Note: `README.md` now has the language switcher and both guide rows; `README.es.md` is a full mirror translation.

## Phase G — Requested refinements (2026-11-22)

> These are the newest user requests. Execute them in the order of the part tracker above. The existing Phase D shell items remain valid; this phase records the extra scope and the files that must not be broken.

### Part 1 — Dropdown selectors + button radius

- [x] G1.1 Add the missing `.custom-select*` styles: trigger, value, placeholder, color dot, chevron, menu, option, selected/active/disabled, check, focus ring and dark-mode surface.
  - Context: every view already uses `CustomSelect`, but `src/styles.css` had **no** `.custom-select` selectors; the menu rendered as an unstyled inline block. This is the main cause of the "broken dropdown" look.
  - Files: `src/styles.css`.
- [x] G1.2 Fix menu stacking and placement: `position: relative` root, absolute menu, `z-index` above cards, full-width trigger, internal scroll, `min-width` equal to the trigger, and open upward when there is not enough space below.
  - Files: `src/components/CustomSelect.tsx`, `src/styles.css`.
- [x] G1.3 Remove the obsolete native-select rules (`.select-field` arrow background and `appearance: none`) or scope them to `select.select-field`, so they cannot fight the custom trigger.
  - Files: `src/styles.css`.
- [x] G1.4 Review every `CustomSelect` usage in `AcademicView`, `CalendarView`, `ExamsView`, `GradesView`, `ScheduleView`, `StatsView`, `StrengthsView`, `StudyView` and `TasksView` in light/dark and narrow widths: labels, disabled state, required slots and long subject names.
  - Files: the views above.
  - Note: the styling is global and applies to all 33 usages; markup/class names were audited. A Tauri pass with a real vault remains a manual follow-up for the views that are vault-gated.
- [x] G1.5 Extend `CustomSelect.test.tsx` for the placement hook/class and keep keyboard/outside-click coverage green.
  - Files: `src/components/CustomSelect.test.tsx`.
  - Verification: 11/11 tests pass, including bottom/top placement.
- [x] G2.1 Reduce app button radius from pill (`999px`) to `8–10px` (`--md-radius-sm`). Apply to `.button` and `.text-field`; keep badges, chips, filters, tags, avatars and progress bars pill-shaped.
  - Files: `src/styles.css`.
- [x] G2.2 Audit every `border-radius: 999px` and classify it as button, input, badge/filter or decorative. Change only real buttons/inputs.
  - Files: `src/styles.css`.
  - Result: only `.button` and `.text-field` changed; scrollbar, segmented control, accent swatches, chips, tags, dots, progress bars and circular attendance buttons keep their radius.
- [x] G2.3 Verify hover, active, focus-visible and disabled states after the radius change; check the task composer, hero actions, forms and settings.
  - Verification: `npm run check` passes (62 tests) and the shell screenshot confirms the new radius.

### Part 2 — Collapsible sidebar with subsections

- [x] G3.1 Reduce the always-visible vertical entries: turn the four `navGroups` into collapsible parents (`Daily`, `Academics`, `Study`, `System`) whose children are the existing sections.
  - Default: only the group of the active section is expanded; the other groups show one row each.
  - Selecting a section auto-expands its parent. The user can collapse/expand any group.
  - Persist the expanded groups in `localStorage` (`study-planner.nav.expanded`) with a safe fallback.
  - Files: `src/App.tsx`, `src/styles.css`, `src/locales/en.ts`, `src/locales/es.ts`.
- [x] G3.2 Accessibility: parent toggle is a real `<button>` with `aria-expanded`, `aria-controls`, `Enter`/`Space` and a visible focus ring; children keep `aria-current="page"`.
  - Files: `src/App.tsx`, `src/styles.css`.
- [x] G3.3 Narrow windows (`<=1080px`): keep an icon rail. Collapsed groups show one icon; the expanded group shows its child icons below. Mobile (`<=760px`) keeps the existing horizontal scroll with all sections visible (CSS override, no separate data path).
  - Files: `src/App.tsx`, `src/styles.css`.
- [x] G3.4 Keep every `nav.*` key working and add `nav.expandGroup` / `nav.collapseGroup` (or `aria-label` equivalents) to both locales.
  - Files: `src/locales/en.ts`, `src/locales/es.ts`.
- [x] G3.5 Update navigation tests so they open the parent group before clicking a child when needed; add a test for collapse/expand and for `aria-expanded`.
  - Files: `src/App.test.tsx`, `src/App.tauri.test.tsx`.

### Part 3 — Subjects: degree cycles + approved-subject tracking

- [x] G4.1 Add a **Study plan / Cycles** subsection inside Subjects, separate from the term-based subject list.
  - Each cycle is a visual separator with a title, an optional order and its own subject rows.
  - Each row can be checked as approved. Approved rows stay visible with strikethrough and muted color.
  - Show progress per cycle (`approved / total`) and an overall progress summary.
  - Create, edit and delete cycles and plan subjects. Reorder with an explicit `position` field (drag-and-drop is **not** required).
  - Files: `src/views/AcademicView.tsx`, `src/styles.css`.
  - Note: the plan lives in its own panel inside `AcademicView` (the Subjects view), below the term-based list. Editing an approved row keeps its approval (the form carries `approved`).
- [x] G4.2 Persist the study plan: new migration `0004` (never edit `0001_initial.sql`), store repository, core types, Tauri commands and frontend IPC.
  - Proposed tables: `study_cycle(id, name, position, created_at, updated_at, deleted_at)` and `study_plan_subject(id, cycle_id, name, code, approved, position, created_at, updated_at, deleted_at)`.
  - Files: `crates/study-planner-store/migrations/0004_study_cycles.sql`, `crates/study-planner-store/src/lib.rs`, `crates/study-planner-store/src/academic.rs`, `crates/study-planner-core/src/lib.rs`, `crates/study-planner-core/src/academic.rs`, `src-tauri/src/lib.rs`, `src/lib/ipc.ts`.
  - Note: `SCHEMA_VERSION` is now `4`; `crates/study-planner-transfer/src/lib.rs` exports/imports both tables in `TABLE_ORDER`.
- [x] G4.3 Add bilingual strings for cycles, approval, progress and empty states.
  - Files: `src/locales/en.ts`, `src/locales/es.ts`.
- [x] G4.4 Tests: migration/repository test, approval toggle and progress rendering in `App.tauri.test.tsx` (mock the new IPC calls).
  - Files: `crates/study-planner-store/src/academic.rs`, `src/App.tauri.test.tsx`.
  - Verification: `npm run check` green (typecheck, Biome, 64 Vitest tests, production build); `cargo test --workspace` green; `cargo fmt --check` and `cargo clippy -- -D warnings` green. Repository test covers create/update/delete, approval, cycle progress guards and negative positions; the UI test covers approval toggle, progress text and preserving approval on edit.

### Part 4 — Study-plan row spacing + empty-state card padding

- [x] G5.1 Study plan (Subjects → “Plan de estudios”): stop stacking `↑`, `↓`, `Editar` and `×` in a column. `.subject-actions` is now a single horizontal, vertically centered row that wraps only when needed, so the cycle header and each subject row keep a compact height instead of the ~120 px of empty space the stacked buttons created.
  - Files: `src/styles.css`.
- [x] G5.2 Subject row padding: `.cycle-subject` moved from `6px 8px` to `8px 12px` with `gap: 10px`; the row is now a comfortable ~40 px target instead of an oversized box. The cycle keeps its own padding and the progress bar keeps its spacing.
  - Files: `src/styles.css`.
- [x] G5.3 Weekly schedule → “No terms” empty state: `.next-card` now uses the same horizontal padding as the section hero (`26px clamp(22px, 4vw, 44px)` instead of a flat `20px`) and lays out its content as a column with the eyebrow → h2 → body → actions rhythm; the CTA gets `margin-top: 18px` like the other empty states.
  - Files: `src/styles.css`, `src/views/ScheduleView.tsx`, `src/views/AcademicView.tsx`.
  - Note: the two Schedule empty states and the vault-gated Academic empty state now wrap their CTA in `.hero-actions`, matching Calendar, Exams, Grades, Stats, Strengths, Study and Tasks.
- [x] G5.4 No new runtime or dev dependency was added for these fixes, so `package.json`, `package-lock.json` and `THIRD_PARTY_LICENSES.md` stay unchanged. Re-check this note if a later tweak pulls in a new package.
- [x] G5.5 Verification: `npm run typecheck` green; `npx biome check src/styles.css src/views/ScheduleView.tsx src/views/AcademicView.tsx` → “Checked 3 files… No fixes applied”; `npm run check` green (typecheck, Biome, 66 Vitest tests, production build).
  - Files: `docs/UI_REMODEL_CHECKLIST.md`.

### Part 5 — Release v0.2.2

- [x] G6.1 Bump `0.2.0` → `0.2.2` in `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`, `src-tauri/tauri.conf.json` and `snap/snapcraft.yaml`.
- [x] G6.2 Update the release copy: new `0.2.2` entry in `CHANGELOG.md`; status badge and paragraph in `README.md` / `README.es.md`; version/schema rows in `docs/CHECKLIST.md`; examples in `docs/RELEASE.md` and `docs/UPDATER.md`; tag example in `.github/workflows/release.yml`.
- [x] G6.3 No new dependency was added, so `THIRD_PARTY_LICENSES.md` stays unchanged.
- [x] G6.4 Verify: `npm run check` green, `scripts/check-snap-version.sh` reports the same version, and `cargo check --locked` accepts the bumped lockfile.
- [x] G6.5 Commit everything, tag `v0.2.2`, push `main` and the tag. CI and Release start from the push/tag; dispatch `snap.yml` (`stable`) and `store-msix.yml` manually. `snap-promote.yml` is not needed because the Snap workflow publishes directly to the requested channel.

## Phase F — Verification

- [x] Add/update Vitest coverage for `CustomSelect`, English-first startup, switching to Spanish and absence of phase labels.
  - Files: `src/components/CustomSelect.test.tsx`, `src/App.test.tsx`, `src/App.tauri.test.tsx`, `src/App.english.test.tsx`.
  - Note: `App.english.test.tsx` verifies first-run English and switching from Settings to Spanish; `App.test.tsx` keeps the no-“Fase/Phase” regression.
- [x] Run `npm run check` and fix Biome, TypeScript and Vitest findings.
  - Fixed: three `DateField` usages in `TasksView` missing `label`; Biome formatting in six files; optional chain and ARIA attribute in `DateField`; `.form-actions` CSS order.
  - Verification: green — typecheck, Biome without warnings, 66 Vitest tests (7 files), production build.
- [x] Run `cargo test --workspace` (or `./scripts/check.sh`) and fix Rust/formatting/Clippy findings.
  - Verification: `npm run rust:fmt`, `npm run rust:clippy` and `npm run rust:test` green; `scripts/audit-network.sh` green.
- [x] Mark every item above as complete and record the final state.
  - Final state note: all checks green; documentation cross-linked; no `backdrop-filter` and no remote assets in `src/`.

## Files touched (running log)

> Add the planned files here before editing a part, then keep the note with the verification result.

### Part 1 — Dropdown selectors + button radius (done 2026-11-22)

- `docs/UI_REMODEL_CHECKLIST.md` — scope, part tracker and Phase G.
- `src/styles.css` — `.custom-select*` styles, `.select-field` cleanup, button/input radius.
- `src/components/CustomSelect.tsx` — menu placement hook (`is-bottom` / `is-top`).
- `src/components/CustomSelect.test.tsx` — placement coverage.
- Verification: `npm run check` green (typecheck, Biome, 62 Vitest tests, production build). Browser screenshot of the shell confirms the smaller radius; the dev server remains running at `http://127.0.0.1:1420/`.

### Part 2 — Collapsible sidebar (done 2026-11-22)

- `src/App.tsx` — `navGroups` with group icons, `readExpandedGroups`, `navigate`, `toggleGroup`, persisted `study-planner.nav.expanded`, accessible group toggles.
- `src/styles.css` — group toggles, separators, chevron, `is-expanded`/`is-collapsed`, icon-only rail at `<=1080px`, horizontal override at `<=760px`.
- `src/locales/en.ts`, `src/locales/es.ts` — `nav.expandGroup`, `nav.collapseGroup`.
- `src/App.test.tsx`, `src/App.tauri.test.tsx` — `goToSection` helper plus a collapse/expand + `aria-expanded` test.
- Verification: `npm run check` green (typecheck, Biome, 63 Vitest tests, production build). Iframe preview at 1280 px shows labeled groups; at 900 px shows icons only, with no text.

### Part 3 — Subjects study plan (done 2026-11-22)

- `src/views/AcademicView.tsx`, `src/styles.css`, `src/locales/en.ts`, `src/locales/es.ts`, `src/lib/ipc.ts`, `src/App.tauri.test.tsx`.
- `crates/study-planner-store/migrations/0004_study_cycles.sql`, `crates/study-planner-store/src/lib.rs`, `crates/study-planner-store/src/academic.rs`, `crates/study-planner-core/src/lib.rs`, `crates/study-planner-core/src/academic.rs`, `src-tauri/src/lib.rs`, `crates/study-planner-transfer/src/lib.rs`.
- Fix: the plan-subject form now carries `approved`, so editing an approved row no longer resets it; the regression test asserts `approved: true` on update.
- Verification: `npm run check` green (typecheck, Biome, 64 Vitest tests, production build); `cargo test --workspace` green (core, store, transfer, updater, host); `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` green. A Tauri pass with a real vault remains a manual follow-up (not required by Phase F).

### Part 4 — Study-plan row spacing + empty-state padding (done 2026-11-22)

- Planned files: `src/styles.css`, `src/views/ScheduleView.tsx`, `src/views/AcademicView.tsx`, `docs/UI_REMODEL_CHECKLIST.md`.
- `src/styles.css` — `.subject-actions` from column to horizontal wrapping row; `.cycle-subject` padding `8px 12px` + `gap: 10px`; new `.next-card` layout (`flex` column, hero-aligned padding `26px clamp(22px, 4vw, 44px)`, mobile `22px 20px`) and `.next-card > .button { margin-top: 18px }`.
- `src/views/ScheduleView.tsx` — both “no vault” and “no terms” empty-state CTAs wrapped in `.hero-actions` for the same rhythm as the other views.
- `src/views/AcademicView.tsx` — vault-gated empty-state CTA wrapped in `.hero-actions` as well.
- No dependency changes: `package.json`, `package-lock.json` and `THIRD_PARTY_LICENSES.md` untouched.
- Verification: `npm run typecheck` green; `npx biome check src/styles.css src/views/ScheduleView.tsx src/views/AcademicView.tsx` green; `npm run check` green (typecheck, Biome, 66 Vitest tests, production build). Visual check in the Tauri window remains a manual follow-up (vault-gated views).

### Part 5 — Release v0.2.2 (done 2026-11-22)

- Files: `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`, `src-tauri/tauri.conf.json`, `snap/snapcraft.yaml`, `CHANGELOG.md`, `README.md`, `README.es.md`, `docs/CHECKLIST.md`, `docs/RELEASE.md`, `docs/UPDATER.md`, `.github/workflows/release.yml`.
- Version bump `0.2.0` → `0.2.2` applied to npm, Cargo workspace/lock, Tauri config and snap; `scripts/check-snap-version.sh` reports “snap y app comparten la versión 0.2.2”.
- `CHANGELOG.md` — new `0.2.2` entry (bilingual UI, study plan, Material 3 remodel, accessibility and spacing fixes).
- `README.md`, `README.es.md` — badge and status paragraph updated to `v0.2.2`; release examples in `docs/RELEASE.md` / `docs/UPDATER.md` and the release workflow example updated.
- `docs/CHECKLIST.md` — app version `0.2.2`, schema `v4` (migrations `0003`/`0004`), release row and UI test count.
- No dependency changes: `package.json` dependencies, `package-lock.json` tree and `THIRD_PARTY_LICENSES.md` unchanged.
- Verification: `npm run check` green (typecheck, Biome, 66 Vitest tests, production build); `cargo check --locked` green for the five crates at `0.2.2`; `scripts/check-snap-version.sh` green.
- Release: commit + tag `v0.2.2` pushed to `main`; `ci.yml` and `release.yml` run from the push/tag; `snap.yml` (`stable`) and `store-msix.yml` dispatched manually. `snap-promote.yml` skipped: the Snap workflow publishes directly to the requested channel.

### Phase E — Bilingual user documentation (done 2026-11-22)

- `docs/USER_GUIDE.en.md` — full English user guide.
- `docs/USER_GUIDE.es.md` — full Spanish user guide with the same structure.
- `README.md`, `README.es.md` — cross-links and links to both guides; `README.es.md` created as a full mirror.
- `src/App.english.test.tsx` — English-first startup and switching to Spanish.
- Verification: `npm run check` green (typecheck, Biome, 66 Vitest tests, production build).

### Cierre — Phase E y F (2026-11-22)

- `src/views/TasksView.tsx` — los tres `DateField` envueltos en `<label>` ahora usan el `label` del componente y no anidan etiquetas.
- `src/components/DateField.tsx` — encadenamiento opcional y `aria-haspopup` movido del input al botón (Biome).
- `src/styles.css` — `.form-actions` reordenado antes de las variantes de ciclo.
- `README.md`, `README.es.md` — enlaces de idioma y guías; `README.es.md` nuevo.
- `src/App.english.test.tsx` — arranque en inglés y cambio a español (2 tests).
- Formateo Biome en `src/App.tauri.test.tsx`, `src/locales/en.ts`, `src/views/AcademicView.tsx`.
- Verification: `npm run check` green (typecheck, Biome sin avisos, 66 tests, build); `rust:fmt`, `rust:clippy` y `rust:test` green; `scripts/audit-network.sh` green.

### Phase 0 — Offline rules (done 2026-11-22)

- `scripts/audit-network.sh` — green: no remote URLs in the UI, no network dependency outside the updater, strict snap, no secrets.
- Verification: grep confirms no `backdrop-filter` in `src/` or `index.html` and no remote fonts/CDNs.

### Phase D — Material 3 visual refresh (done 2026-11-22)

- `src/lib/theme.ts` — light/dark scheme from `@material/material-color-utilities`, written to `--md-sys-color-*`.
- `src/styles.css` — spacing/radius/motion tokens, button variants, cards, week grid, study plan, progress bars, narrow/medium breakpoints.
- `src/App.tsx` — SVG icon set, grouped collapsible navigation, Today pending checklist.
- `src/components/WindowControls.tsx` — aligned title-bar controls (already SVG; no change needed).
- `src/views/TodaySchedule.tsx`, `ScheduleView.tsx`, `GradesView.tsx`, `StatsView.tsx` — next-class card, tonal weekly grid, progress bars and empty states.
- Verification: `npm run check` green (64 tests) and `cargo test --workspace` green. Browser screenshot at 912 px confirms the icon rail and the active pill; the labeled-group layout was confirmed earlier at 1280 px.

### Earlier phases

- `docs/CHECKLIST.md` — link to this checklist.
- `src/lib/i18n.ts`, `src/locales/en.ts`, `src/locales/es.ts` — English-first locale and phase cleanup.
- `src/lib/theme.ts`, `src/styles.css`, `src/App.tsx` — Material 3 tokens, shell and title bar.
- `src/components/CustomSelect.tsx`, `src/views/custom-select.ts` — custom select.
- `src/views/*.tsx` — select replacement, layout and empty states.
- `crates/study-planner-store/migrations/0003_default_locale_english.sql`, `crates/study-planner-store/src/lib.rs`, `crates/study-planner-core/src/lib.rs` — locale migration.
- `src-tauri/src/vault.rs`, `src-tauri/src/lib.rs`, `src/lib/ipc.ts` — locale persistence.
- `docs/USER_GUIDE.en.md`, `docs/USER_GUIDE.es.md`, `README.md`, `README.es.md` — documentation.
- `src/components/CustomSelect.test.tsx`, `src/App.test.tsx`, `src/App.tauri.test.tsx` — tests.
