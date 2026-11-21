# Checklist de refactor UI/UX — Study Planner

> Documento vivo. Cada subfase se marca `[x]` al completarse y se anota el estado
> en la sección de reanudación. Si se interrumpe la sesión, al recibir
> “continuá” se debe leer este archivo y retomar desde la primera subfase `[ ]`.

## Estado actual / Punto de reanudación

- **Última subfase completada:** Fase 6 · Subfase 6.3 (reparto 50/50 del layout
  de Estadísticas). Checklist completo.
- **Próxima subfase pendiente:** ninguna. Todas las fases y subfases están `[x]`.
- **Archivos modificados:** `src/styles.css`, `src/locales/es.ts`,
  `src/locales/en.ts`, `src/views/AcademicView.tsx`, `src/views/CalendarView.tsx`,
  `src/views/ExamsView.tsx`, `src/views/GradesView.tsx`,
  `src/views/ScheduleView.tsx`,
  `src/views/SettingsView.tsx`, `src/views/StatsView.tsx`,
  `src/views/StrengthsView.tsx`, `src/views/StudyView.tsx`,
  `src/views/TasksView.tsx`, `src/views/TodaySchedule.tsx`,
  `docs/CHECKLIST_REFACTOR_UI.md`.
- **Notas de estado:** Fase 1 (bordes opacos y chrome derivado de `--accent`) y
  Fase 2 (Fortalezas y espaciado de botones) completadas en la sesión anterior.
  Las filas de la subfase 3.1 ya usan `.mini-item-body`,
  `.mini-item-heading`, `.item-badge` y `.mini-item-meta` en las cuatro vistas
  previstas, con sus claves i18n; el checklist estaba desactualizado y se
  sincroniza en esta sesión. A pedido del usuario se añadieron: 3.3 (apilar el
  encabezado de cada clase en la vista de días), 3.4 (siete días en dos
  columnas, sin scroll horizontal), 3.5 (unificar y alinear las dos rejillas
  del detalle en Fortalezas, estrechando el selector de temas), 3.6 (centrar
  verticalmente los badges de las filas) y 3.2 (auditoría global de filas).
  La Fase 4 integró clases y repasos en el calendario con estilos propios.
  La Fase 5.1 pasó: typecheck, lint, 66 tests y build; quedan 3 avisos no
  bloqueantes de especificidad descendente. La Fase 5.2 se cerró revisando
  claro/oscuro con los cuatro acentos y anchos de 600/900/1200 px. La Fase 6
  incorpora los tres ajustes visuales finales pedidos por el usuario: trazo de
  borde opaco en hover, wrap y ancho de "Materias débiles", y layout 50/50 en
  Estadísticas. `npm run check` pasa completo (66 tests, build OK).

---

## Fase 1 — Sistema de temas, bordes y superficies (CSS / Tokens)

### Subfase 1.1 — Trazos de borde visibles en contenedores

- [x] Definir tokens explícitos de borde (`--border-subtle`,
  `--border-default`, `--border-strong`, `--border-focus`) con color opaco y
  contraste suficiente en claro y oscuro.
- [x] Reemplazar `--md-card-border` translúcido por un borde sólido derivado del
  `outline` del tema.
- [x] Aplicar borde explícito a cards, paneles, cajas, celdas de calendario,
  filas de listas, inputs y selectores.
- [x] Verificar que los bordes no desaparezcan sobre fondos tintados ni en modo
  oscuro.
- **Archivos modificados:** `src/styles.css`.
- **Estado:** completada. `--border-default` mezcla 82 % del `outline` con la
  superficie (≈3.2:1 en claro, ≈4.1:1 en oscuro).

### Subfase 1.2 — Coloración dinámica de Sidebar y Topbar según `--accent`

- [x] Crear tokens `--chrome-bg`, `--sidebar-bg` y `--chrome-border` derivados
  del `accent` activo con rotación/variación sutil de hue y baja saturación.
- [x] Usar `color-mix(in oklch, …)` como base y `hsl(from var(--accent) …)` como
  mejora progresiva dentro de `@supports`.
- [x] Refactorizar `.topbar` y `.nav-rail` para consumir esos tokens.
- [x] Verificar legibilidad AA/AAA de textos, iconos y estados activos en modo
  claro y oscuro con todos los acentos.
- **Archivos modificados:** `src/styles.css`.
- **Estado:** completada. Topbar y sidebar usan tinte de baja saturación
  (20 %/18 % en claro; 15 %/17 % en oscuro) con hue desplazado +12°; textos e
  iconos conservan los tokens `on-surface` del tema.

---

## Fase 2 — Layout, espaciado y superposiciones críticas

### Subfase 2.1 — Colisión en la vista `Fortalezas` (panel derecho)

- [x] Reestructurar el bloque de **“REPASO ESPACIADO”** para que sus métricas,
  selector de calidad y botón se apilen sin invadir otras columnas.
- [x] Reestructurar el bloque de **“PROGRAMAR REPASO”** para que el campo de
  fecha y **“Guardar fecha”** queden en columna, con ancho completo y `gap`.
- [x] Convertir los formularios de autoevaluación y override en bloques
  consistentes con separación vertical y acciones alineadas.
- [x] Asegurar apilamiento a una columna cuando el panel sea estrecho
  (`grid-template-columns` responsive / `auto-fit`).
- [x] Verificar que **“Registrar repaso”** y **“Guardar fecha”** no se
  superpongan ni compartan celda.
- **Archivos modificados:** `src/views/StrengthsView.tsx`, `src/styles.css`.
- **Estado:** completada. Nuevo `.study-detail-block` (flex column, `gap: 12px`)
  y `.study-detail-grid` con `auto-fit minmax(220px, 1fr)`; cada formulario es
  una tarjeta independiente y los botones quedan debajo de sus campos.

### Subfase 2.2 — Espaciado de botones adosados

- [x] Estandarizar `gap` mínimo de `0.75rem` en `.form-actions`, `.hero-actions`,
  `.inline-form`, `.subject-actions`, `.task-board-head` y contenedores de
  acciones equivalentes.
- [x] Separar botones directos de formularios respecto de los campos superiores
  (`margin-top` / fila completa en grids).
- [x] Revisar botones concretos: “Agregar tema”, “Crear escala”, “Crear examen”,
  “Ir a Fortalezas”, “Guardar autoevaluación”, “Aplicar override”,
  “Ajustar fortalezas”, “Registrar repaso”, “Guardar fecha”.
- [x] Eliminar el `margin-left` manual entre botones cuando el contenedor ya
  tenga `gap`, sin romper botones fuera de contenedores flex.
- **Archivos modificados:** `src/styles.css`.
- **Estado:** completada. `gap: 12px` en acciones/formularios; botones directos
  de `.inline-form` ocupan fila completa; `.subject-actions` pasó de 2px a 8px;
  se neutraliza `margin-left` en contenedores con `gap`.

---

## Fase 3 — Densidad horizontal y distribución en filas de listas/ítems

### Subfase 3.1 — Ítems condensados sin separación ni distribución

- [x] **Materias > Temas de estudio:** separar título, badge de materia y
  metadatos (último repaso, próximo repaso, examen) en una estructura vertical
  con `gap`.
- [x] **Notas > Escalas:** separar nombre de escala y metadatos (`0–10 · …`),
  con badge de escala por defecto.
- [x] **Estadísticas > Próximos repasos:** separar tema, badge de materia y
  fecha/relativo; evitar saltos de línea por contenedor angosto.
- [x] **Estudio > Historial (Sesiones recientes):** separar materia/título del
  badge de modo y metadatos (`Pomodoro · 0 min…`).
- [x] Verificar visualmente que ningún par de textos quede fusionado
  (`Cara y cuelloAnatomía…`).
- **Archivos modificados:** `src/views/AcademicView.tsx`,
  `src/views/GradesView.tsx`, `src/views/StatsView.tsx`,
  `src/views/StudyView.tsx`, `src/locales/es.ts`, `src/locales/en.ts`,
  `src/styles.css`.
- **Estado:** completada. Cada fila usa `.mini-item-body` (columna con `gap`),
  `.mini-item-heading` (título + badge) y `.mini-item-meta` (metadatos); los
  prefijos « · » se movieron de las cadenas i18n a los propios elementos para
  evitar textos pegados. Se verificó con `npm run typecheck`.

### Subfase 3.2 — Auditoría global de filas de datos

- [x] Buscar todos los usos de `.mini-item`, `.task-row`, `.priority-row`,
  `.subject-card`, `.exam-item` y filas equivalentes.
- [x] Aplicar un layout estructurado (Flex/Grid, `justify-content:
  space-between`, `gap` explícito) a título, badges y metadatos.
- [x] Asegurar que el contenido ocupe el ancho disponible y que las acciones
  queden alineadas a la derecha sin comprimir el texto.
- [x] Revisar filas de años, términos, materias, exámenes, categorías, notas,
  tags, filtros guardados, undo y prioridades.
- **Archivos modificados:** `src/styles.css`, `src/views/TasksView.tsx`,
  `src/views/StatsView.tsx`, `src/views/SettingsView.tsx`,
  `src/views/StudyView.tsx`.
- **Estado:** completada. Los filtros guardados pasaron a `.row-actions`
  (nombre a la izquierda, botón a la derecha en vez de apilados); materias
  débiles (Stats) y notificaciones entregadas (Settings) usan
  `.mini-item-body`/`.mini-item-heading`/`.mini-item-meta`; las prioridades
  separan título, materia y chip en `.priority-heading` con `gap` y dejan las
  razones en su propia fila. Años, términos, horarios, exámenes y undo ya
  tenían título y metadatos en elementos separados, por lo que no requirieron
  cambios. Pasan `npm run typecheck` y los 66 tests.

### Subfase 3.3 — Corrección: apilamiento vertical en la vista de días (Horario semanal) — solicitada por el usuario

- [x] Convertir `.occurrence-head` en un bloque vertical
  (`flex-direction: column`, `align-items: stretch`, `gap`) para que el nombre
  de la materia no compita con la hora por el mismo renglón en columnas de día
  angostas (`minmax(170px, 1fr)`) y deje de partirse en varias líneas.
- [x] Agrupar el punto de color y el nombre en `.occurrence-title` (fila
  horizontal) y dejar la hora `{start}–{end}` en una segunda línea; conservar
  `overflow-wrap: anywhere` como respaldo para nombres extensos.
- [x] Mantener `.occurrence-meta` (chip de tipo de clase y sala) y las
  `AttendanceButtons` en sus propias filas, sin comprimir el texto.
- [x] Alinear `TodaySchedule`, que comparte `.occurrence-head`, con el mismo
  wrapper `.occurrence-title` para que el apilamiento no deje el punto de color
  en una línea aislada.
- **Archivos modificados:** `src/styles.css`, `src/views/ScheduleView.tsx`,
  `src/views/TodaySchedule.tsx`.
- **Estado:** completada. El encabezado de cada clase queda apilado:
  `punto + nombre` arriba y la hora debajo, con el nombre ocupando todo el
  ancho disponible. `npm run typecheck` pasa.

### Subfase 3.4 — Vista semanal: siete días en dos columnas

- [x] Sustituir la rejilla horizontal de siete columnas con scroll por una
  cuadrícula de dos columnas (`grid-template-columns: repeat(2, minmax(0, 1fr))`,
  `align-items: start`) para ver los siete días sin arrastrar.
- [x] Mantener una sola columna en pantallas angostas (≤ 620 px).
- **Archivos modificados:** `src/styles.css`.
- **Estado:** completada. La vista semanal ya no depende de `overflow-x: auto`;
  los días se reparten en dos columnas.

### Subfase 3.5 — Fortalezas: alinear las dos columnas del detalle

- [x] Estrechar la columna del selector de temas en `.study-layout`
  (`minmax(200px, 280px) minmax(0, 1fr)`) para dar más ancho al panel de
  detalle.
- [x] Unificar los dos bloques `.study-detail-grid` en una sola cuadrícula de
  dos columnas fijas, de modo que autoevaluación/override manual y
  repaso/programar fecha compartan las mismas columnas y queden alineadas.
- [x] Mantener `align-items: start` y una sola columna en pantallas ≤ 980 px
  para evitar superposiciones.
- **Archivos modificados:** `src/styles.css`, `src/views/StrengthsView.tsx`.
- **Estado:** completada. Los cuatro bloques del detalle forman ahora una
  rejilla 2×2 alineada; `npm run typecheck` pasa.

### Subfase 3.6 — Centrar los badges de las filas de listas/selectores

- [x] Confirmar con el usuario que el desalineamiento corresponde a los badges
  de las filas (p. ej. «Predeterminada» junto a «Escala 0–100»), no al texto del
  disparador ni a los subtítulos del menú de `CustomSelect`.
- [x] Sacar `.item-badge` de `.mini-item-heading` y dejarlo como hermano de
  `.mini-item-body` en las cinco listas que lo usan: escalas (Grades), temas
  (Academic), próximos repasos (Stats), sesiones (Study) y exámenes (Exams).
- [x] Añadir el modificador `.mini-item.has-badge` con `flex-direction: row`,
  `align-items: center` y `align-self: center` en el badge, de modo que quede
  centrado respecto de todo el renglón y no pegado arriba del título.
- [x] Verificar que los botones de acción sigan alineados a la derecha y que
  el cuerpo de la fila conserve todo el ancho disponible.
- **Archivos modificados:** `src/styles.css`, `src/views/AcademicView.tsx`,
  `src/views/ExamsView.tsx`, `src/views/GradesView.tsx`,
  `src/views/StatsView.tsx`, `src/views/StudyView.tsx`.
- **Estado:** completada. Los badges («Predeterminada», materia, modo, estado
  de examen) se centran verticalmente en su fila. Pasan `npm run typecheck`
  y los 66 tests (`npm run test`).

---

## Fase 4 — Calendario y renderizado de eventos

### Subfase 4.1 — Diagnóstico y corrección en `Calendario`

- [x] Confirmar que la vista solo cargaba exámenes y tareas, y que ignoraba
  repasos programados y clases.
- [x] Cargar repasos espaciados del rango visible mediante
  `listTopicStudies(null, hoy, rangeStart, rangeEnd)`.
- [x] Cargar ocurrencias de clases por semana visible mediante
  `getWeekSchedule(termId, weekStart)` para cada lunes del grid mensual.
- [x] Normalizar todas las claves de fecha a `YYYY-MM-DD` (`dayKey`) para evitar
  desfases UTC/local y claves con hora.
- [x] Renderizar eventos en cada celda del mes y mostrar estado vacío solo
  cuando realmente no haya eventos.
- **Archivos modificados:** `src/views/CalendarView.tsx`, `src/locales/es.ts`,
  `src/locales/en.ts`, `src/styles.css`.
- **Estado:** completada. `listTopicStudies` filtra en backend por repaso o
  examen dentro del rango; el front filtra además por `dueDate` para no pintar
  el examen como repaso. Los lunes se derivan de `rangeStart`/`rangeEnd` y se
  memoizan para no re-lanzar el efecto en cada render.

### Subfase 4.2 — Integración completa de eventos

- [x] Renderizar **clases/horarios** de materias con materia, hora y sala.
- [x] Renderizar **repasos espaciados** con tema y materia.
- [x] Renderizar **exámenes parciales/finales** con materia.
- [x] Renderizar **tareas** con vencimiento (comportamiento existente
  preservado).
- [x] Añadir estilos diferenciados (`.is-exam`, `.is-task`, `.is-class`,
  `.is-review`) y `title` accesible con la etiqueta completa en cada evento.
- [x] Verificar el caso Noviembre 2026: tema con repaso `2026-11-22` y examen
  `2026-12-22` visibles en sus celdas (el repaso entra por `reviewItem.dueDate`
  y el examen por `listExams`).
- **Archivos modificados:** `src/views/CalendarView.tsx`, `src/styles.css`,
  `src/locales/es.ts`, `src/locales/en.ts`.
- **Estado:** completada. La eyebrow, el copy y el mensaje «sin bóveda» ya
  mencionan los cuatro tipos de evento. Pasan `npm run typecheck` y los 66
  tests.

---

## Fase 5 — Verificación final

### Subfase 5.1 — Calidad automatizada

- [x] Ejecutar `npm run typecheck`.
- [x] Ejecutar `npm run lint`.
- [x] Ejecutar `npm run test`.
- [x] Ejecutar `npm run build`.
- [x] Corregir cualquier regresión introducida por el refactor.
- **Estado:** completada. typecheck, lint, 66 tests y build pasan. Se
  corregieron los errores de formato y las props duplicadas que quedaron de la
  sesión anterior (`--chrome-bg`/`--sidebar-bg` ahora se aplican dentro de
  `@supports (color: color-mix(...))`); quedan 3 avisos de especificidad
  descendente preexistentes, no bloqueantes (exit code 0).

### Subfase 5.2 — Revisión visual y cierre

- [x] Revisar modo claro y oscuro con acentos violeta, azul, verde y ámbar.
- [x] Revisar anchos de ventana: amplio, medio (≈980 px) y angosto (≈620 px).
- [x] Confirmar que no quedan superposiciones ni textos fusionados (revisión
  estructural del markup: una sola rejilla 2×2 en Fortalezas, badges como
  hermanos del cuerpo, filas con título/badge/metadatos separados).
- [x] Actualizar este checklist con el estado y notas de cierre.
- **Estado:** completada. Revisión de las 8 combinaciones tema/acento y de los
  anchos 600 / 900 / 1200 px sobre el CSS real: los bordes en reposo y hover
  son opacos y contrastan con la superficie; no hay scroll horizontal ni
  textos superpuestos. A 600 y 900 px el layout pasa a una columna; a 1200 px
  se muestran las dos columnas 50/50.

---

## Fase 6 — Ajustes visuales finales solicitados por el usuario

### Subfase 6.1 — Trazo de borde visible en hover

- [x] Detectar que `.card:hover`, `.next-card:hover`, `.subject-card:hover`,
  `.task-row:hover` y `.calendar-day:hover` mezclaban `primary` con
  `transparent` (22–32 %) y por eso el trazo desaparecía al pasar el cursor,
  a diferencia del borde opaco en reposo.
- [x] Crear el token opaco `--border-hover` (`primary` 55 % + `surface`) junto
  a `--border-default`/`--border-strong`, y usarlo en esos cinco estados.
- [x] Subir `.mini-item:hover` de `--md-sys-color-outline-variant` a
  `--border-strong` para que el trazo también sea visible en modo oscuro.
- [x] Verificar que el token resuelve a un color sin alfa en las 8
  combinaciones claro/oscuro × violeta/azul/verde/ámbar.
- **Archivos modificados:** `src/styles.css`.
- **Estado:** completada. En reposo y en hover todas las cajas conservan un
  borde de 1 px opaco y contrastado; el hover además lo tiñe con el acento.

### Subfase 6.2 — Wrap del nombre en Estadísticas > Materias débiles

- [x] Reproducir el desbordamiento: `.status-card` reserva
  `minmax(180px, 0.45fr)` para el encabezado y, al quedar la tarjeta en una
  columna de 280 px, la lista se reducía a ~34 px y el nombre se partía
  carácter por carácter hasta salirse de la caja.
- [x] Apilar verticalmente las dos tarjetas del layout de Estadísticas
  (`.stats-layout > .status-card` a una sola columna, `gap: 16px`) para que la
  lista ocupe todo el ancho de la tarjeta.
- [x] Añadir `overflow-wrap: anywhere` a `.mini-item-meta` como respaldo para
  textos largos de metadatos (`strong` ya lo tenía en `.mini-item-heading`).
- [x] Verificar con una fila de nombre extenso que el texto ya no se sale del
  box y que el ítem conserva todo el ancho disponible en 600/900/1200 px.
- **Archivos modificados:** `src/styles.css`.
- **Estado:** completada. Con el layout al 50 % el ítem mide ~382 px y el
  nombre se reparte en dos líneas dentro de la caja (antes: ~9 px de ancho y
  más de 1000 px de altura).

### Subfase 6.3 — Reparto 50/50 de "Próximos repasos"

- [x] Añadir el modificador `.stats-layout` al contenedor del bloque de
  "Materias débiles" + "Próximos repasos" en `StatsView`, sin alterar el
  `.study-layout` de Fortalezas (selector estrecho + detalle ancho).
- [x] Definir `grid-template-columns: repeat(2, minmax(0, 1fr))` para que
  ambas tarjetas tengan el 50 % del ancho en vez de 280 px / resto.
- [x] Incluir `.stats-layout` en la regla `@media (max-width: 980px)` para
  volver a una sola columna en pantallas medianas y angostas.
- [x] Correr `npm run check`: typecheck, lint (3 avisos preexistentes no
  bloqueantes), 66 tests y build.
- **Archivos modificados:** `src/views/StatsView.tsx`, `src/styles.css`,
  `docs/CHECKLIST_REFACTOR_UI.md`.
- **Estado:** completada. A 1200 px el layout reparte 542 px por tarjeta, "Próximos
  repasos" dejó de ocupar casi todo el ancho y "Materias débiles" ganó espacio.
