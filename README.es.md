<div align="center">

<img src="public/study-planner.png" alt="Study Planner" width="112" />

# Study Planner

**Organización académica personal — estrictamente local.**

Horarios, materias, exámenes, notas, tareas, apuntes y repaso espaciado en una única bóveda SQLite.
Sin cuentas, sin nube y sin telemetría.

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](#licencia)
[![Status: v0.2.5](https://img.shields.io/badge/status-v0.2.5-brightgreen.svg)](CHANGELOG.md)
[![Tauri 2.12](https://img.shields.io/badge/Tauri-2.12-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Platforms: Linux | Windows | macOS](https://img.shields.io/badge/platforms-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey.svg)](#requisitos)

[English](README.md) · [Español](README.es.md) · [Releases](https://github.com/wulflo/StudyPlanner/releases) · [Guía del usuario](docs/USER_GUIDE.es.md) · [Contribuir](CONTRIBUTING.md) · [Seguridad](SECURITY.md)

</div>

---

## Contenido

- [Estado del proyecto](#estado-del-proyecto)
- [Funciones](#funciones)
- [Principios de diseño](#principios-de-diseño)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Verificación](#verificación)
- [Documentación](#documentación)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Seguridad](#seguridad)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Estado del proyecto

> **Las fases 0 a 5 están completas y publicadas.** `v0.2.5` incluye un actualizador firmado multiplataforma, notificaciones locales y empaquetado para Microsoft Store.

| Hito | Lo más destacado |
| :--- | :--- |
| **v0.2.5** | Se desbloquean los borrados (rotaciones guardadas, asistencia huérfana, tareas con subtareas); las materias de todos los años y términos son alcanzables en toda la app; el término vigente se abre por defecto. |
| **v0.2.4** | Refinamiento integral de interfaz: bordes opacos, superficies derivadas del acento, filas de listas estructuradas y layout de Estudio corregido. |
| **Distribución** | AppImage, `.deb`, `.rpm`, Snap, Windows (NSIS/MSI/MSIX) y macOS. |
| **Uso diario** | Temas claro, oscuro y del sistema; colores de acento; modo de segundo plano en la bandeja; recordatorios con sonido opcional. |

## Funciones

**Planificar y organizar**

- **Hoy** — una vista diaria con clases, tareas pendientes, exámenes y repasos.
- **Calendario** — vista mensual que mezcla clases, exámenes, tareas y eventos de repaso espaciado.
- **Tareas** — subtareas, fechas de entrega, prioridades y categorías.
- **Materias** — años académicos, términos y planes de estudio, con todas las materias alcanzables desde cualquier vista.
- **Horario** — rejilla semanal con franjas, rotaciones, feriados, excepciones y asistencia por franja.

**Estudiar y medir**

- **Exámenes y temas** — fechas de examen, seguimiento de temas y resultados que alimentan las notas.
- **Notas** — escalas propias, categorías ponderadas y precisión de punto fijo en el promedio final.
- **Estudio y Pomodoro** — temporizador, cola de prioridad explicable e historial de sesiones.
- **Fortalezas y repaso espaciado** — autoevaluación, ajuste manual y planificación SM-2.
- **Estadísticas** — progreso y rendimiento por materia y término.

**Tus datos, protegidos**

- **Continuidad verificada** — SHA-256, `integrity_check` y `foreign_key_check` en cada copia.
- **Exportación completa** — un único `.txt` canónico puede reconstruir toda la bóveda, byte a byte.
- **Sin conexión por diseño** — la interfaz nunca toca la red y ningún dato sale del dispositivo.

## Principios de diseño

- **Local primero.** Elegís una carpeta raíz (la bóveda) y la app crea `<vault>/omega` para los datos vivos y la copia principal verificada, además de `<vault>/longlife` para las instantáneas diarias. La ruta se valida y nunca cambia sin aviso.
- **Continuidad verificada.** Cada copia se verifica con SHA-256, `integrity_check` y `foreign_key_check`. La app conserva la copia anterior a cada migración, las últimas 7 instantáneas por dispositivo y una copia `pre-restore-*.db` antes de cada restauración.
- **Sin red en la UI.** El webview no tiene permisos de archivo, SQL, shell, diálogo ni HTTP. La única excepción es el actualizador aislado en Rust: opcional, con URL fija y verificación de firma obligatoria.
- **Exportación completa.** Un único `.txt` canónico puede reconstruir la bóveda. `exportar → importar → exportar` produce bytes idénticos en la misma versión, y las importaciones solo se aceptan en una bóveda vacía.
- **Sin cifrado de bóveda.** Es una decisión explícita del usuario. La confidencialidad depende del cifrado de disco completo del sistema operativo y de la custodia física del dispositivo.
- **Continuidad.** Cada fase deja tests, un changelog y `docs/CHECKLIST.md` para poder retomar el trabajo sin internet. La dependencia transitiva MPL-2.0 de Tauri se acepta como excepción acotada (ADR-017); ver `THIRD_PARTY_LICENSES.md`.

## Stack tecnológico

| Capa | Tecnología |
| :--- | :--- |
| UI | React 19, TypeScript, Vite 8, Zustand, date-fns, Material Color Utilities |
| Host | Tauri 2.12 (Rust) |
| Persistencia | SQLite vía `rusqlite` (bundled), WAL, migraciones versionadas |
| Exportación | Rust (`study-planner-transfer`), formato canónico propio |
| Actualizador | crate aislado (`study-planner-updater`), opt-in, firmas minisign |
| Empaquetado | AppImage, deb, rpm, exe/msi/msix, dmg y un snap `strict` |
| Tests | Vitest + Testing Library; `cargo test` |

## Requisitos

- **Linux x86_64** (probado en CachyOS/Arch). Windows x64 y macOS arm64 compilan y se actualizan, pero no tienen notificaciones locales ni firma de código a nivel de sistema.
- **Node.js 22+** y npm.
- **Rust estable 1.90+** con `cargo`.
- **WebKitGTK 4.1**, GTK 3, libsoup 3 y el resto de dependencias de Tauri en Linux.
- En Linux, **`libayatana-appindicator3`** para el icono de la bandeja en segundo plano. Sin él, la app funciona, pero cerrar la ventana termina el proceso.
- **`rg` (ripgrep)** para `scripts/audit-network.sh`; el script usa `grep` cuando ripgrep no está instalado.

## Instalación

### Descarga

Bajá el paquete para tu plataforma desde el [último release](https://github.com/wulflo/StudyPlanner/releases):

| Plataforma | Paquetes |
| :--- | :--- |
| Linux | AppImage, `.deb`, `.rpm`, Snap |
| Windows | NSIS, MSI, MSIX |
| macOS | DMG |

### Compilar desde el código

```bash
git clone https://github.com/wulflo/StudyPlanner.git
cd StudyPlanner
npm install
npm run tauri dev
```

Para ejecutar solo el frontend, sin la capa IPC de Tauri:

```bash
npm run dev
```

## Verificación

| Comando | Qué ejecuta |
| :--- | :--- |
| `npm run check` | Comprobación de tipos, lint, tests de frontend y build de producción |
| `npm run check:all` | Todo lo anterior, más formateo de Rust, Clippy y tests de Rust |
| `./scripts/check.sh` | `check:all` más la comprobación del host de Tauri, la versión del snap y las auditorías |
| `./scripts/audit-network.sh` | Auditoría estática de acceso a la red, permisos y secretos |

## Documentación

| Documento | Contenido |
| :--- | :--- |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | Estado, fases, reglas y próximos pasos |
| [`docs/USER_GUIDE.en.md`](docs/USER_GUIDE.en.md) | Guía del usuario (inglés) |
| [`docs/USER_GUIDE.es.md`](docs/USER_GUIDE.es.md) | Guía del usuario (español) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Capas, límites de seguridad y flujos |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Esquema y convenciones |
| [`docs/EXPORT_FORMAT.md`](docs/EXPORT_FORMAT.md) | Contrato del export `.txt` |
| [`docs/UPDATER.md`](docs/UPDATER.md) | Diseño del actualizador aislado |
| [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) | Recordatorios locales, sonido y segundo plano |
| [`docs/RELEASE.md`](docs/RELEASE.md) | Flujo multiplataforma, firmas y secretos |
| [`docs/SNAP.md`](docs/SNAP.md) | Snap strict, build y publicación |
| [`docs/KEYS.md`](docs/KEYS.md) | Custodia de las claves de firma |
| [`PRIVACY.md`](PRIVACY.md) | Política de privacidad para Microsoft Store |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisiones y alternativas descartadas |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Trabajar sin conexión |
| [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) | Licencias y excepciones |
| [`CHANGELOG.md`](CHANGELOG.md) | Cambios por versión |

## Estructura del proyecto

```text
src/                           UI en React
src-tauri/                     Host de Tauri, comandos, CSP y permisos
crates/study-planner-core/     dominio puro, constantes, IDs
crates/study-planner-store/    SQLite, migraciones, copias
crates/study-planner-transfer/ exportación/importación
crates/study-planner-updater/  acceso a la red aislado (fase 5)
docs/                          documentación persistente
scripts/                       verificación y auditorías
fixtures/export/               fixtures de ida y vuelta
```

La bóveda vive fuera del repositorio:

```text
<vault>/omega/                          datos vivos, copia principal, adjuntos y registro local
<vault>/longlife/<device>/<date>/       instantáneas diarias (7 por dispositivo)
```

## Seguridad

- No se guardan claves, contraseñas ni bases de datos en el repositorio.
- El snap usa confinamiento `strict`, solo `home`/`removable-media` y ningún plug de red; ver `docs/SNAP.md`.
- No se aceptan contribuciones que agreguen acceso a la red, cuentas, telemetría o permisos amplios en el frontend.
- La clave privada del actualizador y su passphrase se guardan fuera del repositorio; ver `docs/KEYS.md`.
- Si encontrás un problema de seguridad, usá el [aviso privado](https://github.com/wulflo/StudyPlanner/security/advisories/new) de GitHub. No abras un issue público. Ver [`SECURITY.md`](SECURITY.md).

## Contribuir

Las contribuciones son bienvenidas. Leé [`CONTRIBUTING.md`](CONTRIBUTING.md) para el setup de desarrollo, las guías de código, los requisitos de tests y el proceso de pull request.

## Licencia

Publicado bajo **MIT OR Apache-2.0**. Las dependencias de plataforma (WebKitGTK/GTK) son LGPL y se enlazan dinámicamente; ver [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
