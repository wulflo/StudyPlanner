# Study Planner — Checklist de refinamiento de interfaz (2026-11-21)

> **Estado:** completado y verificado (2026-11-21)
> **Objetivo:** ejecutar los pedidos de esta sesión por fases, de modo que un corte
> de internet o de energía no deje el código a medias sin saber dónde retomar.
> **Documentos relacionados:** [`CHECKLIST.md`](CHECKLIST.md) ·
> [`UI_REMODEL_CHECKLIST.md`](UI_REMODEL_CHECKLIST.md) ·
> [`USER_REQUESTS_CHECKLIST.md`](USER_REQUESTS_CHECKLIST.md) ·
> [`DECISIONS.md`](DECISIONS.md)

## Cómo retomar después de un corte

1. Ejecutar `git status --short` para ver los archivos modificados.
2. Leer **Estado actual** y buscar el primer ítem `[ ]` o `[~]`.
3. Si hay un `[~]`, leer su nota: indica el punto exacto donde se cortó.
4. Antes de seguir, verificar que el proyecto siga compilando:
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
| Fase abierta | Ninguna — tanda completa y verificada |
| Último archivo tocado | `docs/UX_REFINEMENT_CHECKLIST.md` |
| Punto de corte reanudado | Tras `src/views/ScheduleView.tsx` (18:16); el snapshot seguía en Fase 0 |
| Dependencias nuevas | Ninguna |
| Licencias | Sin cambios en `THIRD_PARTY_LICENSES.md` |

## Fase 0 — Preparación y resguardo

- [x] Crear esta checklist antes de editar código.
  - Archivo: `docs/UX_REFINEMENT_CHECKLIST.md`.
- [x] Relevar los archivos que se van a tocar y confirmar que no hay cambios
  ajenos sin commitear en esas áreas.
  - Nota: el árbol ya tenía cambios de la sesión anterior; se respetan y se
    continúa sobre ellos.
- [x] Definir el orden de las fases para que cada una deje el proyecto compilando.
  - Orden: limpieza → botones → tabs → temas de estudio → pruebas.

## Fase 1 — Quitar remanentes gráficos de «Diario > Hoy»

**Pedido:** eliminar las cuatro tarjetas «Datos», «Portabilidad», «Privacidad» y
«Continuidad»; son restos del desarrollo y no aportan funcionalidad.

- [x] Quitar la sección `cards` de la vista «Hoy».
  - Archivo: `src/App.tsx`.
  - Punto exacto: bloque `<section className="cards" aria-label={t("today.principlesAria")}>`.
- [x] Quitar las claves de traducción que quedan sin uso.
  - Archivos: `src/locales/es.ts`, `src/locales/en.ts`.
- [x] Verificar que `Trans` siga usándose en otras partes de `App.tsx` antes de
  tocar los imports.
  - Archivo: `src/App.tsx`.
- [x] Verificación: `npm run typecheck`.

## Fase 2 — Botones más compactos

**Pedido:** «anterior», «hoy» y «siguiente» son demasiado largos, grandes y con
padding excesivo; en general todos los botones de la app se ven grandes.

- [x] Reducir el tamaño base de `.button` (padding, tipografía y altura).
  - Archivo: `src/styles.css`.
- [x] Añadir una variante compacta para la navegación semanal y de mes.
  - Archivos: `src/styles.css`, `src/views/ScheduleView.tsx`,
    `src/views/CalendarView.tsx` (si hace falta la clase).
  - Nota: `.week-nav .button` se declaró antes de las reglas más específicas de
    `.mini-list` para no disparar `noDescendingSpecificity` en Biome.
- [x] Revisar que los botones de formularios y acciones no queden demasiado
  pequeños ni se solapen.
  - Archivo: `src/styles.css`.
- [x] Verificación: `npm run typecheck` y revisión visual en `npm run dev`.

## Fase 3 — Subsecciones largas con pestañas horizontales

**Pedido:** las secciones con subsecciones muy largas deben dividir su contenido
con botones alineados horizontalmente en la parte superior de la subsección.

- [x] Crear un componente reutilizable de pestañas accesible.
  - Archivo nuevo: `src/components/Tabs.tsx`.
- [x] Estilos de la barra de pestañas y del panel activo.
  - Archivo: `src/styles.css`.
- [x] Aplicar pestañas en «Materias»: años, términos, materias, temas y plan.
  - Archivo: `src/views/AcademicView.tsx`.
- [x] Aplicar pestañas en «Horario» para las subsecciones de gestión
  (franjas, rotación, feriados y excepciones), dejando la semana visible.
  - Archivo: `src/views/ScheduleView.tsx`.
- [x] Aplicar pestañas en «Notas» (escalas, categorías y entradas).
  - Archivo: `src/views/GradesView.tsx`.
- [x] Aplicar pestañas en «Exámenes» (lista, formulario y temas).
  - Archivo: `src/views/ExamsView.tsx`.
- [x] Textos bilingües de las pestañas.
  - Archivos: `src/locales/es.ts`, `src/locales/en.ts`.
  - Nota: se reutilizan los títulos de cada subsección como etiqueta y se agregan
    `schedule.sectionsAria`, `grades.sectionsAria` y `exams.sectionsAria`.
    `schedule.sectionsAria` no existía y se agregó al reanudar el trabajo.
- [x] Verificación: `npm run typecheck` y `npm test`.

## Fase 4 — Readaptar «Temas de estudio»

**Pedido:** filtrar por materia y por período programado (semana o mes), y evitar
que los intermediarios carguen demasiados datos hasta congelar la app.

- [x] Añadir filtro por rango de fechas y materia en el store, con consultas
  por lote para no hacer N+1 por tema.
  - Archivo: `crates/study-planner-store/src/study.rs`.
- [x] Exponer `from` y `to` opcionales en el comando Tauri.
  - Archivo: `src-tauri/src/vault.rs`.
- [x] Extender el cliente IPC con los parámetros opcionales.
  - Archivo: `src/lib/ipc.ts`.
- [x] Rediseñar la subsección: materia (incluida «Todas»), período
  (semana/mes/todo), lista acotada con «Mostrar más» y estado de carga.
  - Archivo: `src/views/AcademicView.tsx`.
- [x] Textos bilingües del nuevo filtro y de la lista.
  - Archivos: `src/locales/es.ts`, `src/locales/en.ts`.
- [x] Evitar carreras entre filtros: descartar respuestas viejas y no bloquear
  la interfaz mientras carga.
  - Archivo: `src/views/AcademicView.tsx`.
  - Nota: el selector de período pasó de `<div role="group">` a `<fieldset>` para
    cumplir `a11y/useSemanticElements`; `.study-range` se ajustó con `margin: 0`
    y `min-width: 0`.
- [x] Verificación: `cargo test -p study-planner-store`, `npm run check`.

## Fase 5 — Pruebas, documentación y cierre

- [x] Actualizar los tests que dependían de contenido ahora oculto en pestañas.
  - Archivo: `src/App.tauri.test.tsx`.
- [x] Registrar las decisiones de arquitectura relevantes.
  - Archivo: `docs/DECISIONS.md`.
  - Nota: ADR-026 — pestañas accesibles, botones compactos y carga acotada de
    temas de estudio.
- [x] Ejecutar la verificación completa:
  ```bash
  npm run check
  cargo fmt --all -- --check
  cargo clippy -p study-planner-store --all-targets -- -D warnings
  cargo test -p study-planner-store
  ```
  - Resultado: `npm run check` correcto (typecheck, Biome, 66 tests y build);
    `cargo fmt --all -- --check` y `cargo clippy … -D warnings` correctos tras
    formatear `study.rs`; `cargo test -p study-planner-store` con 68 tests OK.
  - Nota: la compilación de Vite avisa de un chunk >500 kB; es advertencia
    preexistente, no un error.
- [x] Actualizar esta checklist con el resultado final y los archivos tocados.

## Resultado final

- Todas las fases quedan en `[x]`. El corte se produjo después de editar
  `src/views/ScheduleView.tsx` y antes de formatear y verificar; el snapshot
  seguía marcando Fase 0.
- Se completaron las pestañas de Notas y Exámenes, las claves `sectionsAria`
  ausentes, el `<fieldset>` del filtro de períodos y el orden de la regla
  `.week-nav .button`.
- Verificación final en verde: `npm run check` (66 tests y build),
  `cargo fmt --all -- --check`, `cargo clippy … -D warnings` y
  `cargo test -p study-planner-store` (68 tests).
- Sin dependencias nuevas ni cambios en `THIRD_PARTY_LICENSES.md`.

## Registro de archivos

| Fecha | Fase | Archivo | Cambio | Verificación |
|---|---|---|---|---|
| 2026-11-21 | 0 | `docs/UX_REFINEMENT_CHECKLIST.md` | Checklist creada antes de editar código. | — |
| 2026-11-21 | 1 | `src/App.tsx` | Sección `cards` eliminada de «Hoy»; `Trans` sigue en uso. | `npm run typecheck` |
| 2026-11-21 | 1 | `src/locales/{es,en}.ts` | Claves sin uso de las cuatro tarjetas eliminadas. | `npm run check` |
| 2026-11-21 | 2 | `src/styles.css` | `.button` reducido y `.week-nav .button` compacto, reordenado en la cascada. | `npm run lint` |
| 2026-11-21 | 3 | `src/components/Tabs.tsx` | Componente reutilizable accesible con foco y panel activo. | `npm test` |
| 2026-11-21 | 3 | `src/views/AcademicView.tsx`, `src/views/ScheduleView.tsx` | Pestañas en Materias y en la gestión de Horario. | `npm test` |
| 2026-11-21 | 3 | `src/views/GradesView.tsx`, `src/views/ExamsView.tsx` | Pestañas en Notas y Exámenes (completado al reanudar). | `npm test` |
| 2026-11-21 | 3/4 | `src/locales/{es,en}.ts` | `sectionsAria` de Horario/Notas/Exámenes y textos del filtro de temas. | `npm run check` |
| 2026-11-21 | 4 | `crates/study-planner-store/src/study.rs` | `list_topic_studies_in_range`: filtro por materia/rango y carga por lote; formateo rustfmt. | `cargo test` (68), `cargo fmt --check` |
| 2026-11-21 | 4 | `src-tauri/src/vault.rs`, `src/lib/ipc.ts` | Parámetros opcionales `from`/`to` expuestos al cliente. | `npm run typecheck` |
| 2026-11-21 | 4 | `src/views/AcademicView.tsx` | Filtro materia/período, «Mostrar más», estado de carga, guarda de carreras y `<fieldset>` accesible. | `npm test` |
| 2026-11-21 | 5 | `src/App.tauri.test.tsx` | Tests ajustados para activar la pestaña antes de buscar el contenido. | `npm test` (66) |
| 2026-11-21 | 5 | `docs/DECISIONS.md` | ADR-026: pestañas accesibles y carga acotada de temas. | — |
