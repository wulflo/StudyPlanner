# Estructure

> **Índice técnico detallado de Study Planner.**
>
> Versión del código indexada: **0.2.5** (`Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`).
> Fecha del índice: **2026-11-25**.
>
> Este documento **no modifica ni describe cambios en el código**: es un mapa de referencia.
> Responde a la pregunta _«¿dónde está la pieza que hace que funcione cada cosa?»_: permite ir
> de una funcionalidad observable al archivo, símbolo, comando Rust o tabla SQLite que la
> implementa, y viceversa.

---

## 0. Cómo leer este documento

### 0.1 Convenciones

| Notación | Significado |
| :--- | :--- |
| `ruta/archivo.tsx:123` | Archivo y línea aproximada donde empieza el símbolo. Las líneas corresponden a la versión 0.2.5 y pueden moverse; el **nombre del símbolo** es el dato estable. |
| `símbolo()` | Función o componente exportado (si es interno se indica). |
| `#[tauri::command]` | Función Rust expuesta al frontend mediante `invoke("nombre")`. |
| `[F]`, `[D]`, `[R]`, `[I]` | Capa: frontend, dominio (crates Rust puros), Rust/host, infraestructura. Se usan en §11. |

### 0.2 Estructura del documento

1. **§1 Mapa general** — capas, arranque, navegación, frontera TS↔Rust, seguridad.
2. **§2 Índice maestro de archivos** — inventario del frontend, los 5 crates Rust e infraestructura.
3. **§3 Modelo de datos y persistencia** — convenciones, tablas, migraciones, bóveda y export.
4. **§4 Crates de dominio** — core, store, transfer, updater.
5. **§5 Frontend React** — shell, vistas y componentes.
6. **§6 Interfaz** — i18n, tema Material y select.
7. **§7 Host Tauri** — 124 comandos y subsistemas.
8. **§8 Pruebas**.
9. **§9 Build, CI, releases y empaquetado**.
10. **§10 Documentación existente**.
11. **§11 Índice funcionalidad → código**.
12. **§12 Glosario**.

### 0.3 Documentación relacionada (no duplicar)

| Documento | Qué contiene | Cuándo consultarlo |
| :--- | :--- | :--- |
| `docs/ARCHITECTURE.md` | Visión arquitectónica de alto nivel, contrato IPC y riesgos. | Entender **cómo está armado**. |
| `docs/DATA_MODEL.md` | Esquema, convenciones de datos, invariantes y migraciones. | Entender **qué se guarda y por qué**. |
| `docs/DECISIONS.md` | ADR-001…ADR-026. | Entender **por qué** se decidió algo. |
| `docs/USER_GUIDE.es.md` / `.en.md` | Guía del usuario en 17 secciones. | Cómo se usa, no dónde está. |
| `docs/RELEASE.md`, `docs/UPDATER.md`, `docs/KEYS.md`, `docs/SNAP.md` | Publicación, actualizaciones, custodia de claves y snap. | Infraestructura de distribución. |
| `docs/NOTIFICATIONS.md`, `docs/OFFLINE.md`, `docs/EXPORT_FORMAT.md` | Recordatorios, modo offline y formato `.txt`. | Subsistemas concretos. |
| `docs/CHECKLIST.md`, `docs/CHECKLIST_REFACTOR_UI.md`, `CHANGELOG.md` | Estado e hitos. | Trazabilidad. |

> Este índice complementa a `ARCHITECTURE.md` y `DATA_MODEL.md`: aquellos explican el diseño;
> aquí se enumeran **rutas y símbolos concretos**.

---

## 1. Mapa general del sistema

### 1.1 Capas y tecnologías

```
   index.html (24 L) → src/main.tsx (12 L) → App.tsx (1130 L)
                              │                    │
              theme.ts / i18n.ts (singletons)      │ useState por sección
                                                   ▼
                   src/views/*.tsx (10 vistas) + src/components/*.tsx
                                                   │
                            src/lib/ipc.ts (1527 L) — único invoke()
                                                   │
   ┌───────────────────────────────────────────────▼─────────────────────────┐
   │ src-tauri/src/lib.rs — 124 comandos Tauri, bandeja, instancia única     │
   │  ├── vault.rs (108 comandos) → study-planner-store + transfer          │
   │  ├── updater.rs (6)  ────────→ study-planner-updater (única red)        │
   │  ├── notifications.rs (5) ──→ store + zbus (D-Bus, Linux)              │
   │  ├── background.rs (2) ─────→ bandeja / hide-on-close                  │
   │  └── repository.rs (1) ─────→ URL fija del repo                        │
   └───────────────────────────────────────────────┬─────────────────────────┘
                                                   ▼
   <vault>/omega/study-planner.db (SQLite STRICT, WAL) + attachments/ + backup/
   <vault>/longlife/<device>/YYYY-MM-DD/ (snapshots diarios, retención 7)
   GitHub Releases (latest.json firmado con minisign)
```

- Frontend: React 19 + TypeScript + Vite 8 + i18next + Material Color Utilities. **Sin
  react-router**: la navegación es `useState<SectionId>` en `App.tsx:644`.
- Backend: Tauri v2 + Rust 2024 (workspace con 5 crates) + SQLite (`rusqlite` bundled).
- La dependencia `zustand` está declarada en `package.json` pero **no se usa**: el estado es
  React local en `App.tsx` y cada vista.
- CSP de producción (`tauri.conf.json`): `connect-src ipc: http://ipc.localhost`;
  `withGlobalTauri: false`, `freezePrototype: true`. Toda la red sale del crate updater.

### 1.2 Arranque

1. `index.html:22` carga `/src/main.tsx`.
2. `main.tsx:6` ejecuta `applyStoredTheme()` (`theme.ts:266`) **antes** del render para
   evitar parpadeo: lee `study-planner.theme` / `.accent` y escribe tokens CSS en `:root`.
3. La evaluación de `App.tsx:5-11` inicializa i18next de forma sincrónica (`initAsync: false`).
4. `main.tsx:8-12` monta `<React.StrictMode><App/></React.StrictMode>`.
5. `App.tsx:696-742` `bootstrap()` (solo si `runningInTauri`, `ipc.ts:302`):
   `get_app_info` → `get_vault_status` → si procede `get_app_locale` (solo si no hay idioma
   guardado) → `list_tasks`. Un flag `cancelled` evita actualizar tras desmontar.
6. Sin Tauri (tests / dev web) la app muestra el estado «primera vez» y deshabilita el
   selector de bóveda (`App.tsx:374`).

### 1.3 Navegación

`navGroups` (`App.tsx:44-81`) define 4 grupos y 12 secciones:

| Grupo | Secciones |
| :--- | :--- |
| `daily` | `today`, `calendar`, `tasks` |
| `academics` | `subjects`, `schedule`, `exams`, `grades` |
| `study` | `study`, `strengths`, `stats` |
| `system` | `vault`, `settings` |

- `SectionId` / `NavGroupId` se derivan de `typeof navGroups` (`App.tsx:83-84`).
- `navigate()` 894, `toggleGroup()` 907, grupos persistidos en `study-planner.nav.expanded`.
- Render por sección en `App.tsx:1009-1123`: `TodayView` y `VaultView` son internos de App
  (`:244` y `:328`); el resto viven en `src/views/`.
- Pestañas de segundo nivel (`components/Tabs.tsx`): AcademicView `:846`, ExamsView `:461`,
  GradesView `:513`, ScheduleView `:818`.

### 1.4 Frontera TypeScript ↔ Rust

- El **único** `invoke()` del frontend está en `src/lib/ipc.ts:1`; las vistas usan wrappers
  tipados. Los errores se normalizan con `messageOf(reason)` en cada vista.
- Hay ~105 wrappers (de `getAppInfo` `:305` a `sendTestNotification` `:1525`) que cubren
  124 comandos Rust registrados en `lib.rs:113-238` (`generate_handler!`).
- Excepciones sin `invoke`: `WindowControls.tsx` y `ResizeHandles.tsx` usan la API de ventana
  de Tauri (`getCurrentWindow()`); `listAllSubjects()` (`ipc.ts:895`) es un wrapper compuesto.
- El host no expone rutas, URLs ni firmas al webview: los comandos validan y resuelven todo
  en Rust (`AppState::with_store`, constantes compiladas).

### 1.5 Seguridad periférica

- `src-tauri/capabilities/default.json`: 8 permisos explícitos, **sin** `core:default`, `fs`,
  `http`, `sql`, `shell`, `opener`, `dialog`, `notification` ni `updater`.
- `scripts/audit-network.sh` verifica estáticamente esa lista, la CSP, `freezePrototype` y
  que la única dependencia de red sea `study-planner-updater`.
- El updater usa host fijo y whitelist (`github.com`, `objects.githubusercontent.com`,
  `release-assets.githubusercontent.com`), SHA-256 + minisign y `version:` en el trusted
  comment; Snap y MSIX bloquean la instalación.

---

## 2. Índice maestro de archivos

### 2.1 Frontend — `src/`

| Archivo | Líneas | Responsabilidad |
| :--- | ---: | :--- |
| `main.tsx` | 12 | Aplica tema guardado y monta React. |
| `App.tsx` | 1130 | Shell, navegación, bóveda/tareas globales, `TodayView` y `VaultView`. |
| `styles.css` | 3787 | Tokens Material, layout, componentes y media queries. |
| `lib/ipc.ts` | 1527 | Tipos del dominio + ~105 wrappers `invoke`. |
| `lib/i18n.ts` | 105 | i18next, idiomas, persistencia y locales de fecha. |
| `lib/theme.ts` | 290 | Tema Material You, 3 modos, 8 acentos, tokens CSS. |
| `lib/color.ts` | 36 | `safeColor()` para colores de materia importados. |
| `lib/taskFilter.ts` | 85 | `parseTaskFilter()` defensivo de filtros guardados. |
| `lib/term.ts` | 29 | `pickDefaultTerm()` (término que contiene hoy). |
| `locales/en.ts` / `es.ts` | 965 / 969 | 18 namespaces de traducción. |
| `views/AcademicView.tsx` | 1988 | Años, términos, materias, temas, plan por ciclos. |
| `views/ScheduleView.tsx` | 1440 | Horario, franjas, rotación, feriados, excepciones, asistencia. |
| `views/TasksView.tsx` | 1127 | Tareas, subtareas, etiquetas, filtros guardados y undo. |
| `views/GradesView.tsx` | 955 | Escalas, categorías, notas y promedio ponderado. |
| `views/ExamsView.tsx` | 908 | Exámenes, temas y vinculación, con paginación. |
| `views/SettingsView.tsx` | 694 | Tema, acento, idioma, updater, notificaciones, segundo plano. |
| `views/StrengthsView.tsx` | 653 | Autoevaluación, overrides y repaso SM-2. |
| `views/StudyView.tsx` | 602 | Prioridades, Pomodoro y sesiones. |
| `views/CalendarView.tsx` | 442 | Calendario mensual (exámenes, tareas, clases, repasos). |
| `views/StatsView.tsx` | 314 | Estadísticas de estudio. |
| `views/TodaySchedule.tsx` | 294 | Próxima clase y asistencia rápida en «Hoy». |
| `views/custom-select.ts` | 6 | Re-export de compatibilidad **no usado**. |
| `components/CustomSelect.tsx` | 366 | Select accesible usado por todas las vistas. |
| `components/DateField.tsx` | 406 | Campo de fecha local con picker mensual. |
| `components/Tabs.tsx` | 98 | Pestañas con roving tabindex y ARIA. |
| `components/AttendanceButtons.tsx` | 68 | Botones P/A/T/J de asistencia. |
| `components/WindowControls.tsx` | 119 | Minimizar/maximizar/cerrar. |
| `components/ResizeHandles.tsx` | 104 | 8 tiradores que delegan resize a Tauri. |
| `*.test.tsx`, `lib/*.test.ts` | — | 8 archivos, 74 pruebas (§8). |

### 2.2 Backend — workspace Rust

| Crate | Archivos clave | Responsabilidad |
| :--- | :--- | :--- |
| `study-planner` (host) | `src-tauri/src/lib.rs` (238+), `vault.rs` (2599), `updater.rs` (505), `notifications.rs` (273), `background.rs` (186), `instance.rs` (200), `repository.rs` | 124 comandos, bóveda, plugins, bandeja, notificaciones, updater, instancia única. |
| `study-planner-core` | `src/lib.rs`, `task.rs`, `exam.rs`, `grade.rs`, `academic.rs`, `study.rs` | Dominio puro: constantes, UUIDv7, validación, recurrencias, SM-2, prioridades. Sin Tauri/disco/red. |
| `study-planner-store` | `src/lib.rs`, `tasks.rs`, `exams.rs`, `academic.rs`, `schedule.rs`, `grades.rs`, `study.rs`, `settings.rs`, `notifications.rs`, `backup.rs`, `undo.rs`, `migrations/0001…0004.sql` | SQLite STRICT, migraciones, repositorios, backups, undo, FTS5, settings y auditoría de red. |
| `study-planner-transfer` | `src/lib.rs` (~2042 con tests) | Formato canónico `.txt`, export/import con checksum y rollback. |
| `study-planner-updater` | `src/lib.rs` (~1335), `updater.pub`, `examples/verify_release.rs` | Único crate con red: manifiesto, minisign, detección de runtime e instalación/rollback. |

`Cargo.toml` (raíz): `version 0.2.5`, `edition 2024`, `authors = ["wulflo"]`,
`license = "MIT OR Apache-2.0"`, `rust-version = 1.90`, resolver 3. `default-members`
excluye `src-tauri` y `study-planner-updater`, por lo que `cargo test` por defecto cubre
solo core/store/transfer; `npm run rust:test` prueba los cinco crates.

### 2.3 Infraestructura

| Ámbito | Archivos |
| :--- | :--- |
| CI/CD | `.github/workflows/ci.yml`, `release.yml`, `snap.yml`, `snap-promote.yml`, `store-msix.yml`, `dependabot.yml` |
| Versionado | `Cargo.toml` (workspace), `package.json`/lock, `tauri.conf.json`, `snap/snapcraft.yaml`, `scripts/check-snap-version.sh` |
| Release | `scripts/package-release.mjs`, `package-artifacts.mjs`, `merge-manifests.mjs`, `prepare-store-msix.mjs`, `prepare-store-icons.mjs` |
| Auditoría | `scripts/audit-network.sh`, `scripts/audit-licenses.sh`, `scripts/check.sh` |
| Empaquetado | `snap/snapcraft.yaml`, `.snapcraftignore`, `packaging/windows-store/AppxManifest.template.xml` |
| Editor/formato | `biome.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts` |

---

## 3. Modelo de datos y persistencia

> El detalle completo está en `docs/DATA_MODEL.md`; aquí solo se dan las claves y su ubicación.

### 3.1 Convenciones

- `id` = UUIDv7 en `TEXT`; `*_at` = RFC3339 UTC con milisegundos; fechas académicas
  `YYYY-MM-DD`; horas `HH:MM`; importes y pesos en punto fijo (`cp` centipuntos,
  `bp` basis points).
- `deleted_at != NULL` = borrado lógico; no se hacen borrados físicos de entidades de dominio.
- Todas las tablas son `STRICT`. SQLite con `foreign_keys=ON`, `synchronous=FULL`,
  `busy_timeout=5s`, `journal_mode=WAL` (`store/src/lib.rs:167-174`).

### 3.2 Tablas y FTS

32 tablas: `app_meta`, `schema_migration`, `academic_year`, `term`, `subject`,
`rotation_config`, `holiday`, `class_slot`, `class_exception`, `attendance_record`, `exam`,
`topic`, `exam_topic`, `grade_scale`, `grade_category`, `grade_entry`, `task`, `tag`,
`task_tag`, `saved_filter`, `self_assessment`, `strength_override`, `review_item`,
`study_session`, `note`, `attachment`, `notification`, `network_event`, `undo_journal`,
`setting`, `study_cycle`, `study_plan_subject`; más las virtuales FTS5 `task_fts` y `note_fts`.

### 3.3 Migraciones y versión

`SCHEMA_VERSION = 4` (`core/src/lib.rs`), `EXPORT_FORMAT_VERSION = 1`.
`study-planner-store/src/lib.rs:46-59` incrusta:

| Migración | Contenido |
| :--- | :--- |
| `0001_initial.sql` | Esquema completo, FTS, índices y settings sembrados. |
| `0002_partial_unique_indexes.sql` | Índices únicos parciales `WHERE deleted_at IS NULL`; estado `released`. |
| `0003_default_locale_english.sql` | `locale` por defecto `"en"` solo en bóvedas vacías. |
| `0004_study_cycles.sql` | `study_cycle` y `study_plan_subject`. |

`Store::migrate()` (`lib.rs:182-234`) usa `PRAGMA user_version`, rechaza esquemas futuros
(`StoreError::SchemaTooNew`), aplica cada SQL en transacción y guarda SHA-256 en
`schema_migration`. `verify_applied_migrations()` repara filas alteradas o faltantes.

### 3.4 Bóveda (`src-tauri/src/vault.rs`)

```
<raíz>/
├── omega/
│   ├── study-planner.db          BD viva (WAL: -wal, -shm)
│   ├── .study-planner.lock       flock exclusivo
│   ├── attachments/<sha256>      adjuntos por hash
│   ├── backup/
│   │   ├── study-planner.db      backup principal verificado
│   │   ├── pre-migration-vN-<ms>.db
│   │   └── pre-restore-<ms>.db
│   └── study-planner.log         eventos, sin rutas absolutas
└── longlife/<device>/YYYY-MM-DD/
    ├── study-planner.db          snapshot diario
    └── snapshot.json             metadata + sha256 + vault_id
```

- Configuración en `<app_config_dir>/vault.json` (`VaultConfig`, 695-739), con permisos
  0700/0600 en Unix.
- `VaultLayout::resolve` (215-255); `validate_root` (535-576) exige directorio escribible,
  fuera del workspace y de la raíz del FS; `acquire_lock` (578-601) con `try_lock`.
- `VaultSession::open` (257-281) / `open_store` (313-358): backup pre-migración, migra,
  restaura si falla, verifica backup principal y poda snapshots a 7 (`SNAPSHOT_RETENTION`, 39).
- `ensure_daily_snapshot()` (397-444) copia solo la BD y `snapshot.json`.

### 3.5 Exportación/importación (`study-planner-transfer`)

- `EXPORT_MAGIC = "STUDY-PLANNER-EXPORT"`, `EXPORT_END = "STUDY-PLANNER-END"`,
  formato 1, límite 512 MiB.
- 9 líneas de cabecera (`format-version`, `schema-version`, `app-version`, `vault-id`,
  `snapshot-at`, `attachments: embedded`, `body-sha256`), separador `---`, cuerpo JSONL
  ordenado por `TABLE_ORDER` (27 tablas + `attachment_blob`) y terminador.
- Se excluyen `app_meta`, `schema_migration`, `notification`, `network_event`,
  `undo_journal` y las FTS (se reconstruyen). Solo settings `portable` con clave permitida.
- Validación estricta: sin BOM/CRLF, SHA-256 en tiempo constante, orden canónico, columnas
  exactas, FK diferidas al final; `ImportMode::EmptyOnly` en la app; rollback transaccional.

---

## 4. Crates de dominio

### 4.1 `study-planner-core`

| Archivo | Símbolos / reglas |
| :--- | :--- |
| `src/lib.rs` | `APP_NAME`, `APP_VERSION`, `SCHEMA_VERSION=4`, `EXPORT_FORMAT_VERSION=1`; UUIDv7. |
| `src/task.rs` | Validación de título/estado/prioridad, recurrencias (`recurrence_advances…`). |
| `src/exam.rs` | Validación de exámenes, detección de ciclos en temas. |
| `src/grade.rs` | `entry_percent_rounds_to_basis_points`, promedio ponderado, `drop_lowest`, mapeo a escalas. |
| `src/academic.rs` | Fechas, rotaciones (`weekly_ab`/`parity`/`day_cycle`), feriados/excepciones, `next_class`, solapes, asistencia mínima. |
| `src/study.rs` | SM-2 determinista, clasificación de fortalezas, cola de prioridades explicable, rachas y agregados. |

### 4.2 `study-planner-store`

| Archivo | Responsabilidad |
| :--- | :--- |
| `src/lib.rs` | `Store`, `migrate()`, `verify_applied_migrations()`, integridad/FK, helpers de fecha y transacción. |
| `src/tasks.rs` | CRUD de tareas, etiquetas, FTS, filtros guardados y undo. |
| `src/exams.rs` | Exámenes, temas, vínculos y sincronización con notas. |
| `src/academic.rs` | Estructura académica, años/términos/materias y plan por ciclos. |
| `src/schedule.rs` | Franjas, rotación, feriados, excepciones, asistencia y `week_schedule`/`next_class`. |
| `src/grades.rs` | Escalas, categorías, entradas y `get_subject_grade`. |
| `src/study.rs` | Autoevaluaciones, overrides, SM-2, sesiones, prioridades y estadísticas. |
| `src/notifications.rs` | `due_reminders`, `claim_notification`, `mark_notification_fired`, `release_*`; claim obsoleto = 30 min. |
| `src/settings.rs` | Settings `portable`/`machine`, whitelist de exportación y `log_network_event`. |
| `src/backup.rs` | SQLite online backup (256 páginas), `.partial` + `sync_all` + verificación + rename atómico. |
| `src/undo.rs` | `undo_journal` con TTL de 5 minutos. |

### 4.3 `study-planner-updater`

- `UPDATE_URL` fijo a `latest.json` de `wulflo/StudyPlanner`; hosts permitidos y HTTPS
  obligatorio; redirecciones máx. 5.
- Manifiesto ≤256 KiB, artefacto ≤512 MiB; SHA-256 + firma minisign con
  `include_str!("../updater.pub")`; `version:` del trusted comment debe coincidir.
- `AppImage`, `Snap`, `Deb`, `Rpm`, `Windows`, `Msix`, `MacOs`, `Development`:
  `can_install()` solo para formatos instalables (Snap/MSIX bloqueados).
- Instalación atómica de AppImage (`.new`/`.old`), `pkexec dpkg -i`, `dnf`/`zypper`/`rpm`,
  PowerShell RunAs y script `hdiutil`/`ditto` en macOS; rollback conserva `.failed`.

---

## 5. Frontend React

### 5.1 `App.tsx` — shell

- `navGroups` 44, `Icon` 192, `TaskItem` 200, `TodayView` 244, `VaultView` 328, `App` 642.
- Estado global 644-664: sección activa, grupos expandidos, tema/acento, `info`, `vault`,
  `tasks`, errores y banderas de operaciones de bóveda.
- Handlers de bóveda: `chooseVault` 749, `createBackup` 782, `exportVault` 797,
  `importVault` 820, `restoreMainBackup` 846.
- Navegación: `navigate` 894, `toggleGroup` 907; render de vistas 1009-1123.

### 5.2 Vistas

| Vista | Archivo : símbolo | Pestañas / funciones clave |
| :--- | :--- | :--- |
| Hoy | `App.tsx:244` + `TodaySchedule.tsx:35` | Próxima clase `get_next_class`, asistencia rápida, hasta 4 tareas pendientes. |
| Tareas | `TasksView.tsx:157` | `submitQuick` 309, CRUD 326-392, filtros 435-471, `TaskRow` 1070. |
| Calendario | `CalendarView.tsx:56` | Grilla lunes-domingo, `eventsByDay` 223 (exam/task/class/review). |
| Materias | `AcademicView.tsx:204` | `structure` 851, `subjects` 1097, `topics` 1321, `plan` 1549; `STUDY_PAGE_SIZE=25` 114. |
| Horario | `ScheduleView.tsx:173` | `loadTerm` 210 (7 llamadas en paralelo); pestañas 823/1073/1200/1276. |
| Exámenes | `ExamsView.tsx:124` | Paginación `pageSizes` 35; pestañas list/form/topics 461. |
| Notas | `GradesView.tsx:84` | Escalas/categorías/entradas 513; `get_subject_grade`. |
| Estudio | `StudyView.tsx:48` | Pomodoro, modos `pomodoro|free|review`, cola de prioridades e historial. |
| Fortalezas | `StrengthsView.tsx:32` | Autoevaluación, override, `review_topic` (SM-2), `set_review_due`. |
| Estadísticas | `StatsView.tsx:17` | Períodos 7/30/all, `getStudyStats` 54, materias débiles y próximos repasos. |
| Bóveda | `App.tsx:328` | Estado, backup/restore, export/import y diagnósticos. |
| Ajustes | `SettingsView.tsx:50` | Apariencia 360-467, updater 469+, notificaciones y segundo plano. |

### 5.3 Componentes compartidos

| Componente | Archivo : L | Notas |
| :--- | :--- | :--- |
| `CustomSelect` | `components/CustomSelect.tsx:55` | Combobox/listbox accesible: teclado, opciones deshabilitadas, placement, `maxMenuHeight`. |
| `DateField` | `components/DateField.tsx:115` | Formato local y picker. |
| `Tabs` | `components/Tabs.tsx:15` | Roving tabindex, flechas/Home/End. |
| `AttendanceButtons` | `components/AttendanceButtons.tsx:25` | Asistencia P/A/T/J. |
| `WindowControls` / `ResizeHandles` | `components/WindowControls.tsx:37`, `ResizeHandles.tsx:36` | API de ventana, no `invoke`. |

---

## 6. Interfaz: i18n, tema y CSS

### 6.1 `src/lib/i18n.ts` (105)

- `AppLanguage = "es"|"en"` (7), `LANGUAGES` (9), **inglés por defecto** (16),
  `study-planner.language` (14).
- `normalizeLanguage` 34, `hasStoredLanguage` 41, `readLanguage` 49, `intlLocale` 56
  (`en-US`/`es-AR`), `getDateFnsLocale` 62, `setAppLanguage` 66.
- i18next init 78-92; `useTranslation` re-exportado en 103; listener `languageChanged` 97-101.
- Recursos: `src/locales/en.ts` y `es.ts`, 18 namespaces (`common`, `nav`, `app`, `today`,
  `tasks`, `vault`, `academic`, `schedule`, `calendar`, `exams`, `grades`, `study`,
  `strengths`, `stats`, `settings`, `date`, `attendance`, `window`).
- El locale de la bóveda (`get_app_locale`/`set_app_locale`) solo se aplica si el usuario
  no eligió idioma localmente.

### 6.2 `src/lib/theme.ts` (290)

- `ThemeMode = "system"|"light"|"dark"` (9), 8 `AccentId` (11), `THEME_MODES` 21,
  `ACCENTS` 30, `study-planner.theme` / `.accent` (86-87).
- `resolveTheme` 132, `materialTokens` 150 (genera `--accent*` y espejos
  `--md-sys-color-*` desde `@material/material-color-utilities`), `applyTheme` 254,
  `applyStoredTheme` 266, `useTheme` 270 (suscrito a `prefers-color-scheme` en modo sistema).
- Fondos sólidos a propósito: sin `backdrop-filter` para evitar artefactos en WebKitGTK
  con ventana sin decoraciones.

### 6.3 `src/styles.css` (3787)

- `:root` 1-125: tokens claros, `--md-elevation-*`, `--md-radius-*`, `--md-space-*` y
  tipografía Roboto Flex; `[data-theme="dark"]` 127-189; acentos 235-345.
- Componentes: `.tabs` 2000, `.custom-select` 2522, `.date-field` 2709, `.week-grid` 3058,
  `.calendar-grid` 3344, `.study-layout` 3500, `.resize-handle` 1732.
- Mejora progresiva con `color-mix`/`hsl(from …)` (193, 223); breakpoints desde 1811;
  `prefers-reduced-motion` 1988.
- Colores de materia: `safeColor()` (`lib/color.ts:12`) solo acepta `#RGB`/`#RRGGBB` y
  cae a `#6750A4`; se inyectan como `--subject-color`.

---

## 7. Host Tauri (`src-tauri/`)

### 7.1 `lib.rs` — arranque y comandos

- Módulos 6-12: `background`, `#[cfg(unix)] instance`, `notifications`, `repository`,
  `updater`, `vault`.
- `run()` 43-111: single-instance plugin, dialog, `vault::load_state`, `background::load`,
  `app.manage(state)`, fallback Unix de instancia, bandeja, hilo de `auto_check_on_startup`,
  scheduler de notificaciones y `on_window_event(background::handle_window_event)`.
- **124 comandos** registrados en `generate_handler!` (`lib.rs:113-238`): 2 en `lib.rs`,
  1 en `repository.rs`, 108 en `vault.rs`, 6 en `updater.rs`, 5 en `notifications.rs`,
  2 en `background.rs`.

### 7.2 Comandos por dominio (agrupados)

| Dominio | Comandos (`vault.rs` salvo indicado) | Líneas aprox. |
| :--- | :--- | :--- |
| App | `get_app_info`, `schema_self_check` (`lib.rs:23/29`), `open_repository` (`repository.rs:13`) | 23-29 |
| Bóveda | `get_vault_status` 830, `choose_vault` 857, `create_backup` 911, `export_vault` 930, `import_vault` 972, `restore_main_backup` 1043 | 830-1043 |
| Tareas | `list_tasks` 1161, `create_task` 1168, `set_task_done` 1175, `delete_task` 1184, `create_task_full` 1195, `update_task` 1204, `set_task_status` 1217, `search_tasks` 1230 | 1161-1230 |
| Etiquetas/filtros/undo | `list_tags` 1239, `create_tag` 1246, `update_tag` 1259, `delete_tag` 1273, `set_task_tags` 1280, `list_saved_filters` 1293, `create_saved_filter` 1305, `update_saved_filter` 1319, `delete_saved_filter` 1333, `list_undo_entries` 1342, `undo_entry` 1349, `purge_expired_undo` 1356 | 1239-1356 |
| Exámenes/temas | `list_exams` 1369, `create_exam` 1382, `update_exam` 1396, `delete_exam` 1409, `list_topics` 1416, `create_topic` 1425, `update_topic` 1438, `delete_topic` 1451, `list_exam_topics` 1458, `link_exam_topic` 1470, `unlink_exam_topic` 1483 | 1369-1483 |
| Notas | `list_grade_scales` 1500 … `get_subject_grade` 1640 (12 comandos) | 1500-1640 |
| Estructura/plan | `list_academic_years` 1656 … `delete_study_plan_subject` 1886 (23 comandos) | 1656-1886 |
| Horario/asistencia | `list_class_slots` 1899 … `get_next_class` 2108 (19 comandos) | 1899-2108 |
| Estudio/SM-2 | `list_self_assessments` 2126 … `get_study_stats` 2335 (18 comandos) | 2126-2335 |
| Idioma | `get_app_locale` 2349, `set_app_locale` 2363 | 2349-2363 |
| Updater (`updater.rs`) | `get_updater_status` 178, `set_updater_auto_check` 184, `check_updates` 193, `install_update` 285, `rollback_update` 417, `list_network_events` 435 | 178-435 |
| Notificaciones (`notifications.rs`) | `get_notification_status` 84, `set_notifications_enabled` 89, `set_notifications_sound` 106, `run_notification_scan` 124, `send_test_notification` 142 | 84-152 |
| Segundo plano (`background.rs`) | `get_background_status` 77, `set_background_mode` 82 | 77-82 |

### 7.3 Subsistemas del host

- **Notificaciones** (`notifications.rs`): scheduler cada 60 s solo en Linux con `zbus`
  sobre `org.freedesktop.Notifications` (`:230-261`); flujo claim → deliver → fired, con
  liberación del claim si falla (`:151-201`). En otras plataformas la entrega devuelve error.
- **Segundo plano** (`background.rs`): `BackgroundRuntime` con `AtomicBool`, bandeja
  «Mostrar / Revisar recordatorios / Salir» (`:120-165`), `handle_window_event` intercepta
  `CloseRequested` y oculta la ventana si procede (`:167-186`).
- **Instancia única** (`instance.rs`, Unix): `flock` + `UnixListener` con socket 0600;
  fallback del plugin para Snap/contenedores. Si la secundaria no puede notificar, `exit(0)`.

### 7.4 Configuración y autor

- Única config `tauri.conf.json`: ventana `main` 1180×760 sin decoraciones, CSP restrictiva,
  `bundle.category: "Education"`, **`publisher: "wulflo"`** y
  `copyright: "Copyright © 2026 Wulflo"`.
- `Cargo.toml` workspace: `authors = ["wulflo"]`, heredado por los 5 crates.
- MSIX: `wulflo.StudyPlannerMax`, `PublisherDisplayName = wulflo` (ya configurado en
  `store-msix.yml`, `scripts/prepare-store-msix.mjs` y la plantilla Appx).
- Sin `tauri.*.json` por plataforma y sin `deny.toml`: una sola config y una sola capability
  (`src-tauri/capabilities/default.json`).

---

## 8. Pruebas

### 8.1 Frontend (Vitest, 8 archivos, 74 pruebas)

| Archivo | Pruebas | Cubre |
| :--- | ---: | :--- |
| `App.tauri.test.tsx` | 39 | ~105 mocks de IPC, bootstrap, CRUD, bóveda, plan, horario, notas, SM-2, updater y notificaciones. |
| `components/CustomSelect.test.tsx` | 11 | Accesibilidad, teclado, deshabilitadas, click fuera, placement. |
| `App.test.tsx` | 9 | Navegación sin Tauri, grupos persistentes, gates de bóveda. |
| `lib/taskFilter.test.ts` | 5 | `parseTaskFilter`: JSON inválido, tipos, campos desconocidos. |
| `lib/color.test.ts` | 4 | `safeColor`: formatos, inyección y fallback. |
| `lib/term.test.ts` | 3 | `pickDefaultTerm`: hoy, más reciente y vacío. |
| `App.english.test.tsx` | 2 | Arranque en inglés y cambio de idioma. |
| `components/WindowControls.test.tsx` | 1 | `minimize/toggleMaximize/close/isMaximized/onResized`. |

### 8.2 Rust (168 pruebas)

| Crate | Pruebas | Archivos |
| :--- | ---: | :--- |
| `study-planner-core` | 43 | `lib.rs`, `task.rs`, `exam.rs`, `grade.rs`, `academic.rs`, `study.rs` |
| `study-planner-store` | 69 | `lib.rs`, `backup.rs`, `tasks.rs`, `exams.rs`, `grades.rs`, `academic.rs`, `schedule.rs`, `study.rs`, `notifications.rs`, `settings.rs`, `undo.rs` |
| `study-planner-transfer` | 21 | `src/lib.rs` (round-trip byte a byte, rechazo de checksum/CRLF/orden, rollback) |
| `study-planner-updater` | 14 | `src/lib.rs` (manifiesto firmado, URLs, SHA-256, instalación y rollback) |
| `study-planner` (host) | 21 | `instance.rs` 3, `notifications.rs` 1, `updater.rs` 5, `vault.rs` 12 |

Comandos: `npm run check` (typecheck + lint + test + build), `npm run rust:test`,
`npm run check:all`, `./scripts/check.sh`.

---

## 9. Build, CI, releases y empaquetado

### 9.1 Workflows

| Workflow | Disparo | Salida |
| :--- | :--- | :--- |
| `ci.yml` | push a main, PR, manual | `npm run check`, auditorías de red/licencias, fmt/clippy/tests Rust, `cargo check -p study-planner`. |
| `release.yml` | tags `v*`, manual con `tag` | Matriz Linux/Windows/macOS, firma minisign, release de GitHub con `latest.json`. |
| `snap.yml` | manual (`channel`), PR en `snap/**` | `.snap`, publicación manual en Snap Store. |
| `snap-promote.yml` | manual (`revision`, `channel`) | Promueve una revisión ya subida. |
| `store-msix.yml` | solo manual | MSIX sin firmar para Partner Center. |

### 9.2 Versión y firma

- Versión `0.2.5` en `Cargo.toml` (workspace), `package.json`/lock, `tauri.conf.json` y
  `snap/snapcraft.yaml`; `scripts/check-snap-version.sh` exige que snap y Tauri coincidan.
- Los scripts de release validan que el tag `vX.Y.Z` coincida con la versión de Tauri.
- Firma minisign con `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)`; clave pública versionada en
  `crates/study-planner-updater/updater.pub`; verificación con
  `cargo run -p study-planner-updater --example verify_release`.
- `merge-manifests.mjs` genera el `latest.json` final con las entradas por plataforma;
  `gh release create/upload` publica los artefactos y notas (`--generate-notes`).

### 9.3 Empaquetado

| Plataforma | Artefactos | Detalle |
| :--- | :--- | :--- |
| Linux | AppImage, `.deb`, `.rpm` (+`.sig`) y snap aparte | `snap/snapcraft.yaml` con `core24`, `confinement: strict`, plugs `home`/`removable-media` (sin red). |
| Windows | NSIS `.exe`, `.msi` (+`.sig`) y MSIX aparte | MSIX sin updater, firmado por Microsoft. |
| macOS | `.dmg` (+`.sig`) | Sin notarización. |

---

## 10. Documentación existente (índice)

| Documento | Pregunta que responde |
| :--- | :--- |
| `README.md` / `README.es.md` | Qué es, stack, requisitos, comandos y índice de docs. |
| `docs/ARCHITECTURE.md` | Cómo está armado (capas, IPC, CSP, bóveda, riesgos). |
| `docs/DATA_MODEL.md` | Esquema, invariantes y migraciones. |
| `docs/USER_GUIDE.*.md` | Cómo se usa (17 secciones). |
| `docs/DECISIONS.md` | Por qué (ADR-001…026). |
| `docs/RELEASE.md` / `UPDATER.md` / `KEYS.md` / `SNAP.md` | Publicación, actualizaciones, claves y snap. |
| `docs/NOTIFICATIONS.md` / `OFFLINE.md` / `EXPORT_FORMAT.md` | Subsistemas concretos. |
| `docs/CHECKLIST.md` / `CHECKLIST_REFACTOR_UI.md` / `CHANGELOG.md` | Estado e hitos. |

> Al indexar se detectaron documentos con datos atrasados: `DATA_MODEL.md` habla de esquema
> v2 (hoy v4), `ARCHITECTURE.md` usa lenguaje de fases tempranas y su tabla IPC tiene 12
> comandos (hoy 124), `SECURITY.md` no menciona 0.2.x y `THIRD_PARTY_LICENSES.md` es un
> snapshot de noviembre. Contrastar siempre con el código antes de citarlos.

---

## 11. Índice funcionalidad → código (búsqueda rápida)

| Funcionalidad | Dónde está |
| :--- | :--- |
| Elegir bóveda, backup, export/import, restaurar | `[F] App.tsx VaultView:328` → `[R] vault.rs:830-1043` → `[D] store/backup.rs + transfer` |
| Tareas, subtareas, etiquetas, undo y filtros | `[F] TasksView.tsx:157` → `[R] vault.rs:1161-1356` → `[D] store/tasks.rs` |
| Buscar tareas | `[F] searchTasks` (`ipc.ts:376`) → `search_tasks` (`vault.rs:1230`) → FTS5 `task_fts`. |
| Calendario mensual | `[F] CalendarView.tsx:56`, `eventsByDay:223` → `list_exams`, `search_tasks`, `get_week_schedule`, `list_topic_studies` |
| Horario, rotación, feriados, excepciones, asistencia | `[F] ScheduleView.tsx:173` → `[R] vault.rs:1899-2108` → `[D] store/schedule.rs` |
| Próxima clase y asistencia desde Hoy | `[F] TodaySchedule.tsx:35` → `get_next_class`, `set/clear_attendance` |
| Exámenes y temas vinculados | `[F] ExamsView.tsx:124` → `[R] vault.rs:1369-1483` → `[D] store/exams.rs` |
| Notas y promedio ponderado | `[F] GradesView.tsx:84` → `[R] vault.rs:1500-1640` → `[D] core/grade.rs + store/grades.rs` |
| Años, términos, materias y plan por ciclos | `[F] AcademicView.tsx:204` → `[R] vault.rs:1656-1886` → `[D] store/academic.rs` |
| Pomodoro y sesiones | `[F] StudyView.tsx:48` → `start/finish/delete_study_session`, `list_study_priorities` |
| Fortalezas y repaso SM-2 | `[F] StrengthsView.tsx:32` → `[R] review_topic` (`vault.rs:2209`) → `[D] core/study.rs` |
| Estadísticas | `[F] StatsView.tsx:17` → `get_study_stats` (`vault.rs:2335`) |
| Tema/acento/idioma | `[F] theme.ts:270`, `i18n.ts:66`, `SettingsView.tsx:360-443` → `get/set_app_locale` |
| Updater y notificaciones | `[F] SettingsView.tsx:469+` → `[R] updater.rs`, `notifications.rs` |
| Ventana sin marco y redimensionado | `[F] WindowControls.tsx:37`, `ResizeHandles.tsx:36` (API de ventana) |
| Autor del instalador | `[I] Cargo.toml authors`, `tauri.conf.json publisher`, `store-msix.yml` (`wulflo`) |

---

## 12. Glosario

| Término | Significado y dónde se define |
| :--- | :--- |
| **Bóveda** | Carpeta elegida por el usuario; `omega/` es la fuente de datos y `longlife/` las copias. |
| **UUIDv7** | Identificadores `TEXT` ordenables por tiempo (`core/src/lib.rs`). |
| **`cp` / `bp`** | Centipuntos y basis points: enteros para porcentajes y pesos sin coma flotante. |
| **Borrado lógico** | `deleted_at != NULL`; los índices únicos son parciales (`0002_partial_unique_indexes.sql`). |
| **FTS5** | `task_fts` y `note_fts`; se reconstruyen en la importación. |
| **SM-2** | Repaso espaciado determinista en `core/study.rs`; `review_item` guarda ease/intervalo/repetición. |
| **Rotación** | `weekly_ab` / `parity` / `day_cycle` en `rotation_config`, aplicada por `core/academic.rs`. |
| **Setting portable / machine** | Portable viaja en la exportación (whitelist de 20 claves); machine no (`store/settings.rs:20-41`). |
| **`longlife`** | Snapshot diario por dispositivo con `snapshot.json` y retención de 7 días. |
| **`study-planner.*`** | Prefijo de las 4 claves de `localStorage` (tema, acento, idioma, nav). |
| **`data-theme` / `data-accent`** | Atributos en `<html>` escritos por `applyTheme()` (`theme.ts:254`). |
| **`--md-sys-color-*` / `--accent*`** | Tokens Material generados desde el acento; los componentes deben usarlos en vez de hex. |
| **Publisher / authors** | `wulflo` en `tauri.conf.json` y en el workspace de Cargo; determina el autor del instalador. |

---

### Cierre

Este índice es un mapa, no una guía de cambio: para el diseño consulta `docs/ARCHITECTURE.md`
y `docs/DATA_MODEL.md`, para las decisiones `docs/DECISIONS.md`, y para el uso
`docs/USER_GUIDE.es.md`. Tras modificar código, actualízalo con la skill `Estructure` o el
comando `/estructure-sync`.
