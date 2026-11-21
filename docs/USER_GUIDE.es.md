# Study Planner — Guía del usuario

[English](USER_GUIDE.en.md) · **Español**

Study Planner es un organizador académico local: años académicos, términos,
materias, horarios semanales, asistencia, exámenes, notas, tareas, sesiones
Pomodoro, repaso espaciado y estadísticas. Todo vive en una bóveda SQLite en tu
dispositivo. No hay cuentas, nube ni telemetría.

- [1. Instalación y primer arranque](#1-instalación-y-primer-arranque)
- [2. La bóveda](#2-la-bóveda)
- [3. Navegación](#3-navegación)
- [4. Hoy](#4-hoy)
- [5. Calendario](#5-calendario)
- [6. Tareas](#6-tareas)
- [7. Materias](#7-materias)
- [8. Horario y asistencia](#8-horario-y-asistencia)
- [9. Exámenes y temas](#9-exámenes-y-temas)
- [10. Notas](#10-notas)
- [11. Estudio y Pomodoro](#11-estudio-y-pomodoro)
- [12. Fortalezas y repaso espaciado](#12-fortalezas-y-repaso-espaciado)
- [13. Estadísticas](#13-estadísticas)
- [14. Copias, restauración, exportación e importación](#14-copias-restauración-exportación-e-importación)
- [15. Ajustes](#15-ajustes)
- [16. Datos, privacidad y uso sin conexión](#16-datos-privacidad-y-uso-sin-conexión)
- [17. Solución de problemas](#17-solución-de-problemas)

## 1. Instalación y primer arranque

Study Planner se distribuye para Linux, Windows y macOS.

| Plataforma | Paquete |
| :--- | :--- |
| Linux | AppImage, `.deb`, `.rpm` o el snap estricto `study-planner` |
| Windows | Instalador NSIS, MSI o MSIX (Microsoft Store) |
| macOS | `.dmg` |

Instalación típica:

- **AppImage** — hacelo ejecutable (`chmod +x Study-Planner*.AppImage`) y ejecutalo.
- **Debian/Ubuntu** — `sudo apt install ./study-planner_*.deb`.
- **Fedora/openSUSE** — `sudo dnf install ./study-planner-*.rpm`.
- **Snap** — `sudo snap install study-planner`.
- **Windows/macOS** — ejecutá el instalador y abrí la app.

En el primer arranque la app te pide elegir una carpeta de bóveda. No se guarda
nada hasta que lo hagas. Si solo querés ver la interfaz, la versión web
(`npm run dev`) funciona, pero el selector de carpetas y todas las funciones de
datos requieren la app de escritorio (`npm run tauri dev` o un paquete
instalado).

Los requisitos para compilar desde el código están en el
[README en inglés](../README.md#requirements) y en el
[README en español](../README.es.md#requisitos).

## 2. La bóveda

La bóveda es la carpeta donde Study Planner guarda tus datos. Elegí una carpeta
fuera del repositorio; la app valida la ruta y la bloquea contra una segunda
instancia.

```text
<bóveda>/omega/                        base viva, copia principal y adjuntos
<bóveda>/longlife/<dispositivo>/<fecha>/   instantáneas diarias (7 por dispositivo)
```

- **omega** contiene la base SQLite con todos los registros y la copia principal
  verificada. Es la única fuente de verdad.
- **longlife** contiene instantáneas diarias. Las incompletas se descartan.
- La ruta completa nunca se muestra en la interfaz; solo se usa el nombre de la
  carpeta.
- Para mover tus datos, elegí otra carpeta e importá una exportación, o copiá la
  carpeta completa con la app cerrada.

La sección **Bóveda** también muestra diagnósticos: versión del esquema,
integridad de SQLite, violaciones de claves foráneas, identificador del
dispositivo e identificador de la bóveda.

> **Sin cifrado.** La base no está cifrada. La confidencialidad depende del
> cifrado de disco del sistema operativo y de quién pueda acceder al equipo.

## 3. Navegación

La barra lateral agrupa las secciones en padres que se pueden contraer:

| Grupo | Secciones |
| :--- | :--- |
| Diario | Hoy, Calendario, Tareas |
| Academia | Materias, Horario, Exámenes, Notas |
| Estudio | Estudio, Fortalezas, Estadísticas |
| Sistema | Bóveda, Ajustes |

- Por defecto solo se abre el grupo de la sección activa; hacé clic en el título
  de un grupo para expandirlo o contraerlo.
- La elección se recuerda en este dispositivo.
- Al elegir una sección, su grupo se abre automáticamente.
- En ventanas angostas la barra se convierte en un riel de iconos. En ventanas
  muy angostas pasa a ser una barra horizontal con desplazamiento.

Cada sección empieza con una descripción breve. Si la bóveda no está
configurada, las secciones de datos muestran un panel **Bóveda requerida** con
un acceso directo a la sección Bóveda.

## 4. Hoy

La vista Hoy es la pantalla de inicio:

- **Tareas pendientes** — tareas abiertas con una casilla para completarlas
  directamente y un acceso a la sección Tareas.
- **Próximos pasos** — accesos a las secciones que más usás.
- **Principios** — un recordatorio breve de cómo se guardan y protegen los datos.

## 5. Calendario

El Calendario es una vista mensual local de exámenes y tareas por fecha.

- Usá **← Anterior**, **Siguiente →** y **Hoy** para moverte entre meses.
- Cada día lista exámenes (`Examen · título (materia)`) y tareas
  (`Tarea · título`).
- El calendario no se sincroniza con calendarios externos ni hace peticiones de
  red.
- Si todavía no hay materias, la vista ofrece un acceso para crearlas.

## 6. Tareas

La sección Tareas guarda tareas, trabajos prácticos, proyectos y elementos
personales.

### Crear una tarea

1. Escribí un título en **Nueva tarea** y presioná **Agregar** para una tarea
   rápida.
2. Abrí **Más opciones** para completar el formulario completo:
   - título, materia, tarea padre (crea una subtarea), tipo y prioridad;
   - estado (`Pendiente`, `En progreso`, `Hecha`);
   - fecha de inicio, vencimiento, hora y minutos estimados;
   - descripción y etiquetas;
   - recurrencia: `Diaria`, `Semanal` o `Mensual`, un intervalo (`Cada N`) y una
     fecha de fin opcional (`Hasta`).
3. Guardá con **Crear tarea** o **Guardar cambios**.

Las tareas recurrentes generan su próxima ocurrencia al completar la actual. La
recurrencia mensual usa el último día del mes cuando el día no existe.

### Organizar

- **Etiquetas** — creá y borrá etiquetas; asignalas en el formulario de tarea.
- **Buscar y filtrar** — filtrá por texto (título, descripción o etiquetas),
  estado (incluido el grupo `Abiertas`), prioridad y etiqueta. **Limpiar**
  restablece todo.
- **Filtros guardados** — ponele un nombre al filtro actual y usá
  **Guardar filtro** para reutilizarlo.

### Completar, editar y borrar

- Usá la casilla para completar o reabrir una tarea.
- Usá **Editar** para cambiar cualquier campo.
- Al borrar una tarea aparece un panel de **Deshacer** durante 5 minutos.
  Restaurar recupera la tarea y sus vínculos activos.

## 7. Materias

La sección Materias construye la estructura académica que usan las demás
secciones.

### Años académicos y términos

1. Creá un **año académico** con nombre, fecha de inicio y fecha de fin.
2. Creá uno o más **términos** dentro del año. Un término tiene nombre, tipo
   (`Semestre`, `Trimestre`, `Cuatrimestre`, `Bimestre`, `Anual`, `Otro`) y un
   rango de fechas.
3. Creá **materias** dentro del término seleccionado: nombre, código, docente,
   aula, créditos, porcentaje mínimo de asistencia y color.

El color identifica la materia en la grilla semanal y en las vistas de progreso.
No se puede borrar un año, término o materia mientras tenga datos dependientes.

### Plan de estudios (ciclos de la carrera)

Debajo de la lista de términos, el panel **Plan de estudios** sigue tu carrera
con independencia de los términos:

1. Creá un **ciclo** con nombre y número de orden.
2. Agregá **materias del plan** a un ciclo: nombre, código opcional, orden y una
   casilla de **aprobada**.
3. Marcá una materia como aprobada. Las filas aprobadas siguen visibles con
   tachado y color atenuado; desmarcá para revertir.
4. Cada ciclo muestra `aprobadas / total` y el panel muestra el progreso general.

Editar una materia aprobada conserva su aprobación. El orden es explícito
mediante el campo **Orden**; no se usa arrastrar y soltar.

## 8. Horario y asistencia

### Grilla semanal

Elegí un término para ver su semana. La grilla muestra una columna por día y
bloques tonales por clase, con el color de la materia. Usá la navegación de
semanas para moverte; **Hoy** vuelve a la semana actual. La próxima clase se
destaca y las clases de hoy aparecen con los controles de asistencia.

### Franjas horarias

Agregá una franja con:

- materia, día de la semana, hora de inicio y hora de fin;
- recurrencia: `Semanal` o `Quincenal`;
- rotación (opcional);
- fechas desde y hasta (opcionales);
- aula (opcional).

La app rechaza una franja cuya hora de fin no sea posterior a la de inicio.

### Rotaciones

Las rotaciones alternan las clases de la semana. Configurá:

- **Modo** — `Semanal A/B`, `Paridad de semana` o `Ciclo de días`;
- **Ancla** — la fecha que inicia el conteo;
- **Ciclo** — la secuencia, por ejemplo `1, 2, 3, 4`;
- **Etiquetas** — los nombres que se muestran en cada paso, por ejemplo `A, B`.

`Semanal A/B` avanza por semana ISO, `Paridad de semana` usa semanas pares e
impares, y `Ciclo de días` avanza un paso por día hábil (los fines de semana no
consumen paso).

### Feriados y excepciones

- **Feriados** — agregá una fecha y un nombre. Las clases de esa fecha se
  cancelan.
- **Excepciones** — por franja y fecha:
  - `Cancelada` elimina la clase;
  - `Movida` reemplaza su hora de inicio, hora de fin y/o aula;
  - `Extra` agrega una clase que no tiene franja base.

### Asistencia

Para cada clase podés marcar **Presente**, **Ausente**, **Tarde** o
**Justificado**. Presente, tarde y justificado cuentan como asistencia; ausente
no. Si una materia tiene un porcentaje mínimo de asistencia, la sección avisa
cuando cae por debajo del umbral.

## 9. Exámenes y temas

Elegí una materia para administrar sus exámenes y temas.

### Exámenes

Creá un examen con título, fecha, hora de inicio y fin, aula, peso (%), nota,
nota máxima, resultado y notas. Los resultados pueden ser `Pendiente`,
`Aprobado`, `Desaprobado` o `Ausente`. La lista muestra el peso y, cuando está
registrada, la nota.

### Temas

Los temas son jerárquicos y pertenecen a la materia:

- creá un tema con nombre, tema padre opcional y descripción;
- los subtemas aparecen indentados bajo su padre;
- los temas alimentan las secciones Fortalezas, la prioridad de Estudio y
  Estadísticas.

## 10. Notas

Las notas se calculan con aritmética entera (centipuntos y basis points), así que
los resultados son deterministas.

### Escalas

Una escala define el rango y la nota de aprobación:

- nombre, mínimo, máximo, nota de aprobación y decimales;
- **predeterminada** marca la escala que se usa cuando no se elige otra;
- **Crear escala 0–100** agrega una escala lista para usar y la marca como
  predeterminada.

### Categorías

Cada materia tiene categorías ponderadas:

- nombre, escala, peso (%) y **Descartar** (cuántas notas más bajas se omiten).

### Entradas

Registrá una nota con título, categoría, nota, máximo, peso opcional y fecha. Una
nota no puede ser negativa ni superar su máximo.

### Cómo se calcula el promedio final

1. Cada entrada se convierte en porcentaje: `nota / máximo`.
2. Dentro de una categoría se descartan las notas más bajas por porcentaje
   ascendente, luego por fecha ascendente (las sin fecha al final) y por último
   por identificador. Siempre se conserva al menos una entrada.
3. El promedio de la categoría se pondera por el peso de la categoría.
4. El resultado final se proyecta a la escala elegida entre su mínimo y su
   máximo, y se compara con la nota de aprobación.

La vista Notas muestra el promedio final, una barra de progreso, si la materia
está aprobada y el desglose por categoría con las notas descartadas.

## 11. Estudio y Pomodoro

La sección Estudio combina un temporizador, una cola de prioridad explicable y un
historial de sesiones.

### Pomodoro

1. Elegí un modo: `Pomodoro`, `Libre` o `Repaso`.
2. Configurá los minutos planificados (1–240; 25 por defecto).
3. Elegí opcionalmente una materia y un tema.
4. Presioná **Iniciar** y luego **Pausar** / **Reanudar** según necesites.
5. **Finalizar sesión** guarda los minutos transcurridos; **Descartar** los
   descarta.

Cuando termina el tiempo planificado, la app avisa y te permite cerrar la sesión
o seguir en modo libre. El temporizador usa el reloj local del dispositivo.

### Cola de prioridad

La cola indica qué estudiar primero. El puntaje es determinista y cada fila
muestra sus motivos:

- tema débil `+4000`, neutral `+2000`, fortaleza `+500`;
- repaso vencido: `+3000` más hasta `200` por día de atraso (limitado por la
  ventana de decaimiento, 7 días por defecto);
- repaso dentro de la ventana: más puntos cuanto más cerca esté;
- examen dentro de la ventana: más puntos cuanto más cerca esté.

Los empates se resuelven por identificador de tema. La cola necesita temas
creados en Exámenes.

### Historial

Las sesiones recientes muestran modo, minutos reales, interrupciones y fecha.
Podés borrar una sesión; los totales y las rachas se actualizan.

## 12. Fortalezas y repaso espaciado

La sección Fortalezas autoevalúa temas y programa repasos.

### Autoevaluación

Elegí una materia y luego un tema. Registrá un puntaje de 1 a 5 y una nota
opcional. La clasificación automática proyecta el puntaje a un porcentaje:

- **Débil** en 40 % o menos;
- **Fortaleza** en 70 % o más;
- **Neutral** entre ambos;
- **Neutral** cuando el tema no tiene autoevaluación.

Los umbrales se guardan como ajustes portables.

### Clasificación manual

Podés reemplazar la clasificación automática con `Débil`, `Neutral` o
`Fortaleza` y un motivo opcional. La clasificación manual gana sobre la
automática hasta que la quites.

### Repaso espaciado (SM-2)

Cada tema guarda su factor de facilidad, intervalo, repeticiones, lapsos y
próxima fecha de repaso. Registrar un repaso con calidad 1–5 aplica SM-2:

- la facilidad empieza en 2.50 y nunca baja de 1.30;
- una calidad menor que 3 reinicia las repeticiones, cuenta un lapso y fija un
  intervalo de 1 día;
- una calidad de 3 o más usa intervalos de 1 día, luego 6 días y después
  `redondeo(intervalo × facilidad)`;
- la próxima fecha de repaso es la fecha del repaso más el intervalo.

También podés fijar una fecha de repaso manualmente con **Programar repaso**. Los
repasos alimentan la cola de prioridad, las Estadísticas y los recordatorios
locales.

## 13. Estadísticas

Elegí un período: **Últimos 7 días**, **Últimos 30 días** o **Todo el historial**.

- **Tiempo** — minutos totales y cantidad de sesiones.
- **Constancia** — racha actual y mejor racha histórica.
- **Repasos** — repasos que vencen hoy o antes.
- **Tiempo por materia** — barras horizontales con minutos y cantidad de
  sesiones.
- **Materias débiles** — materias con temas débiles, con acceso directo a
  Fortalezas.
- **Próximos repasos** — primero los vencidos y luego los de los próximos 30
  días.

Las estadísticas se calculan con las sesiones y autoevaluaciones guardadas; nada
se envía a ningún lado.

## 14. Copias, restauración, exportación e importación

### Copia principal

- **Crear copia ahora** hace una copia en línea de SQLite y la verifica con
  SHA-256, `integrity_check` y `foreign_key_check`.
- La sección Bóveda muestra tamaño, integridad, fecha de modificación, cantidad
  de instantáneas y el SHA-256 de la copia.
- Se crea una copia antes de cada migración y antes de cada restauración.

### Restaurar

**Restaurar copia principal** reemplaza los datos vivos con la copia verificada.
Antes crea una copia `pre-restore-*` del estado actual. La restauración se
confirma explícitamente.

### Instantáneas

Las instantáneas diarias viven en `longlife/<dispositivo>/<fecha>/`. Se conservan
las últimas 7 por dispositivo; las incompletas se descartan.

### Exportar

**Exportar bóveda** escribe un único archivo canónico `.txt` con todas las
tablas, los adjuntos y una suma de verificación. El formato está documentado en
[`EXPORT_FORMAT.md`](EXPORT_FORMAT.md).

> La exportación **no está cifrada**: contiene todos tus datos en texto plano,
> incluidos los adjuntos. Guardala en un lugar seguro.

### Importar

**Importar en bóveda vacía** solo se habilita cuando la bóveda no tiene datos de
dominio. La importación es transaccional: si algo falla, no queda ningún dato
parcial. Importar en una bóveda con datos está bloqueado por diseño.

La garantía de ida y vuelta es: exportar → importar en una bóveda vacía →
exportar produce bytes idénticos dentro de la misma versión.

## 15. Ajustes

### Apariencia

- **Modo** — `Sistema` sigue la preferencia del escritorio; `Claro` y `Oscuro`
  fuerzan el tema.
- **Color de acento** — violeta, azul, verde azulado, verde, ámbar, naranja,
  rosa o rojo.
- Ambas elecciones se guardan en este dispositivo.

### Idioma

- La interfaz está disponible en **inglés** (predeterminado) y **español**.
- La elección se guarda en este dispositivo y en la bóveda, así que puede viajar
  con tus datos.
- Las fechas y los números siguen el idioma elegido.

### Modo segundo plano

**Mantener en segundo plano** deja la app en la bandeja del sistema al cerrar la
ventana, para que los recordatorios sigan funcionando. Usá **Salir** en el icono
de la bandeja para cerrarla del todo. Si el escritorio no tiene bandeja, cerrar
la ventana termina el proceso y Ajustes lo informa.

### Notificaciones

Los recordatorios locales cubren clases, tareas, exámenes y repasos:

- **Activar recordatorios** enciende el planificador.
- Anticipaciones: clases 10 minutos antes, tareas 60 minutos antes, exámenes 24
  horas antes; los repasos se disparan cuando su fecha ya venció.
- **Sonido de recordatorio** solicita el sonido estándar de notificaciones del
  escritorio.
- **Revisar recordatorios** ejecuta el planificador de inmediato.
- **Enviar notificación de prueba** verifica la entrega.
- La lista de entregados muestra los avisos recientes.

Los recordatorios se calculan en la bóveda y los entrega el host de Rust por
D-Bus. La webview no pide permisos del sistema ni hace peticiones de red. El
planificador corre cada 60 segundos mientras el proceso vive; no corre con la
app cerrada.

### Actualizaciones

El actualizador está aislado en Rust, es optativo y usa un host fijo con
verificación de firma obligatoria.

- **Buscar actualizaciones al iniciar** está desactivado por defecto y requiere
  una bóveda configurada.
- **Buscar actualizaciones** lee el manifiesto fijo; nunca envía datos de la
  bóveda.
- **Instalar** descarga y verifica el paquete, y luego lo instala. En Linux el
  gestor de paquetes puede pedir tu contraseña de administrador; en Windows la
  app se cierra para terminar; en macOS se reabre sola.
- **Restaurar versión anterior** revierte cuando hay una versión previa
  disponible.

El actualizador está desactivado en compilaciones de desarrollo, cuando no hay
clave pública de producción configurada y en instalaciones Snap y MSIX (sus
tiendas gestionan las actualizaciones).

## 16. Datos, privacidad y uso sin conexión

- Sin cuentas, sin nube, sin telemetría.
- La webview no tiene permisos de archivos, SQL, shell, diálogos ni HTTP.
- El único módulo de red es el actualizador aislado, con URL fija y verificación
  de firma.
- La bóveda es una base SQLite común; la exportación es texto plano.
- Borrar un registro es lógico (una marca de borrado), así que las copias y
  exportaciones siguen siendo consistentes.
- No se escribe nada fuera de la carpeta de la bóveda y de la configuración
  local de la app.

Ver [`OFFLINE.md`](OFFLINE.md) y [`ARCHITECTURE.md`](ARCHITECTURE.md) para los
detalles técnicos.

## 17. Solución de problemas

| Síntoma | Causa y solución |
| :--- | :--- |
| El selector de carpetas está deshabilitado | Estás en la versión web. Usá la app de escritorio. |
| «Bóveda requerida» en una sección | Elegí una carpeta en Bóveda primero. |
| La importación está bloqueada | La bóveda ya tiene datos. Solo se importa en una bóveda vacía. |
| No se puede borrar una materia, término o año | Todavía tiene registros dependientes. Borrá primero los dependientes. |
| La asistencia avisa por debajo del mínimo | La materia tiene un porcentaje mínimo y las clases registradas están por debajo. |
| No llegan recordatorios | Activá los recordatorios, mantené la app abierta o en segundo plano y revisá el servicio de notificaciones del escritorio (D-Bus en Linux). |
| La ventana se cierra en vez de quedar en la bandeja | El escritorio no tiene soporte de bandeja; en Linux instalá `libayatana-appindicator3`. |
| El actualizador está deshabilitado | Compilación de desarrollo, falta la clave pública, instalación Snap o MSIX. |
| El idioma cambió en otro dispositivo | El idioma se guarda por dispositivo y en la bóveda; gana la última elección. |
| Una copia o exportación parece vieja | Las copias se crean a demanda, antes de migraciones y restauraciones; las instantáneas son diarias. |

Si la base reporta un problema de integridad, dejá de usar la bóveda, copiá la
carpeta completa a un lugar seguro y restaurá la copia verificada o importá una
exportación reciente.

---

Documentación relacionada: [`README`](../README.es.md) ·
[`ARCHITECTURE`](ARCHITECTURE.md) · [`DATA_MODEL`](DATA_MODEL.md) ·
[`EXPORT_FORMAT`](EXPORT_FORMAT.md) · [`NOTIFICATIONS`](NOTIFICATIONS.md) ·
[`UPDATER`](UPDATER.md)
