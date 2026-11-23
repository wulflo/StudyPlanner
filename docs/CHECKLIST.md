# Study Planner — Estado Maestro y Bitácora Consolidada

> **Última actualización:** 2026-11-22  
> **Estado general:** Fases 0 a 5 completadas; planes de integridad, rediseño UI y refinamiento UX cerrados. En modo mantenimiento.  
> **Versión actual:** `0.2.5` · `schema_version = 4` · `export_format_version = 1`  
> **Repositorio:** [`wulflo/StudyPlanner`](https://github.com/wulflo/StudyPlanner)

Este documento consolida la fuente de verdad del proyecto tras el cierre de todas las fases de desarrollo inicial y los planes de endurecimiento, remodelación visual y refinamiento de experiencia de usuario. Si en algún momento existe discrepancia entre este registro y el código fuente, prevalece el código y este archivo debe actualizarse en el mismo commit.

---

## 1. Snapshot Técnico y de Calidad

| Dimensión | Estado / Valor |
| :--- | :--- |
| **Stack Frontend** | React 19 + TypeScript + Vite 8 + Zustand + i18next (`en` por defecto, `es` soportado) + Material Color Utilities |
| **Stack Backend** | Rust + Tauri 2.12 + `rusqlite` 0.41 (SQLite en modo WAL, backup online, claves foráneas activas) |
| **Base de Datos** | Esquema **v4** (`0001_initial.sql`, `0002_partial_unique_indexes.sql`, `0003_default_locale_english.sql`, `0004_study_cycles.sql`) |
| **Transferencia** | Formato canónico `.txt` **v1** determinista con adjuntos embebidos (Base64 + SHA-256) y round-trip byte a byte |
| **Seguridad y Red** | Webview estrictamente offline (CSP cerrada, sin `fetch`/`http`, sin permisos `fs`/`dialog`/`shell`). Red aislada exclusivamente en `study-planner-updater` (Rust) |
| **Updater y Firma** | Clave pública minisign embebida; verificación obligatoria de firma + SHA-256 + versión; rollback atómico. Detección nativa de runtimes gestionados por tienda (`Snap` y `MSIX`) |
| **Notificaciones** | Motor local determinista en Rust; entrega por D-Bus (`org.freedesktop.Notifications`) en Linux; modo segundo plano en bandeja del sistema |
| **Empaquetado y CI** | GitHub Actions fijado por SHA (`ci.yml`, `release.yml`, `snap.yml`, `store-msix.yml`). Artefactos para Linux (`AppImage`, `.deb`, `.rpm`, `.snap`), Windows (`NSIS`, `.msi`, `.msix`) y macOS (`.dmg`) |

### Suite de Verificación Vigente

```text
npm run check                                                ✅  66 tests de UI (Vitest + Biome + TypeScript + Build)
cargo test -p study-planner-core -p study-planner-store \
           -p study-planner-transfer -p study-planner-updater ✅  146 tests (43 core, 68 store, 21 transfer, 14 updater)
cargo test -p study-planner                                  ✅  21 tests de bóveda, instancia única y host
cargo clippy --workspace --all-targets -- -D warnings        ✅  0 advertencias
./scripts/audit-network.sh                                   ✅  Sin red ni permisos excesivos en webview
./scripts/audit-licenses.sh                                  ✅  Inventario de licencias verificado
```

---

## 2. Reglas Inquebrantables de Arquitectura

1. **Aislamiento de Red:** La webview tiene prohibido realizar peticiones HTTP, cargar fuentes remotas o usar CDNs. Toda comunicación externa ocurre únicamente en el crate `study-planner-updater` bajo HTTPS fijo y opt-in explícito.
2. **Privilegios Mínimos (ADR-022):** `src-tauri/capabilities/default.json` excluye `core:default` y habilita únicamente los eventos y controles de ventana indispensables (`minimize`, `toggle-maximize`, `close`, `start-dragging`, `start-resize-dragging`, `is-maximized`). El frontend jamás recibe rutas del sistema de archivos ni handles.
3. **Almacenamiento Local Sin Cifrado de Bóveda:** Por decisión explícita de diseño, la bóveda (`<raíz>/omega` y `<raíz>/longlife/<dispositivo>/<AAAA-MM-DD>`) no utiliza contraseñas ni cifrado en reposo, garantizando acceso directo y recuperación transparente.
4. **Inmutabilidad de Migraciones:** `0001_initial.sql` y las migraciones publicadas no se editan. Toda alteración estructural requiere una migración secuencial nueva. Los checksums discrepantes entre dispositivos se auto-reparan tras verificar la integridad estructural de SQLite (ADR-024).
5. **Precisión Matemática y Borrado Lógico:** Calificaciones y pesos se almacenan como enteros de punto fijo (centipuntos / *basis points*). Las entidades de dominio utilizan `deleted_at` (borrado lógico) respaldado por índices `UNIQUE` parciales (`WHERE deleted_at IS NULL`, ADR-023).
6. **Cero Secretos Versionados:** Claves privadas, passphrases y archivos de datos reales permanecen estrictamente fuera de Git.

---

## 3. Comandos de Operación y Desarrollo

```bash
# Verificación integral antes de cualquier commit
./scripts/check.sh

# Verificaciones individuales
npm run check                  # Typecheck + Biome lint + Vitest + Vite build
cargo fmt --all -- --check     # Formato Rust
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace         # Suite completa de Rust

# Auditorías y empaquetado
./scripts/audit-network.sh
./scripts/audit-licenses.sh
npm run tauri build
```

> **Modo Offline:** Si no hay conexión a internet, utilizar `npm ci --offline` y `cargo build --offline`. Nunca ejecutar `npm update`, `cargo update` ni agregar dependencias sin red.

---

## 4. Hitos Completados (Historial Consolidado)

### A. Fases Fundacionales (Fases 0 – 5)
* **Base y Bóveda (F0–F1):** Arquitectura multi-crate (`core`, `store`, `transfer`, `updater`, `host`), ventana sin bordes con barra de título propia, lock de instancia única, backups verificados mediante la API online de SQLite, snapshots diarios con retención de 7 copias, restauración atómica con respaldo `pre-restore-*` y exportación/importación canónica `.txt` v1.
* **Gestión Académica y Horarios (F2):** CRUD de años académicos, términos, materias y franjas horarias; rotaciones semanales (A/B, paridad, ciclos de días), feriados, excepciones de clase, detección de solapamientos y control de asistencia con umbrales mínimos.
* **Evaluación, Tareas y Calendario (F3):** Exámenes con vinculación jerárquica de temas, escalas de calificación, promedios ponderados con descarte de nota menor, tareas con subtareas, etiquetas, recurrencia, búsqueda FTS local, journal de *undo* con expiración y vista de calendario mensual.
* **Estudio Inteligente y Estadísticas (F4):** Autoevaluaciones (1–5), detección de fortalezas/debilidades con *override* manual, algoritmo de repaso espaciado **SM-2** versionado, temporizador Pomodoro, cola de estudio con prioridad explicable y analíticas de constancia.
* **Updater, Notificaciones y Distribución (F5):** Custodia de claves minisign (gestor de contraseñas + papel + respaldo cifrado remoto), updater con verificación criptográfica, notificaciones D-Bus en Linux y pipelines de empaquetado multiplataforma (incluido soporte para `Snap` estricto y `MSIX` para Microsoft Store).

### B. Plan de Integridad y Seguridad (P0 – P3 · 37/37 ítems)
* **Atomicidad Transaccional (P0):** Operaciones compuestas de tareas, etiquetas, índices FTS, repasos SM-2, *overrides* y escalas de calificación encapsuladas en `with_transaction` para impedir estados parciales.
* **Integridad Referencial en Borrados (P1):** Validación estricta de dependientes vivos (`StoreError::Conflict`) antes de aplicar borrado lógico en años, términos, materias, exámenes y franjas horarias; cascada transaccional controlada para datos derivados de temas.
* **Sanitización y Límites (P2):** Normalización y validación de colores hexadecimales en backend (`transfer`) y frontend (`safeColor`), validación estricta de filtros guardados (`parseTaskFilter`), whitelist de configuraciones portables y topes de seguridad en minutos estimados, recurrencias y sesiones de estudio.
* **Endurecimiento del Host y Esquema (P3):** Eliminación de `core:default`, permisos `0700`/`0600` en archivos de configuración y sockets Unix, rollback automático si falla la reapertura tras restaurar un backup, recuperación de notificaciones atascadas, revalidación de contexto en *undo*, migración v2 con índices parciales y acciones de GitHub fijadas por SHA.

### C. Remodelación Visual Material 3 y Plan de Estudios (`v0.2.2`)
* **Identidad Visual y Localización:** Inglés establecido como idioma por defecto (migración `0003` + persistencia en bóveda), eliminación de etiquetas internas de fase de desarrollo y generación completa de tokens Material 3 claros/oscuros con superficies sólidas (sin `backdrop-filter`).
* **Componentes y Navegación:** Reemplazo de todos los `<select>` nativos por `CustomSelect` accesible con posicionamiento inteligente; reducción del radio de botones (`8–10px`) frente a insignias tipo píldora; barra lateral colapsable con grupos persistentes y modo riel de íconos en ventanas estrechas.
* **Plan de Estudios por Ciclos:** Migración `0004` (`study_cycle` y `study_plan_subject`) para gestionar el avance curricular de la carrera con marcado de materias aprobadas y barras de progreso por ciclo y global.
* **Documentación Bilingüe:** Guías completas de usuario y READMEs en inglés y español (`USER_GUIDE.en.md`, `USER_GUIDE.es.md`).

### D. Refinamientos de Flujo y Experiencia de Usuario (`v0.2.3`)
* **Sincronización Examen → Notas (ADR-025):** Al registrar o actualizar la calificación de un examen, se crea o actualiza automáticamente su entrada vinculada en *Notas* (generando escala y categoría «Exámenes» por defecto si no existen). La vista de exámenes incorpora paginación (`5/10/20/50` + «Cargar más») y carga diferida de temas para evitar consultas N+1.
* **Temas de Estudio con Repaso Fechado:** Nueva subsección integrada en *Materias* con filtros por materia y rango temporal (semana/mes/todo), carga por lotes sin carreras de red y registro rápido de repasos SM-2 con fecha.
* **Navegación por Pestañas y Limpieza de Interfaz (ADR-026):** Implementación del componente accesible `<Tabs>` para segmentar vistas extensas (*Materias*, *Horario*, *Notas*, *Exámenes*), compactación de controles de navegación temporal, disposición horizontal de botones de acción y eliminación de tarjetas/chips residuales («Sin conexión» y tarjetas conceptuales en *Hoy*).

### E. Refinamiento Visual Integral y Layout de Estudio (`v0.2.4`)
* **Sistema de bordes y superficies:** tokens opacos (`--border-subtle`, `--border-default`, `--border-strong`, `--border-focus`, `--border-hover`) y chrome derivado del acento (`--chrome-bg`, `--sidebar-bg`) con degradación gradual para motores sin `color-mix` ni colores relativos.
* **Filas y rejillas:** estructura reutilizable de filas (`.mini-item-body`, `.mini-item-heading`, `.mini-item-meta`, `.item-badge`) en siete vistas, rejilla 2×2 alineada en Fortalezas, reparto 50/50 en Estadísticas y dos columnas para la vista semanal y las clases del Horario.
* **Corrección de Estudio:** la tarjeta de Pomodoro se apila en la columna angosta de `.study-layout`, de modo que sus campos de 150 px mínimos ya no se superponen con «Prioridad explicable». Calendario incorpora clases y repasos con estilos propios.

---

## 5. Acciones Futuras Opcionales (Mantenimiento)

> Ninguno de estos puntos bloquea el uso actual ni requiere intervención inmediata; quedan registrados como tareas operativas diferidas:

1. `[futuro]` **Dependabot (`glib` 0.18.5):** La alerta de severidad media proviene transitivamente de `gtk 0.18` en Tauri y requiere actualizar a `gtk-rs` / `glib 0.20` cuando Tauri publique su actualización mayor. Ignorada temporalmente en `.github/dependabot.yml`.
2. `[futuro]` **Copia física de llaves minisign:** Copiar `study-planner.key` y `study-planner.pub` al medio de respaldo offline físico (el archivo `.tar.gz.gpg` ya está resguardado y verificado en almacenamiento remoto).
3. `[futuro]` **Validación de tiendas y auto-actualización:**
   * Ejecutar una prueba de actualización *end-to-end* desde una versión previa firmada hacia la última release en GitHub.
   * Probar el paquete `.snap` en una instalación limpia de Ubuntu 24.04 antes de habilitar publicación automática en `edge`/`stable`.
   * Validar el paquete `.msix` en el Partner Center de Microsoft Store en un entorno Windows real.
4. `[futuro]` **Firma de código OS:** Evaluar certificados Authenticode (Windows) y Apple Developer ID + notarización (macOS) si se decide distribuir binarios fuera de las tiendas oficiales.
```

He unificado las cinco checklists en **`PROJECT_MASTER_CHECKLIST.md`**, eliminando duplicidades y bitácoras intermedias ya cerradas, pero conservando todas las reglas de arquitectura, métricas de verificación, decisiones técnicas (ADR) y los pocos ítems operativos marcados como `[futuro]`. ¿Te gustaría ajustar el nivel de detalle de alguna sección o exportar una versión en inglés?