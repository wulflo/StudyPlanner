---
name: Traducciones UI
description: Asegurar que las opciones de interfaz y configuración de Study Planner tengan traducción al inglés y al español (idiomas soportados); usar al añadir textos nuevos, al revisar Ajustes o al cambiar controles y diffs de UI.
---

# Traducciones UI — ES ↔ EN

Propósito: que **ningún** texto visible de la interfaz o de los ajustes quede solo en un idioma.
Los idiomas soportados son `es` y `en` (el inglés es el predeterminado en el primer arranque),
gestionados con `i18next`/`react-i18next` en `src/lib/i18n.ts`.

## Checklist obligatorio

1. **Claves y diccionarios**
   - Todo texto visible usa `useTranslation()` y `t("clave")`; nunca un literal suelto
     en un componente.
   - Añadir la **misma clave** a `src/locales/es.ts` y `src/locales/en.ts`.
   - Revisar etiquetas de Ajustes, `placeholder`, `title`, `aria-label` y mensajes de
     error/toast: también se traducen.
   - Las claves siguen el patrón del repo (p. ej. `settings.themeSystem`,
     `settings.accentViolet`, `tasks.*`); no inventar claves duplicadas con otro nombre.

2. **Fechas y números**
   - Usar `intlLocale()` y `getDateFnsLocale()` de `src/lib/i18n.ts` para formatear
     fechas (`en-US` / `es-AR`); no fijar locale a mano en el componente.
   - Revisar que los nombres de días/meses y el formato de hora salgan en el idioma activo.

3. **Auditoría de una vista/panel**
   - Buscar literales sin envolver en los `.tsx` de la zona:
     `grep -nE '"[^"]*[áéíóúñÁÉÍÓÚÑ][^"]*"' src/`.
   - Comprobar que cada clave usada con `t()` existe en los dos diccionarios.
   - Probar la app con `localStorage.setItem("study-planner.language","en")` y `"es"` y
     recorrer la pantalla: no debe quedar texto del otro idioma (salvo datos del usuario).

4. **Si se cambia el mecanismo o se añade un idioma**
   - Actualizar `AppLanguage`, `LANGUAGES`, `normalizeLanguage()`, `readLanguage()`,
     `setAppLanguage()`, `intlLocale()`, `getDateFnsLocale()` y la init de i18next en
     `src/lib/i18n.ts`; añadir el recurso en `src/locales/` y actualizar la guía de uso.

## Verificación final

- `npm run typecheck` y `npm test` (o `npm run check`).
- Recorrer con el idioma cambiado la vista afectada y, como mínimo, Ajustes.
- Si el cambio afecta a símbolos documentados, actualizar `docs/Estructure.md` (skill `Estructure`).

## Referencias rápidas

| Qué | Dónde |
| :--- | :--- |
| i18next, idiomas y helpers de fecha | `src/lib/i18n.ts` |
| Diccionarios | `src/locales/es.ts`, `src/locales/en.ts` |
| Preferencia guardada | `localStorage["study-planner.language"]` (`es|en`, defecto `en`) |
| Guías de usuario | `docs/USER_GUIDE.es.md`, `docs/USER_GUIDE.en.md` |
