# Seguridad

Study Planner es una aplicación local que maneja datos académicos y, en el futuro, la clave de firma de sus actualizaciones. Si encontrás una vulnerabilidad, **no abras un issue público**.

## Cómo reportar

Usá el reporte privado de GitHub:

**https://github.com/wulflo/StudyPlanner/security/advisories/new**

También podés contactar al mantenedor por los medios indicados en su perfil de GitHub. Incluí:

- Versión de Study Planner y sistema operativo.
- Pasos mínimos para reproducir.
- Impacto esperado.
- Si aplica, una prueba de concepto sin datos reales.

No incluyas en el reporte:

- Claves privadas, passphrases ni tokens.
- Contenido de una bóveda real.
- Datos personales de terceros.

## Alcance

Se consideran relevantes:

- Ejecución de código o comandos desde la webview.
- Requests de red no autorizados.
- Lectura/escritura de archivos fuera de la bóveda.
- Bypass de la verificación de firma del updater.
- Corrupción o pérdida de datos en migraciones, backups o exportación.
- Filtración de datos en logs, exportaciones o mensajes de error.
- Permisos de Tauri más amplios que los declarados (evento `listen`/`unlisten` + controles de ventana; sin `core:default`).

Quedan fuera de alcance:

- Ataques que requieren acceso físico o root al equipo.
- Ingeniería social.
- Vulnerabilidades en WebKitGTK/GTK no explotables desde Study Planner.
- Falta de cifrado de la bóveda: es una decisión explícita del proyecto (ver `docs/DECISIONS.md`).

## Avisos de dependencias aceptados

Algunos avisos de Dependabot no se pueden corregir desde este repositorio porque
dependen de una actualización mayor de la cadena GTK de Tauri. Se revisan y se
documentan acá:

| Aviso | Paquete | Estado | Motivo |
|---|---|---|---|
| `GHSA-wrw7-89jp-8q8g` (RUSTSEC-2024-0429) | `glib 0.18.5` | Aceptado | Sin parche en la rama 0.18 y sin código alcanzable |

Detalle de `GHSA-wrw7-89jp-8q8g`:

- La falla está en `glib::VariantStrIter` y se corrigió recién en `glib 0.20`.
  `0.18.5` es la última versión de esa rama, así que no hay actualización
  compatible.
- `glib` entra de forma transitiva por `gtk ^0.18`, que fijan `tauri 2.12`,
  `wry 0.57`, `tao 0.37`, `muda`, `tray-icon` y `libappindicator`. Incluso
  `tauri 3.0.0-alpha` sigue usando `gtk ^0.18`, así que tampoco se resuelve
  subiendo de versión.
- Alcance real: el problema sólo se dispara al iterar arreglos de cadenas de un
  `GVariant` con `VariantStrIter`, es decir llamando a
  `glib::Variant::array_iter_str()`. Ningún crate del árbol (`tao`, `wry`,
  `tauri`, `tray-icon`, `muda`, `libappindicator`) llama a esa API, y
  `<Vec<String>>::from_variant` no pasa por ella, así que el camino no es
  alcanzable desde Study Planner.
- Se puede cerrar cuando la cadena GTK de Tauri migre a `gtk-rs 0.20` o
  superior y `Cargo.lock` deje de resolver `glib 0.18`.

## Versiones soportadas

| Versión | Soporte |
|---|---|
| 0.1.x (Fase 0) | Desarrollo; sin release pública todavía |
| Anteriores | No soportadas |

## Respuesta

El mantenedor intentará confirmar el reporte, evaluar el impacto y publicar un parche y un aviso. No hay SLA formal; es un proyecto personal.

## Divulgación

- Coordinada: se acuerda una fecha antes de publicar detalles.
- Se acredita al reportero si lo desea.
- No se divulgan datos de la bóveda ni secretos en el aviso.
