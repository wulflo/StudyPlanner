---
name: Guía de uso
description: Actualizar la documentación de usuario de Study Planner cuando se añaden funciones o cambian ajustes, vistas, flujos o atajos; usar al terminar una modificación visible para el usuario.
---

# Guía de uso — documentación del usuario

Propósito: que la guía describa **lo que la app hace ahora**, no una versión anterior.
Aplica cuando se añade una función, se cambia un ajuste (idioma, tema, bóveda, copias),
se renombra una etiqueta o se modifica un flujo visible (tareas, calendario, exámenes,
notas, Pomodoro, repaso espaciado, estadísticas).

## Checklist obligatorio

1. **Identificar el cambio visible**
   - ¿Nueva vista/acción? ¿Nuevo ajuste? ¿Cambió una etiqueta, una unidad o el
     comportamiento de un botón? ¿Se eliminó una opción? Anotarlo antes de tocar la guía.

2. **Actualizar ambas guías**
   - `docs/USER_GUIDE.es.md` (español) y `docs/USER_GUIDE.en.md` (inglés) en paralelo.
   - Mantener el mismo orden de secciones y el mismo nivel de detalle en ambos idiomas.
   - Las claves de interfaz viven en `src/locales/es.ts` y `src/locales/en.ts`; si la
     etiqueta visible cambió, revisar también la skill `Traducciones UI`.

3. **Qué documentar**
   - **Hoy y calendario:** qué se ve, cómo se navega entre días/semanas y cómo se edita.
   - **Tareas y materias:** creación, filtros, años académicos, términos y plan de estudios.
   - **Horario y asistencia:** grilla, franjas, rotaciones, feriados y conteo de asistencia.
   - **Exámenes, temas y notas:** alta, escalas, categorías y cálculo del promedio.
   - **Estudio y repaso:** Pomodoro, cola de prioridad, historial y SM-2.
   - **Bóveda, copias y exportación:** dónde se guarda, cómo restaurar y exportar/importar.
   - **Ajustes:** idioma, tema (sistema/claro/oscuro), acento y actualizaciones.

4. **No duplicar el índice técnico**
   - Rutas de código, comandos Tauri, esquemas y claves de almacenamiento van en
     `docs/Estructure.md` / `docs/DATA_MODEL.md`, no en la guía de uso.
   - La guía responde a «¿cómo se usa?»; los índices a «¿dónde está?».

5. **Verificación final**
   - `npm run check` si el cambio también tocó código.
   - Leer el diff de la guía: sin instrucciones obsoletas (p. ej. un atajo que ya no existe).

## Referencias rápidas

| Qué | Dónde |
| :--- | :--- |
| Guía ES | `docs/USER_GUIDE.es.md` |
| Guía EN | `docs/USER_GUIDE.en.md` |
| Visión general | `README.md`, `README.es.md` |
| Índice técnico | `docs/Estructure.md` |
| Modelo de datos | `docs/DATA_MODEL.md` |
| Historial de cambios | `CHANGELOG.md` |
