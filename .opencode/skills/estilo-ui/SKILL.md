---
name: Estilo UI
description: Revisar que los controles, paneles y vistas nuevos o modificados de Study Planner conserven la estética Material de la app (temas, acentos, tipografía, padding y foco); usar al añadir controles o al revisar diffs de UI en React/CSS.
---

# Estilo UI — revisión de controles (React + CSS)

Propósito: evitar que aparezcan controles con el estilo del sistema operativo o desalineados
con el resto de la app. **Revisa y reporta**; no cambies código de aplicación salvo que te lo
pidan explícitamente.

## Checklist obligatorio

1. **Selectores desplegables**
   - Todo selector nuevo debe usar `CustomSelect` de `src/components/CustomSelect.tsx`
     (el usado por `AcademicView`, `CalendarView`, `ExamsView`, `GradesView`, etc.).
     Nunca dejar un `<select>` nativo visible: su menú depende del SO.
   - `CustomSelect` ya gestiona teclado, cierre al pulsar fuera, `dot`, `subtitle`,
     `placement` y foco; comprobar que `value`/`onChange` siguen controlados por React.
   - `src/views/custom-select.ts` es una implementación auxiliar/no enlazada: no crear
     componentes nuevos apoyándote en ella.
   - Las opciones y etiquetas van traducidas (skill `Traducciones UI`).

2. **Temas y acentos**
   - La app tiene 3 modos (`system`, `light`, `dark`) y 8 acentos (`violet`, `blue`,
     `teal`, `green`, `amber`, `orange`, `pink`, `red`), gobernados por
     `data-theme` / `data-accent` en `<html>` desde `src/lib/theme.ts`.
   - `applyTheme()` genera los tokens Material con `@material/material-color-utilities`
     a partir del color de origen del acento; no hardcodear los colores resultantes en
     los componentes.
   - Usar solo variables CSS: `--accent`, `--accent-strong`, `--on-accent`,
     `--accent-soft`, `--accent-ink`, `--md-sys-color-*`, `--md-elevation-*`,
     `--md-card-bg`. Prohibidos hexadecimales fijos en componentes nuevos (salvo la
     paleta de `ACCENTS` en `theme.ts` y las definiciones base de `styles.css`).
   - Verificar con los tres modos y con al menos dos acentos distintos (p. ej.
     `violet` y `amber`). El modo `system` sigue la preferencia del SO.

3. **Tipografía, padding y foco**
   - `font: inherit` / tipografía del sistema; tamaños en `rem`/`em`, sin `px` fijos
     para texto cuando el resto usa escala.
   - `box-sizing: border-box` con `width`/`height` fijos; padding coherente con
     `.card`, `.field` y los controles de Ajustes.
   - `:focus-visible` con `outline`/`box-shadow` en `var(--accent)`; `:hover` con
     `--md-sys-color-surface-container-*` o `--accent-soft`.
   - Objetivos táctiles amplios en las barras inferior/móvil y en los botones de
     calendario/asistencia.

4. **Vistas y tablas**
   - Reutilizar primitivas: `src/components/Tabs.tsx`, `DateField.tsx`,
     `AttendanceButtons.tsx`, `ResizeHandles.tsx`, `WindowControls.tsx`.
   - Las tablas de horario/exámenes/notas deben conservar el mismo espaciado y la
     jerarquía visual de las vistas existentes; los colores de estado (aprobado,
     pendiente, falta) salen de tokens semánticos (`--md-sys-color-success/error`).

5. **Verificación final**
   - `npm run typecheck` y `npm test` (o `npm run check`).
   - Si el cambio afecta a símbolos documentados, actualizar `docs/Estructure.md` (skill `Estructure`).

## Referencias rápidas

| Qué | Dónde |
| :--- | :--- |
| Proveedor de tema, modos, acentos, `applyTheme()` | `src/lib/theme.ts` |
| Tokens Material y reglas de componentes | `src/styles.css` |
| Selector en uso | `src/components/CustomSelect.tsx` |
| Referencia no enlazada | `src/views/custom-select.ts` |
| Mapa de estilos | `docs/Estructure.md` (sección de interfaz) |
