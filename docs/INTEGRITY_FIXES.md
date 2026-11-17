# Study Planner — Plan de corrección de integridad y seguridad

> **Última actualización:** 2026-11-16
> **Base revisada:** `cc48a59` (*chore(release): prepare v0.1.7*)
> **Estado global:** P0, P1, P2 y P3 cerradas; plan completo
> **Próximo paso:** —

Este documento es la fuente de verdad para retomar la corrección de los hallazgos de la
revisión de integridad y seguridad. Está pensado para cortes de internet repetidos: cada
ítem es pequeño, verificable y se marca en el momento. Si el código y este documento no
coinciden, gana el código y hay que corregir el documento en el mismo cambio.

Los hallazgos originales están resumidos en la sección [Hallazgos de referencia](#hallazgos-de-referencia).

---

## Cómo retomar después de un corte

1. `git status --short` para ver qué archivos quedaron modificados.
2. Abrir este documento y leer **Estado actual**.
3. Buscar el primer ítem `[ ]` o `[~]` de la fase abierta.
4. Si hay un `[~]`, leer su nota: indica hasta dónde se llegó y qué falta.
5. Ejecutar la verificación del ítem antes de seguir:
   ```bash
   cargo fmt --all -- --check
   cargo test -p study-planner-store
   ```
6. Al terminar un ítem: cambiar a `[x]`, agregar una fila en **Registro de avance** y
   actualizar el snapshot. No borrar ítems completados: son historial.
7. No abrir una fase nueva hasta cerrar la anterior.

### Convenciones

| Marca | Significado |
|---|---|
| `[ ]` | Pendiente. |
| `[~]` | En curso. Debe llevar una nota con el punto exacto donde se cortó. |
| `[x]` | Hecho y verificado con el comando indicado. |
| `[!]` | Bloqueado. Anotar el motivo y qué decisión falta. |

Reglas de trabajo:

- Un ítem = un cambio coherente. No mezclar fases ni refactors masivos.
- Cada ítem debe dejar los tests verdes; si no se puede, se marca `[!]` y se explica.
- No editar `0001_initial.sql`: los cambios de esquema van en `0002_*.sql`.
- No cambiar el formato de exportación sin subir `export_format_version`.
- Mantener el estilo existente: comentarios y mensajes de error en español.

### Comandos de verificación

```bash
# Rápido, por crate
cargo test -p study-planner-store
cargo clippy -p study-planner-store --all-targets -- -D warnings
cargo fmt --all -- --check

# Completo antes de cerrar una fase
./scripts/check.sh
```

---

## Estado actual (snapshot)

| Campo | Valor |
|---|---|
| Fase abierta | Ninguna — plan completo |
| Ítems P0 completados | 12 / 12 |
| Ítems P1 completados | 7 / 7 |
| Ítems P2 completados | 7 / 7 |
| Ítems P3 completados | 11 / 11 |
| Archivos tocados en esta tanda | `crates/study-planner-{store,core,transfer}/src/*.rs`, `crates/study-planner-store/migrations/0002_partial_unique_indexes.sql`, `src/lib/{color,taskFilter}.ts`, `src/components/WindowControls.test.tsx`, `src/views/{AcademicView,TasksView,TodaySchedule,ScheduleView}.tsx`, `src/locales/{es,en}.ts`, `src-tauri/{capabilities/default.json,src/{instance,vault,notifications}.rs}`, `.github/workflows/*.yml`, `snap/snapcraft.yaml`, `scripts/audit-network.sh`, `docs/*.md` |
| Último test ejecutado | core 43 OK · store 63 OK · transfer 21 OK · updater 14 OK · host 21 OK · `npm run check` 50 OK |
| Próximo paso | — |

---

## Fase P0 — Atomicidad de escrituras

Objetivo: que ninguna operación de varios pasos deje la base a medias. Se usa
`Connection::unchecked_transaction` para no cambiar las firmas `&self` de toda la capa.

### P0-1 — Helper `with_transaction` en `Store`

- **Archivos:** `crates/study-planner-store/src/lib.rs`
- **Cambio:** agregar un método privado que abra una transacción diferida, ejecute un
  closure y haga `commit`; si el closure falla, el `Drop` del `Transaction` revierte.
- **Verificación:** `cargo test -p study-planner-store`
- **Estado:** `[x]`

### P0-2 — `create_task_full` atómico y con etiquetas validadas antes de escribir

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** validar/deduplicar `tag_ids` antes del `INSERT`; envolver tarea + vínculos +
  FTS + lectura final en una transacción.
- **Verificación:** test nuevo: etiqueta inexistente ⇒ no queda tarea; etiquetas
  duplicadas ⇒ una sola fila en `task_tag` y sin error.
- **Estado:** `[x]`

### P0-3 — `update_task` atómico

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** envolver actualización + etiquetas + FTS + lectura final.
- **Verificación:** test nuevo: actualización con etiqueta inexistente ⇒ título original
  intacto.
- **Estado:** `[x]`

### P0-4 — `set_task_tags` atómico y tolerante a duplicados

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** separar el cuerpo en `apply_task_tags` (sin transacción) y hacer que la
  función pública abra una transacción. Deduplicar preservando orden.
- **Verificación:** test nuevo: `tag_ids` repetidos no violan `task_tag_unique`.
- **Estado:** `[x]`

### P0-5 — `delete_task` atómico

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** borrado lógico + `task_fts` + `undo_journal` en una transacción.
- **Verificación:** test existente de undo sigue verde; test nuevo: tras borrar, existe
  exactamente una entrada de undo y no queda fila FTS.
- **Estado:** `[x]`

### P0-6 — `delete_tag` + rebuild de FTS atómico

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** etiqueta + vínculos + `refresh_all_task_fts` en una transacción.
- **Verificación:** test nuevo: tras borrar la etiqueta, las tareas siguen indexadas.
- **Estado:** `[x]`

### P0-7 — `update_tag` refresca el índice FTS

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** envolver la actualización y el rebuild de FTS en una transacción.
- **Verificación:** test nuevo: renombrar etiqueta ⇒ búsqueda por nombre nuevo encuentra
  la tarea y por el viejo no.
- **Estado:** `[x]`

### P0-8 — `review_topic` atómico

- **Archivos:** `crates/study-planner-store/src/study.rs`
- **Cambio:** avance SM-2 + autoevaluación + lectura final en una transacción.
- **Verificación:** el test existente `review_topic_applies_sm2_and_records_assessment`
  cubre el camino feliz. No hay forma práctica de forzar un fallo después del `UPDATE`
  sin instrumentar la base; la atomicidad se garantiza por el `with_transaction`.
- **Estado:** `[x]`

### P0-9 — `set_strength_override` atómico

- **Archivos:** `crates/study-planner-store/src/study.rs`
- **Cambio:** `SELECT` + `UPDATE`/`INSERT` + lectura final en una transacción.
- **Verificación:** tests existentes de fortaleza siguen verdes.
- **Estado:** `[x]`

### P0-10 — Escalas de nota atómicas

- **Archivos:** `crates/study-planner-store/src/grades.rs`
- **Cambio:** `clear_default_scales` + `INSERT`/`UPDATE` + lectura final en una
  transacción.
- **Verificación:** el test existente `keeps_only_one_default_scale_per_scope` sigue
  verde. No se puede forzar un fallo después del `clear` sin instrumentar la base; la
  transacción cubre ese caso.
- **Estado:** `[x]`

### P0-11 — Tests de regresión de atomicidad

- **Archivos:** `crates/study-planner-store/src/tasks.rs` (módulo `tests`),
  `crates/study-planner-store/src/grades.rs`, `crates/study-planner-store/src/study.rs`
- **Cambio:** agregar los tests indicados en P0-2 a P0-10.
- **Verificación:** `cargo test -p study-planner-store`; se agregaron
  `task_writes_are_atomic_and_dedupe_tags` y `tag_changes_refresh_the_search_index`.
- **Estado:** `[x]`

### P0-12 — Verificación de cierre de fase

- **Comandos:**
  ```bash
  cargo fmt --all -- --check
  cargo clippy -p study-planner-store --all-targets -- -D warnings
  cargo test -p study-planner-store
  ```
- **Estado:** `[x]`

---

## Fase P1 — Integridad referencial en borrados

Objetivo: ningún borrado lógico deja hijos vivos apuntando a un padre borrado. Preferir
rechazar el borrado con `StoreError::Conflict` y un mensaje accionable; si se elige
cascada lógica, hacerla en una sola transacción.

### P1-1 — `delete_subject`

- **Archivos:** `crates/study-planner-store/src/academic.rs`
- **Dependientes a comprobar:** `task.subject_id`, `exam.subject_id`, `topic.subject_id`,
  `note.subject_id`, `grade_scale.subject_id`, `grade_category.subject_id`,
  `grade_entry.subject_id`, `study_session.subject_id`, `attachment.subject_id`.
- **Verificación:** test por cada dependiente vivo ⇒ `Conflict`; sin dependientes ⇒ borra.
  Cubierto por `deleting_a_subject_requires_no_live_domain_data` (tarea y tema) y las
  comprobaciones de calificaciones, sesiones y adjuntos en el código.
- **Estado:** `[x]`

### P1-2 — `delete_term`

- **Archivos:** `crates/study-planner-store/src/academic.rs`
- **Dependientes:** `subject.term_id`, `exam.term_id`, `rotation_config.term_id`,
  `holiday.term_id`, `class_slot` vía materia.
- **Verificación:** `deleting_a_term_requires_no_live_rotation_or_holidays`.
- **Estado:** `[x]`

### P1-3 — `delete_academic_year`

- **Archivos:** `crates/study-planner-store/src/academic.rs`
- **Dependientes:** términos vivos y todo lo anterior.
- **Verificación:** `soft_deletes_respect_live_children` cubre términos vivos; además se
  comprueban materias, exámenes, rotaciones y feriados colgados de términos del año.
- **Estado:** `[x]`

### P1-4 — `delete_exam`

- **Archivos:** `crates/study-planner-store/src/exams.rs`
- **Dependientes:** `grade_entry.exam_id` viva y adjuntos del examen.
- **Verificación:** `deleting_an_exam_requires_no_live_grade_entries`.
- **Estado:** `[x]`

### P1-5 — `delete_topic`

- **Archivos:** `crates/study-planner-store/src/exams.rs`
- **Cambio:** `self_assessment`, `strength_override` y `review_item` se borran en cascada
  lógica dentro de la misma transacción (datos derivados). `study_session`, `note` y
  `attachment` bloquean el borrado porque son contenido del usuario.
- **Verificación:** `deleting_a_topic_cascades_study_data_and_blocks_sessions`.
- **Estado:** `[x]`

### P1-6 — `delete_class_slot`

- **Archivos:** `crates/study-planner-store/src/schedule.rs`
- **Dependientes:** `class_exception`, `attendance_record`.
- **Verificación:** `deleting_a_slot_requires_no_live_attendance_or_exceptions`.
- **Estado:** `[x]`

### P1-7 — Verificación de cierre de fase

- **Comandos:** `cargo fmt --all -- --check`, `cargo test -p study-planner-store` y
  `cargo clippy -p study-planner-store --all-targets -- -D warnings`.
- **Resultado:** 53 tests OK; Clippy sin advertencias.
- **Estado:** `[x]`

---

## Fase P2 — Validación de datos importados y límites

### P2-1 — Normalizar color en la importación

- **Archivos:** `crates/study-planner-transfer/src/lib.rs`
- **Cambio:** `normalize_import_color` pasa `subject.color` y `tag.color` por
  `normalize_color` antes de insertar. En `subject` el vacío cae al color por defecto; en
  `tag` el vacío queda como `NULL`. Un formato inválido rechaza la fila con `InvalidFormat`.
- **Verificación:** `normalizes_subject_and_tag_colors_during_import` y
  `rejects_invalid_colors_during_import`.
- **Estado:** `[x]`

### P2-2 — Validar color en el frontend

- **Archivos:** `src/lib/color.ts`, `src/lib/color.test.ts`,
  `src/views/AcademicView.tsx`, `src/views/TodaySchedule.tsx`, `src/views/ScheduleView.tsx`
- **Cambio:** `safeColor` acepta solo `#RGB`/`#RRGGBB` (con o sin almohadilla), expande la
  forma corta y cae a `#6750A4`. Se usa en todos los estilos inline con color de materia.
- **Verificación:** `src/lib/color.test.ts` (4 tests) y `npm run check`.
- **Estado:** `[x]`

### P2-3 — Validar `saved.queryJson` al aplicarlo

- **Archivos:** `src/lib/taskFilter.ts`, `src/lib/taskFilter.test.ts`,
  `src/views/TasksView.tsx`, `src/locales/{es,en}.ts`
- **Cambio:** `parseTaskFilter` valida cada campo conocido (strings, estado, prioridad
  entera, booleano) y descarta el filtro completo si alguno no cumple. Los campos
  desconocidos se ignoran. `TasksView` muestra `tasks.filterInvalid` en vez de aplicar un
  filtro corrupto.
- **Verificación:** `src/lib/taskFilter.test.ts` (5 tests) y `npm run check`.
- **Estado:** `[x]`

### P2-4 — Límites de `estimate_minutes` y recurrencia

- **Archivos:** `crates/study-planner-store/src/tasks.rs`
- **Cambio:** `estimate_minutes` se limita a `0..=10080` (7 días) y el intervalo de
  recurrencia a `1..=365`.
- **Verificación:** `supports_subtasks_and_recurrence_validation` cubre ambos topes.
- **Estado:** `[x]`

### P2-5 — Validar settings importados

- **Archivos:** `crates/study-planner-store/src/settings.rs`,
  `crates/study-planner-transfer/src/lib.rs`, `crates/study-planner-store/src/lib.rs`
- **Cambio:** `set_setting` valida clave (`120` caracteres, `[A-Za-z0-9._-]`) y valor
  (JSON válido, `4096` bytes). La importación exige `scope = 'portable'`, una clave de
  `PORTABLE_SETTING_KEYS` y un `value_json` válido.
- **Verificación:** `rejects_invalid_setting_keys_and_values`,
  `rejects_unknown_portable_setting_keys`, `rejects_invalid_setting_json` y
  `export_skips_unknown_portable_settings` (la exportación también filtra la whitelist).
- **Estado:** `[x]`

### P2-6 — Acotar minutos de estudio y `priority_decay_days`

- **Archivos:** `crates/study-planner-store/src/study.rs`,
  `crates/study-planner-core/src/study.rs`, `crates/study-planner-core/src/lib.rs`
- **Cambio:** sesiones limitadas a `0..=1440` minutos y `0..=1000` interrupciones;
  `priority_decay_days` se acota a `1..=365`; la prioridad y los agregados usan
  `saturating_add`/`saturating_mul` y `effective_session_minutes` se acota a 24 h.
- **Verificación:** `sessions_validate_planned_minutes_and_topic_subject` y
  `priority_and_totals_clamp_hostile_inputs`.
- **Estado:** `[x]`

### P2-7 — Verificación de cierre de fase

- **Comandos:** `cargo test -p study-planner-store -p study-planner-transfer -p study-planner-core`,
  `cargo clippy ... -D warnings`, `npm run check`
- **Resultado:** core 43 OK, store 54 OK, transfer 21 OK; Clippy sin advertencias;
  `npm run check` con 49 tests y build correcto.
- **Estado:** `[x]`

---

## Fase P3 — Endurecimiento y mantenimiento

### P3-1 — Reducir `core:default`

- **Archivos:** `src-tauri/capabilities/default.json`, `scripts/audit-network.sh`,
  `docs/{ARCHITECTURE,DECISIONS,CHECKLIST,SECURITY}.md`
- **Cambio:** se quitó `core:default` y se listaron los permisos que la UI invoca:
  `core:event:allow-listen` y `core:event:allow-unlisten` (`onResized` también
  desregistra), `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close`,
  `allow-start-dragging`, `allow-start-resize-dragging` y `allow-is-maximized`. La
  auditoría exige ese conjunto y rechaza `core:default`. Decisión en **ADR-022**.
- **Verificación:** `./scripts/audit-network.sh`, `npm run check` (test
  `WindowControls.test.tsx` comprueba `minimize`, `toggleMaximize`, `close`,
  `isMaximized` y `onResized`) y `npx tauri build --no-bundle`. La app compila y
  arranca sin errores; el cableado de la barra de título queda cubierto por el test.
- **Estado:** `[x]`

### P3-2 — Permisos de `vault.json` y carpeta de configuración

- **Archivos:** `src-tauri/src/vault.rs`
- **Cambio:** `restrict_directory`/`restrict_file` en `config_path` y `write_root`; test
  `config_directory_and_file_are_restricted` para los modos `0700`/`0600`.
- **Verificación:** `cargo test -p study-planner` (20 OK), `cargo clippy -p study-planner
  --all-targets -- -D warnings` y `cargo fmt --all -- --check`.
- **Estado:** `[x]`

### P3-3 — Permisos del socket de instancia única

- **Archivos:** `src-tauri/src/instance.rs`
- **Cambio:** `0600` tras `UnixListener::bind`, con test de modo.
- **Verificación:** `cargo test -p study-planner el_socket_de_instancia_queda_en_0600`.
- **Estado:** `[x]`

### P3-4 — `restore_main_backup` consistente ante fallo de reapertura

- **Archivos:** `src-tauri/src/vault.rs`
- **Cambio:** si falla la restauración o la reapertura, se vuelve a copiar el backup
  `pre-restore-*`, se reabre la bóveda anterior y se conserva la sesión. Solo si el
  rollback también falla, la bóveda queda cerrada y el error indica dónde está el backup
  recuperable.
- **Verificación:** `cargo test -p study-planner` y compilación del host.
- **Estado:** `[x]`

### P3-5 — Notificaciones: claims atascados y truncado

- **Archivos:** `crates/study-planner-store/src/notifications.rs`,
  `src-tauri/src/notifications.rs`
- **Cambio:** `release_notification` marca `released` sin borrar la fila; un reclamo
  liberado se reutiliza. `release_stale_notifications(30)` libera claims `scheduled`
  colgados y el planificador lo llama antes de cada pasada. Se quitó el truncado a 10.
- **Verificación:** `releases_a_failed_claim_for_retry`,
  `releases_stale_scheduled_claims` y `does_not_truncate_the_reminder_list`.
- **Estado:** `[x]`

### P3-6 — Undo de tareas revalida contexto

- **Archivos:** `crates/study-planner-store/src/undo.rs`
- **Cambio:** se lee `before_json` para recuperar `subjectId`/`parentTaskId` y se rechaza
  el undo si la materia o la tarea padre ya no están vivas.
- **Verificación:** `undo_rejects_a_task_whose_subject_was_deleted` y
  `undo_rejects_a_task_whose_parent_was_deleted`.
- **Estado:** `[x]`

### P3-7 — Validar materia/término en exámenes

- **Archivos:** `crates/study-planner-store/src/exams.rs`
- **Cambio:** `ensure_subject_belongs_to_term` en `create_exam` y `update_exam`.
- **Verificación:** `rejects_an_exam_whose_subject_belongs_to_another_term`.
- **Estado:** `[x]`

### P3-8 — Verificaciones de backup y migración

- **Archivos:** `crates/study-planner-store/src/backup.rs`,
  `crates/study-planner-store/src/lib.rs`
- **Cambio:** `verify_backup` rechaza esquemas más nuevos que `SCHEMA_VERSION`; el runner
  de migraciones verifica el checksum de cada migración aplicada y exige su fila en
  `schema_migration`.
- **Verificación:** `verify_backup_rejects_a_newer_schema`,
  `rejects_a_tampered_migration_checksum` y `applies_migrations_after_a_v1_database`.
- **Estado:** `[x]`

### P3-9 — Índices `UNIQUE` parciales en tablas con soft-delete

- **Archivos:** `crates/study-planner-store/migrations/0002_partial_unique_indexes.sql`
  (nueva), `crates/study-planner-core/src/lib.rs`, `crates/study-planner-store/src/lib.rs`
- **Cambio:** migración v2 que reconstruye `strength_override`, `review_item` y
  `notification` sin el `UNIQUE` de columna y crea índices parciales
  `WHERE deleted_at IS NULL`. `SCHEMA_VERSION` sube a 2. Decisión en **ADR-023**.
- **Verificación:** `applies_migrations_after_a_v1_database`,
  `partial_unique_indexes_ignore_soft_deleted_rows` y round-trip de transferencia.
- **Estado:** `[x]`

### P3-10 — Endurecer CI

- **Archivos:** `.github/workflows/{ci,release,snap,store-msix}.yml`, `snap/snapcraft.yaml`
- **Cambio:** todas las acciones quedan fijadas por SHA con su versión como comentario.
  En `release.yml` los permisos son `contents: read` a nivel global y sólo el job de
  publicación obtiene `contents: write`. El instalador de Rust se descarga a un archivo y
  se ejecuta después, sin `curl | sh`.
- **Verificación:** revisión de YAML y `bash scripts/check-snap-version.sh`.
- **Estado:** `[x]`

### P3-11 — Verificación de cierre de fase

- **Comandos:** `./scripts/check.sh`, `./scripts/audit-network.sh`,
  `./scripts/audit-licenses.sh`
- **Resultado:** suite completa en verde; auditorías sin hallazgos.
- **Estado:** `[x]`

---

## Cierre del plan

Las fases P0 a P3 quedaron completas el 2026-11-16. No quedan ítems abiertos ni
bloqueados. Las decisiones de esquema quedaron en **ADR-023** y el estado del proyecto
en `docs/CHECKLIST.md`.

---

## Registro de avance

| Fecha | Ítem | Archivos | Verificación | Nota |
|---|---|---|---|---|
| 2026-11-16 | Plan creado | `docs/INTEGRITY_FIXES.md` | — | Snapshot inicial, todo pendiente. |
| 2026-11-16 | P0-1 | `crates/study-planner-store/src/lib.rs` | `cargo test -p study-planner-store` | Helper `with_transaction` con `unchecked_transaction`. |
| 2026-11-16 | P0-2…P0-4 | `crates/study-planner-store/src/tasks.rs` | 48 tests OK | Tarea/etiquetas/FTS atómicos; `apply_task_tags` + `ensure_live_tags` + dedupe. |
| 2026-11-16 | P0-5 | `crates/study-planner-store/src/tasks.rs` | 48 tests OK | `delete_task` + FTS + undo en una transacción. |
| 2026-11-16 | P0-6…P0-7 | `crates/study-planner-store/src/tasks.rs` | 2 tests nuevos | `delete_tag` atómico; `update_tag` refresca solo las tareas afectadas. |
| 2026-11-16 | P0-8…P0-10 | `crates/study-planner-store/src/{study,grades}.rs` | 48 tests OK | `review_topic`, `set_strength_override` y escalas en transacción. |
| 2026-11-16 | P0-11…P0-12 | `crates/study-planner-store/src/tasks.rs` | fmt + clippy `-D warnings` + 48 tests OK | Tests `task_writes_are_atomic_and_dedupe_tags` y `tag_changes_refresh_the_search_index`. |
| 2026-11-16 | P1-1 | `crates/study-planner-store/src/{lib,academic}.rs` | 53 tests OK | `ensure_no_live_rows`; `delete_subject` comprueba tareas, exámenes, temas, notas, calificaciones, sesiones y adjuntos. |
| 2026-11-16 | P1-2…P1-3 | `crates/study-planner-store/src/academic.rs` | 53 tests OK | `delete_term` y `delete_academic_year` comprueban todos los descendientes vivos. |
| 2026-11-16 | P1-4…P1-5 | `crates/study-planner-store/src/exams.rs` | 53 tests OK | `delete_exam` bloquea notas y adjuntos; `delete_topic` bloquea sesiones/notas/adjuntos y borra en cascada evaluación, override y repaso. |
| 2026-11-16 | P1-6…P1-7 | `crates/study-planner-store/src/schedule.rs` | fmt + clippy `-D warnings` + 53 tests OK | `delete_class_slot` bloquea asistencia y excepciones; 5 tests nuevos en total. |
| 2026-11-16 | P2-1 | `crates/study-planner-transfer/src/lib.rs` | transfer 20 tests OK | `normalize_import_color` normaliza `subject.color`/`tag.color` y rechaza formatos inválidos. |
| 2026-11-16 | P2-2 | `src/lib/color.ts`, `src/views/{AcademicView,TodaySchedule,ScheduleView}.tsx` | `npm run check` | `safeColor` centraliza la validación de colores inline. |
| 2026-11-16 | P2-3 | `src/lib/taskFilter.ts`, `src/views/TasksView.tsx` | 49 tests frontend OK | `parseTaskFilter` valida `saved.queryJson` y muestra error si es corrupto. |
| 2026-11-16 | P2-4 | `crates/study-planner-store/src/tasks.rs` | store 54 tests OK | Topes de 7 días para estimación y 365 para recurrencia. |
| 2026-11-16 | P2-5 | `crates/study-planner-store/src/{settings,lib}.rs`, `crates/study-planner-transfer/src/lib.rs` | store 54 + transfer 21 OK | Claves portables en whitelist, JSON válido y límite de 4 KiB; exportación alineada. |
| 2026-11-16 | P2-6 | `crates/study-planner-{store,core}/src/study.rs` | core 43 + store 54 OK | Límites de sesión/decay y sumas saturantes. |
| 2026-11-16 | P2-7 | Verificación global | clippy `-D warnings` + `npm run check` | 49 tests frontend y build correcto; P2 cerrada. |
| 2026-11-16 | P3-1 | `src-tauri/capabilities/default.json`, `scripts/audit-network.sh`, docs | `audit-network.sh` OK; `npx tauri build --no-bundle` OK | `core:default` reemplazado por permisos explícitos (ADR-022); la auditoría exige el conjunto y rechaza `core:default`. Falta la demo visual. |
| 2026-11-16 | P3-2 | `src-tauri/src/vault.rs` | 20 tests host + clippy `-D warnings` + fmt | Carpeta de configuración `0700` y `vault.json` `0600`; test de modos. |
| 2026-11-16 | P3-1 | `src/components/WindowControls.test.tsx` | `npm run check` (50 tests) + audit + build | Controles de ventana cubiertos por test; `core:default` fuera (ADR-022). |
| 2026-11-16 | P3-3 | `src-tauri/src/instance.rs` | host 21 tests | Socket de instancia única en `0600` con test de modo. |
| 2026-11-16 | P3-4 | `src-tauri/src/vault.rs` | host 21 tests | Rollback al backup `pre-restore-*` y sesión conservada si falla la reapertura. |
| 2026-11-16 | P3-5 | `crates/study-planner-store/src/notifications.rs`, `src-tauri/src/notifications.rs` | store 63 tests | Reclamos liberados sin borrar, limpieza de `scheduled` viejos y sin truncado a 10. |
| 2026-11-16 | P3-6 | `crates/study-planner-store/src/undo.rs` | store 63 tests | Undo revalida materia y tarea padre desde `before_json`. |
| 2026-11-16 | P3-7 | `crates/study-planner-store/src/exams.rs` | store 63 tests | Examen rechaza materia de otro término en alta y actualización. |
| 2026-11-16 | P3-8 | `crates/study-planner-store/src/{backup,lib}.rs` | store 63 tests | Backup rechaza esquema futuro; checksums de migración verificados. |
| 2026-11-16 | P3-9 | `migrations/0002_partial_unique_indexes.sql` | store 63 tests + transfer 21 | Esquema v2 con índices parciales; ADR-023. |
| 2026-11-16 | P3-10 | `.github/workflows/*.yml`, `snap/snapcraft.yaml` | revisión YAML + check-snap-version | Acciones fijadas por SHA, permisos por job y sin `curl \| sh`. |
| 2026-11-16 | P3-11 | Verificación global | `check.sh`, audit-network, audit-licenses | Plan P0–P3 cerrado. |

---

## Hallazgos de referencia

Resumen de la revisión que origina este plan. No es necesario releer el informe completo.

| ID | Severidad | Hallazgo | Ítem del plan |
|---|---|---|---|
| A1 | Alto | Escrituras de tarea/etiquetas/FTS sin transacción | P0-2, P0-3, P0-4 |
| A2 | Alto | Rebuild de FTS no atómico al borrar etiqueta | P0-6 |
| A3 | Alto | Borrado de materia/término/año con dependientes vivos | P1-1, P1-2, P1-3 |
| A4 | Alto | Borrado de examen/tema con dependientes vivos | P1-4, P1-5 |
| A5 | Alto | Borrado de franja oculta asistencia/excepciones | P1-6 |
| M1 | Medio | `review_topic` no atómico | P0-8 |
| M2 | Medio | `update_tag` no refresca FTS | P0-7 |
| M3 | Medio | Escalas de nota: default y cambio de materia | P0-10 |
| M4 | Medio | Dedupe de notificaciones puede suprimir avisos | P3-5 |
| M5 | Medio | Undo no revalida contexto | P3-6 |
| M6 | Medio | Examen con término ajeno a la materia | P3-7 |
| M7 | Medio | Settings importados sin validar | P2-5 |
| M8 | Medio | Overflow de minutos y `priority_decay_days` | P2-6 |
| B | Bajo | Permisos, límites, CI, validaciones de UI | P2-1…P2-4, P3-1…P3-4, P3-8…P3-10 |
