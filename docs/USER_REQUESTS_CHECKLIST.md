# Study Planner — Checklist de pedidos de usuario (2026-11-21)

> **Estado:** completado y verificado (2026-11-21)
> **Objetivo:** ejecutar los cinco pedidos de la sesión sin romper el código, dejando
> registro de cada archivo tocado para poder retomar después de un corte de señal.
> **Documentos relacionados:** [`CHECKLIST.md`](CHECKLIST.md) ·
> [`UI_REMODEL_CHECKLIST.md`](UI_REMODEL_CHECKLIST.md) · [`DECISIONS.md`](DECISIONS.md) ·
> [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md)

## Cómo retomar

1. `git status --short` para ver los archivos modificados.
2. Leer **Estado actual** y buscar el primer ítem `[ ]` o `[~]`.
3. Si hay un `[~]`, leer su nota: indica el punto exacto donde se cortó.
4. Ejecutar la verificación indicada antes de seguir:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   cargo test -p study-planner-store
   ```
5. Al terminar un ítem: cambiar a `[x]`, agregar la fila en **Registro de archivos**
   y actualizar el snapshot. No borrar ítems completados.

### Convenciones

| Marca | Significado |
|---|---|
| `[ ]` | Pendiente. |
| `[~]` | En curso. Debe indicar el punto exacto donde se cortó. |
| `[x]` | Hecho y verificado. |
| `[!]` | Bloqueado; anotar el motivo. |

## Estado actual (snapshot)

| Campo | Valor |
|---|---|
| Ítem abierto | Ninguno — tanda completa y verificada |
| 1. Checksum entre dispositivos | `[x]` |
| 2. Exámenes: paginación y sincronización con notas | `[x]` |
| 3. Distribución de botones | `[x]` |
| 4. Temas y repasos dentro de materias | `[x]` |
| 5. Quitar indicador «Sin conexión» | `[x]` |
| Dependencias nuevas | Ninguna |
| Licencias | Sin cambios en `THIRD_PARTY_LICENSES.md` |

## Pedido 1 — El checksum no debe bloquear la bóveda entre dispositivos

**Problema:** al abrir una bóveda creada o sincronizada en otro equipo, la verificación
del checksum de las migraciones ya aplicadas puede fallar y la app obliga a recrear la
bóveda. El texto de las migraciones embebidas puede cambiar entre compilaciones, equipos
o sincronizaciones, aunque el esquema real sea correcto.

**Decisión:** dejar de tratar una diferencia de checksum como error fatal. Si la fila de
`schema_migration` existe pero el checksum no coincide, se **repara** con el checksum
actual y se continúa. Si falta la fila, se inserta. La integridad real sigue verificándose
con `PRAGMA integrity_check`, `foreign_key_check` y `PRAGMA user_version`.

- [x] Reparar el checksum en lugar de rechazar la bóveda.
  - Archivo: `crates/study-planner-store/src/lib.rs`.
- [x] Actualizar el test de regresión para comprobar la reparación.
  - Archivo: `crates/study-planner-store/src/lib.rs` (módulo `tests`).
- [x] Registrar la decisión en `docs/DECISIONS.md` (ADR-024).
- [x] Verificación: `cargo test -p study-planner-store`.
- **Archivos tocados:** `crates/study-planner-store/src/lib.rs`, `docs/DECISIONS.md`.

## Pedido 2 — Exámenes: pocos visibles, filtro de cantidad y sin doble carga en Notas

**Problema:** la sección de exámenes de una materia carga todos los exámenes y, por cada
uno, consulta sus temas vinculados (N+1). Además, el resultado de un examen se vuelve a
escribir a mano en Notas.

**Solución:**

- Mostrar solo una página de exámenes con selector de cantidad (`5`, `10`, `20`, `50`) y
  botón «Cargar más» como precarga intermedia.
- Cargar los vínculos examen–tema solo para los exámenes visibles y mostrar un estado de
  carga mientras llegan.
- Sincronizar automáticamente el resultado del examen con una entrada de nota vinculada
  (`grade_entry.exam_id`). Si el examen no tiene resultado, la entrada se oculta/borra
  lógicamente. Al borrar el examen, sus entradas derivadas se borran en cascada lógica.
- Si la materia no tiene escala o categoría, se crea una escala por defecto y una
  categoría «Exámenes» al guardar el primer resultado.

- [x] Añadir sincronización examen → nota en el store y tests.
  - Archivo: `crates/study-planner-store/src/exams.rs`.
- [x] Actualizar el test de borrado: ahora la entrada derivada se borra en cascada.
  - Archivo: `crates/study-planner-store/src/exams.rs`.
- [x] Crear escala y categoría «Exámenes» por defecto si la materia no tiene.
  - Archivo: `crates/study-planner-store/src/exams.rs`.
- [x] Paginación, selector de cantidad y carga diferida de vínculos en la vista.
  - Archivo: `src/views/ExamsView.tsx`.
  - Detalle: paginación en cliente (`5/10/20/50` + «Cargar más») y vínculos
    examen–tema pedidos solo para los exámenes visibles.
- [x] Textos bilingües para paginación, carga y sincronización.
  - Archivos: `src/locales/en.ts`, `src/locales/es.ts`.
- [x] Estilos de la barra de filtros y del estado de carga.
  - Archivo: `src/styles.css`.
- [x] Registrar la decisión en `docs/DECISIONS.md` (ADR-025).
- [x] Verificación: `cargo test -p study-planner-store`, `npm run check`.
- **Archivos tocados:** `crates/study-planner-store/src/exams.rs`,
  `src/views/ExamsView.tsx`, `src/locales/en.ts`, `src/locales/es.ts`,
  `src/styles.css`.

## Pedido 3 — Distribución horizontal de botones en todas las secciones

**Problema:** varias filas de listas y formularios apilan sus botones en vertical y dejan
espacio vacío, en vez de aprovechar el ancho del contenedor.

**Solución:** las filas de listas con acciones pasan a ser filas horizontales que envuelven
solo cuando no hay ancho; las cabeceras y grupos de acciones usan `flex-wrap` y
`justify-content: space-between`. Se conserva el apilado solo en las tarjetas de texto.

- [x] Reglas globales para `.mini-item` con acciones, `.task-board-head` y grupos de
  acciones.
  - Archivo: `src/styles.css`.
- [x] Revisión de vistas con listas de acciones: exámenes, notas, tareas, estudio,
  ajustes y plan de estudios.
  - Archivos revisados: `src/views/*.tsx`.
- [x] Verificación: `npm run typecheck`, `npm run lint`, `npm test`.

## Pedido 4 — Temas de estudio y repaso con fecha dentro de Materias

**Problema:** los temas viven en Exámenes y el repaso SM-2 en Fortalezas; desde Materias
no hay forma de guardar un tema y marcar que se repasó con fecha.

**Solución:** nueva subsección «Temas de estudio» en Materias, con selector de materia,
alta/baja de temas, fecha del último repaso, próximo repaso y botón «Marcar repaso» con
fecha (por defecto hoy). Usa el SM-2 existente (`review_topic`) y la autoevaluación.

- [x] Añadir la subsección y el formulario de temas en la vista de materias.
  - Archivo: `src/views/AcademicView.tsx`.
- [x] Cargar `listTopicStudies`, `createTopic`, `deleteTopic` y `reviewTopic` desde IPC.
  - Archivos: `src/views/AcademicView.tsx`, `src/lib/ipc.ts` (sin cambios de contrato).
- [x] Textos bilingües para temas, repaso y fechas.
  - Archivos: `src/locales/en.ts`, `src/locales/es.ts`.
- [x] Estilos para la lista de temas y sus acciones.
  - Archivo: `src/styles.css`.
- [x] Verificación: `npm run check`.

## Pedido 5 — Quitar el indicador «Sin conexión»

- [x] Quitar el chip de la barra superior.
  - Archivo: `src/App.tsx`.
- [x] Quitar las claves `app.localChip` de ambos idiomas y el estilo `.local-chip`.
  - Archivos: `src/locales/en.ts`, `src/locales/es.ts`, `src/styles.css`.
- [x] Verificación: `npm run check`.

## Verificación final

- [x] `npm run check` (typecheck, Biome, 66 tests de Vitest y build).
- [x] `cargo fmt --all -- --check`.
- [x] `cargo clippy -p study-planner-store --all-targets -- -D warnings`.
- [x] `cargo test -p study-planner-store` (68 tests).
- [x] `./scripts/audit-network.sh`.
- [x] Sin dependencias nuevas: `package.json`, `package-lock.json` y
  `THIRD_PARTY_LICENSES.md` no requieren cambios.

## Registro de archivos

| Fecha | Ítem | Archivo | Cambio | Verificación |
|---|---|---|---|---|
| 2026-11-21 | 0 | `docs/USER_REQUESTS_CHECKLIST.md` | Checklist creada antes de editar código. | — |
| 2026-11-21 | 1 | `crates/study-planner-store/src/lib.rs` | Checksum de migración se repara en vez de bloquear; test actualizado. | `cargo test -p study-planner-store` |
| 2026-11-21 | 1 | `docs/DECISIONS.md` | ADR-024: checksum tolerante y reparación. | — |
| 2026-11-21 | 2 | `crates/study-planner-store/src/exams.rs` | Sincronización examen → nota, escala/categoría por defecto y cascada al borrar. | `cargo test -p study-planner-store` (68) |
| 2026-11-21 | 2 | `src/views/ExamsView.tsx` | Paginación 5/10/20/50, «Cargar más» y vínculos solo para visibles. | `npm run check` |
| 2026-11-21 | 2 | `src/locales/{en,es}.ts` | Textos de paginación, carga y materia de temas. | `npm run check` |
| 2026-11-21 | 2 | `src/styles.css` | Barra de lista y estado de carga. | `npm run check` |
| 2026-11-21 | 3 | `src/styles.css` | Filas de acciones horizontales. | `npm run check` |
| 2026-11-21 | 2 | `src/App.tauri.test.tsx` | Ajuste del test por el selector de materia de temas. | `npm test` (66) |
| 2026-11-21 | 2 | `docs/DECISIONS.md` | ADR-025: resultado del examen sincronizado con Notas. | — |
| 2026-11-21 | 4 | `src/views/AcademicView.tsx` | Temas de estudio y repaso con fecha. | `npm run check` |
| 2026-11-21 | 5 | `src/App.tsx`, `src/locales/{en,es}.ts`, `src/styles.css` | Chip «Sin conexión» eliminado. | `npm run check` |
