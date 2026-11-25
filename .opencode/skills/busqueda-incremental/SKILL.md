---
name: Búsqueda incremental
description: Diseñar o revisar búsquedas, filtros y listas grandes de Study Planner (tareas, calendario, exámenes, notas y estadísticas) para que no congelen la UI; usar límites, debounce, cancelación de búsquedas obsoletas y cálculos memoizados; usar al añadir un buscador, lista grande o al revisar diffs que renderizan resultados.
---

# Búsqueda incremental y listas grandes — patrón de Study Planner

Propósito: que las listas de tareas, el calendario y las búsquedas no congelen la UI ni
hagan trabajo redundante sobre la bóveda. **Revisa y reporta**; no cambies código de
aplicación salvo que te lo pidan explícitamente.

## Reglas

1. **Filtrar en el backend, con structural limit.** La búsqueda de tareas pasa por
   `searchTasks(filter)` (`src/lib/ipc.ts:376`) → comando Rust de búsqueda en el
   repositorio. No traer todas las tareas al frontend para filtrarlas en React.
   `parseTaskFilter()` (`src/lib/taskFilter.ts:26`) valida los filtros guardados y
   descarta tipos inesperados: mantener esa sanitización en cualquier filtro nuevo.
2. **Debounce y cancelación.** El input de búsqueda (`TasksView.tsx:620`) debe esperar
   ~100–150 ms antes de lanzar la búsqueda. El efecto ya usa un flag `cancelled`
   (`TasksView.tsx:265`) para ignorar respuestas obsoletas: conservarlo al refactorizar.
3. **No montar filas sin límite.** Las vistas de tareas, exámenes, notas y horario pueden
   crecer mucho: usar ventana/`Mostrar más` o agrupación por fecha en vez de un nodo por
   registro cuando la bóveda es grande.
4. **Derivar con `useMemo`.** Los resúmenes de `StatsView`, `AcademicView` y `StrengthsView`
   se calculan a partir del estado de la bóveda; memoizar los agregados y pasar datos
   pequeños a los componentes, no la bóveda completa.
5. **Caché acotada y cargas bajo demanda.** El store (Zustand) es la fuente del estado;
   no duplicar listas en `useState` locales salvo que sean borradores. Las copias y
   exportaciones se piden explícitamente desde Ajustes, no en cada render.
6. **Fechas con la locale correcta.** Agrupar por día/semana con `date-fns` y
   `getDateFnsLocale()` (`src/lib/i18n.ts`); no recalcular formatos en cada fila.

## Checklist de revisión

- [ ] ¿El filtro se valida (`parseTaskFilter`) y se ejecuta en Rust?
- [ ] ¿Hay debounce en el input y cancelación de búsquedas obsoletas?
- [ ] ¿La lista tiene ventana, paginación o agrupación en vez de montar todo?
- [ ] ¿Los agregados están memoizados?
- [ ] ¿No se duplica la bóveda en estados locales innecesarios?
- [ ] ¿`npm run check` pasa?

## Referencias rápidas

| Patrón | Dónde |
| :--- | :--- |
| Búsqueda de tareas | `src/views/TasksView.tsx:265/620`, `src/lib/ipc.ts searchTasks` (376) |
| Validación de filtros | `src/lib/taskFilter.ts:26` (`parseTaskFilter`) |
| Store y estado de la bóveda | `src/lib/ipc.ts`, store Zustand en `src/` |
| Agregados | `src/views/StatsView.tsx`, `src/views/AcademicView.tsx`, `src/views/StrengthsView.tsx` |
| Mapa general | `docs/Estructure.md` (sección de dominio y vistas) |
