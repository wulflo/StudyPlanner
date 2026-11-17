//! Persistencia SQLite de Study Planner.
//!
//! La base se abre con WAL, claves foráneas activas y sincronización completa.
//! Las migraciones son hacia adelante y se registran con checksum. El respaldo
//! previo a una migración corresponde a la capa de bóveda (Fase 1).

use std::path::Path;
use std::time::Duration;

use rusqlite::{Connection, params};
use sha2::{Digest, Sha256};
use study_planner_core::{SCHEMA_VERSION, new_id};
use thiserror::Error;

mod academic;
mod backup;
mod exams;
mod grades;
mod notifications;
mod schedule;
mod settings;
mod study;
mod tasks;
mod undo;

#[cfg(test)]
mod tests_support;

pub use academic::{SubjectInput, TermInput};
pub use backup::BackupReport;
pub use exams::{ExamInput, TopicInput};
pub use grades::{GradeCategoryInput, GradeEntryInput, GradeScaleInput};
pub use notifications::{NotificationRecord, Reminder, STALE_NOTIFICATION_CLAIM_MINUTES};
pub use schedule::{ClassSlotInput, RotationInput, WeekHoliday, WeekSchedule};
pub use settings::{
    NetworkEvent, PORTABLE_SETTING_KEYS, SETTING_KEY_MAX_CHARS, SETTING_VALUE_MAX_BYTES,
    is_portable_setting_key, validate_setting_key, validate_setting_value,
};
pub use study::{
    StudyPriorityView, StudyStats, SubjectMinutesView, TopicStudy, UpcomingReviewView,
    WeakSubjectView,
};
pub use tasks::TaskInput;
pub use undo::{UNDO_TTL_MINUTES, UndoEntry};

const INITIAL_SQL: &str = include_str!("../migrations/0001_initial.sql");
const PARTIAL_UNIQUE_INDEXES_SQL: &str =
    include_str!("../migrations/0002_partial_unique_indexes.sql");

/// Migraciones en orden. El checksum de cada una queda registrado en la base.
const MIGRATIONS: &[(i64, &str, &str)] = &[
    (1, "0001_initial", INITIAL_SQL),
    (2, "0002_partial_unique_indexes", PARTIAL_UNIQUE_INDEXES_SQL),
];

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("error de SQLite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error(
        "el esquema {found} es más nuevo que el soportado ({supported}); actualizá Study Planner"
    )]
    SchemaTooNew { found: i64, supported: i64 },
    #[error("metadato requerido ausente: {0}")]
    MissingMeta(&'static str),
    #[error("falta el registro de la migración {0}; la base fue modificada fuera de Study Planner")]
    MissingMigration(i64),
    #[error(
        "el checksum de la migración {version} no coincide; la base fue modificada fuera de Study Planner"
    )]
    MigrationChecksum { version: i64 },
    #[error("tarea inválida: {0}")]
    InvalidTask(&'static str),
    #[error("examen o tema inválido: {0}")]
    InvalidExam(&'static str),
    #[error("nota inválida: {0}")]
    InvalidGrade(&'static str),
    #[error("dato académico inválido: {0}")]
    InvalidAcademic(&'static str),
    #[error("horario inválido: {0}")]
    InvalidSchedule(&'static str),
    #[error("tarea no encontrada")]
    TaskNotFound,
    #[error("examen no encontrado")]
    ExamNotFound,
    #[error("tema no encontrado")]
    TopicNotFound,
    #[error("vínculo examen–tema no encontrado")]
    ExamTopicNotFound,
    #[error("escala de nota no encontrada")]
    GradeScaleNotFound,
    #[error("categoría de nota no encontrada")]
    GradeCategoryNotFound,
    #[error("entrada de nota no encontrada")]
    GradeEntryNotFound,
    #[error("etiqueta no encontrada")]
    TagNotFound,
    #[error("filtro guardado no encontrado")]
    SavedFilterNotFound,
    #[error("dato de estudio inválido: {0}")]
    InvalidStudy(&'static str),
    #[error("autoevaluación no encontrada")]
    SelfAssessmentNotFound,
    #[error("override de fortaleza no encontrado")]
    StrengthOverrideNotFound,
    #[error("ítem de repaso no encontrado")]
    ReviewItemNotFound,
    #[error("sesión de estudio no encontrada")]
    StudySessionNotFound,
    #[error("ajuste inválido: {0}")]
    InvalidSetting(String),
    #[error("evento de red no encontrado")]
    NetworkEventNotFound,
    #[error("acción de undo no encontrada")]
    UndoNotFound,
    #[error("la acción de undo expiró")]
    UndoExpired,
    #[error("año académico no encontrado")]
    AcademicYearNotFound,
    #[error("término no encontrado")]
    TermNotFound,
    #[error("materia no encontrada")]
    SubjectNotFound,
    #[error("franja horaria no encontrada")]
    ClassSlotNotFound,
    #[error("rotación no encontrada")]
    RotationNotFound,
    #[error("feriado no encontrado")]
    HolidayNotFound,
    #[error("excepción de clase no encontrada")]
    ExceptionNotFound,
    #[error("registro de asistencia no encontrado")]
    AttendanceNotFound,
    #[error("{0}")]
    Conflict(&'static str),
    #[error("error de archivo: {0}")]
    Io(#[from] std::io::Error),
    #[error("error de JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("backup inválido: {0}")]
    InvalidBackup(String),
}

/// Conexión a la base de Study Planner.
pub struct Store {
    conn: Connection,
}

impl Store {
    /// Abre una base en memoria. Útil para pruebas y para el autodiagnóstico.
    pub fn open_in_memory() -> Result<Self, StoreError> {
        let conn = Connection::open_in_memory()?;
        Self::configure(&conn)?;
        Ok(Self { conn })
    }

    /// Abre una base en disco y configura WAL y claves foráneas.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StoreError> {
        let conn = Connection::open(path)?;
        Self::configure(&conn)?;
        Ok(Self { conn })
    }

    fn configure(conn: &Connection) -> Result<(), StoreError> {
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "synchronous", "FULL")?;
        conn.busy_timeout(Duration::from_secs(5))?;
        // En memoria SQLite responde "memory"; en disco pasa a "wal".
        let _: String = conn.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
        Ok(())
    }

    /// Aplica las migraciones pendientes y verifica el checksum de las ya
    /// aplicadas. Una base alterada fuera de la app se rechaza.
    pub fn migrate(&mut self) -> Result<(), StoreError> {
        let current: i64 = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;
        let supported = i64::from(SCHEMA_VERSION);

        if current > supported {
            return Err(StoreError::SchemaTooNew {
                found: current,
                supported,
            });
        }

        self.verify_applied_migrations(current)?;

        for (version, name, sql) in MIGRATIONS.iter().copied() {
            if version <= current {
                continue;
            }

            let tx = self.conn.transaction()?;
            tx.execute_batch(sql)?;
            tx.pragma_update(None, "user_version", version)?;

            tx.execute(
                "INSERT INTO schema_migration(version, name, checksum) VALUES (?1, ?2, ?3)",
                params![version, name, sha256_hex(sql.as_bytes())],
            )?;

            tx.execute(
                "INSERT INTO app_meta(key, value) VALUES ('schema_version', ?1)
                 ON CONFLICT(key) DO UPDATE SET
                   value = excluded.value,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
                params![version.to_string()],
            )?;

            tx.execute(
                "INSERT OR IGNORE INTO app_meta(key, value) VALUES ('vault_id', ?1)",
                params![new_id()],
            )?;

            tx.execute(
                "INSERT OR IGNORE INTO app_meta(key, value, updated_at)
                 VALUES ('created_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                         strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                [],
            )?;

            tx.commit()?;
        }
        Ok(())
    }

    /// Comprueba que cada migración aplicada tenga su fila y su checksum.
    fn verify_applied_migrations(&self, current: i64) -> Result<(), StoreError> {
        let has_table: i64 = self.conn.query_row(
            "SELECT count(*) FROM sqlite_master
             WHERE type = 'table' AND name = 'schema_migration'",
            [],
            |row| row.get(0),
        )?;
        if has_table == 0 {
            return Ok(());
        }

        for (version, _, sql) in MIGRATIONS
            .iter()
            .copied()
            .filter(|(version, _, _)| *version <= current)
        {
            let checksum: Option<String> = self
                .conn
                .query_row(
                    "SELECT checksum FROM schema_migration WHERE version = ?1",
                    params![version],
                    |row| row.get(0),
                )
                .optional()?;
            let Some(checksum) = checksum else {
                return Err(StoreError::MissingMigration(version));
            };
            if checksum != sha256_hex(sql.as_bytes()) {
                return Err(StoreError::MigrationChecksum { version });
            }
        }
        Ok(())
    }

    /// Versión de esquema efectiva según SQLite.
    pub fn schema_version(&self) -> Result<i64, StoreError> {
        let version = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;
        Ok(version)
    }

    /// Identificador estable de la bóveda. Se genera en la primera migración.
    pub fn vault_id(&self) -> Result<String, StoreError> {
        let value = self
            .conn
            .query_row(
                "SELECT value FROM app_meta WHERE key = 'vault_id'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        value.ok_or(StoreError::MissingMeta("vault_id"))
    }

    /// Resultado de `PRAGMA integrity_check`.
    pub fn integrity_check(&self) -> Result<String, StoreError> {
        let result = self
            .conn
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
        Ok(result)
    }

    /// Fecha civil local en formato `AAAA-MM-DD`. Se usa para las snapshots.
    pub fn local_date(&self) -> Result<String, StoreError> {
        let value = self.conn.query_row(
            "SELECT strftime('%Y-%m-%d', 'now', 'localtime')",
            [],
            |row| row.get(0),
        )?;
        Ok(value)
    }

    /// Instante UTC en RFC3339 con milisegundos, coherente con el esquema.
    pub fn utc_now(&self) -> Result<String, StoreError> {
        let value =
            self.conn
                .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| {
                    row.get(0)
                })?;
        Ok(value)
    }

    /// Cantidad de violaciones de claves foráneas.
    pub fn foreign_key_violations(&self) -> Result<usize, StoreError> {
        let mut stmt = self.conn.prepare("PRAGMA foreign_key_check")?;
        let rows = stmt.query_map([], |_| Ok(()))?;
        let mut count = 0usize;
        for row in rows {
            row?;
            count += 1;
        }
        Ok(count)
    }

    /// Acceso de bajo nivel para la capa de repositorios (Fase 1).
    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    /// Ejecuta `body` dentro de una transacción diferida y confirma al final.
    ///
    /// Si `body` devuelve un error, el `Transaction` se suelta sin confirmar y
    /// SQLite revierte todos los cambios. Se usa `unchecked_transaction` para no
    /// exigir `&mut self` en toda la capa de persistencia.
    pub(crate) fn with_transaction<T>(
        &self,
        body: impl FnOnce() -> Result<T, StoreError>,
    ) -> Result<T, StoreError> {
        let transaction = self.conn.unchecked_transaction()?;
        let value = body()?;
        transaction.commit()?;
        Ok(value)
    }

    /// Devuelve un conflicto si la consulta cuenta al menos una fila viva.
    ///
    /// `sql` debe ser una constante interna con un único parámetro `?1`.
    pub(crate) fn ensure_no_live_rows(
        &self,
        sql: &str,
        id: &str,
        message: &'static str,
    ) -> Result<(), StoreError> {
        let count: i64 = self.conn.query_row(sql, params![id], |row| row.get(0))?;
        if count > 0 {
            return Err(StoreError::Conflict(message));
        }
        Ok(())
    }

    /// Comprueba que una materia exista y no esté borrada.
    pub(crate) fn ensure_live_subject(&self, subject_id: &str) -> Result<(), StoreError> {
        let exists: i64 = self.conn.query_row(
            "SELECT count(*) FROM subject WHERE id = ?1 AND deleted_at IS NULL",
            params![subject_id],
            |row| row.get(0),
        )?;
        if exists == 0 {
            return Err(StoreError::SubjectNotFound);
        }
        Ok(())
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex::encode(digest)
}

// Necesario para `optional()` en `vault_id`.
use rusqlite::OptionalExtension;

#[cfg(test)]
mod tests {
    use super::*;

    fn migrated_store() -> Store {
        let mut store = Store::open_in_memory().expect("abrir memoria");
        store.migrate().expect("migrar");
        store
    }

    #[test]
    fn migrates_fresh_database() {
        let store = migrated_store();
        assert_eq!(store.schema_version().unwrap(), i64::from(SCHEMA_VERSION));
        assert_eq!(store.integrity_check().unwrap(), "ok");
        assert_eq!(store.foreign_key_violations().unwrap(), 0);
        assert!(uuid::Uuid::parse_str(&store.vault_id().unwrap()).is_ok());
    }

    #[test]
    fn migration_is_idempotent() {
        let mut store = migrated_store();
        store.migrate().expect("segunda migración");
        assert_eq!(store.schema_version().unwrap(), i64::from(SCHEMA_VERSION));
    }

    #[test]
    fn creates_expected_tables_and_seeds_settings() {
        let store = migrated_store();
        for table in [
            "academic_year",
            "term",
            "subject",
            "class_slot",
            "exam",
            "task",
            "topic",
            "self_assessment",
            "grade_entry",
            "study_session",
            "note",
            "attachment",
            "notification",
            "setting",
        ] {
            let exists: i64 = store
                .connection()
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(exists, 1, "falta la tabla {table}");
        }

        let accent: String = store
            .connection()
            .query_row(
                "SELECT value_json FROM setting WHERE key = 'theme.accent'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(accent, "\"#6750A4\"");

        let scope: String = store
            .connection()
            .query_row(
                "SELECT scope FROM setting WHERE key = 'paths.vault'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(scope, "machine");
    }

    #[test]
    fn fts5_is_available() {
        let store = migrated_store();
        store
            .connection()
            .execute(
                "INSERT INTO task_fts(task_id, title, description, tags)
                 VALUES ('t1', 'Álgebra lineal', 'Repasar matrices', 'mate')",
                [],
            )
            .unwrap();
        let count: i64 = store
            .connection()
            .query_row(
                "SELECT count(*) FROM task_fts WHERE task_fts MATCH 'algebra'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn applies_migrations_after_a_v1_database() {
        let mut store = Store::open_in_memory().expect("abrir memoria");
        store
            .connection()
            .execute_batch(INITIAL_SQL)
            .expect("esquema v1");
        store
            .connection()
            .pragma_update(None, "user_version", 1)
            .unwrap();
        store
            .connection()
            .execute(
                "INSERT INTO schema_migration(version, name, checksum)
                 VALUES (1, '0001_initial', ?1)",
                params![sha256_hex(INITIAL_SQL.as_bytes())],
            )
            .unwrap();
        store
            .connection()
            .execute("INSERT INTO task(id, title) VALUES ('t1', 'Previa')", [])
            .unwrap();

        store.migrate().expect("migrar a v2");

        assert_eq!(store.schema_version().unwrap(), 2);
        let title: String = store
            .connection()
            .query_row("SELECT title FROM task WHERE id = 't1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(title, "Previa");
    }

    #[test]
    fn rejects_a_tampered_migration_checksum() {
        let mut store = migrated_store();
        store
            .connection()
            .execute(
                "UPDATE schema_migration SET checksum = 'alterado' WHERE version = 1",
                [],
            )
            .unwrap();

        let error = store.migrate().expect_err("checksum alterado");
        assert!(matches!(
            error,
            StoreError::MigrationChecksum { version: 1 }
        ));
    }

    #[test]
    fn partial_unique_indexes_ignore_soft_deleted_rows() {
        use crate::tests_support::migrated_store_with_subject;

        let (store, subject_id, _) = migrated_store_with_subject();
        let topic = store
            .create_topic(
                &subject_id,
                &crate::TopicInput {
                    name: "Matrices".to_string(),
                    ..crate::TopicInput::default()
                },
            )
            .unwrap();

        store
            .connection()
            .execute(
                "INSERT INTO strength_override(id, topic_id, classification, deleted_at)
                 VALUES ('s1', ?1, 'weak', '2026-01-01T00:00:00.000Z')",
                params![topic.id],
            )
            .unwrap();
        store
            .connection()
            .execute(
                "INSERT INTO strength_override(id, topic_id, classification)
                 VALUES ('s2', ?1, 'strength')",
                params![topic.id],
            )
            .expect("la fila borrada no debe bloquear el reemplazo");

        store
            .connection()
            .execute(
                "INSERT INTO review_item(id, topic_id, deleted_at)
                 VALUES ('r1', ?1, '2026-01-01T00:00:00.000Z')",
                params![topic.id],
            )
            .unwrap();
        store
            .connection()
            .execute(
                "INSERT INTO review_item(id, topic_id) VALUES ('r2', ?1)",
                params![topic.id],
            )
            .expect("la fila borrada no debe bloquear el repaso nuevo");

        store
            .connection()
            .execute(
                "INSERT INTO notification(id, kind, scheduled_at, dedupe_key, deleted_at)
                 VALUES ('n1', 'task', '2026-01-01T09:00:00Z', 'k', '2026-01-01T00:00:00.000Z')",
                [],
            )
            .unwrap();
        store
            .connection()
            .execute(
                "INSERT INTO notification(id, kind, scheduled_at, dedupe_key)
                 VALUES ('n2', 'task', '2026-01-01T09:00:00Z', 'k')",
                [],
            )
            .expect("la notificación borrada no debe bloquear la nueva");

        let duplicate = store.connection().execute(
            "INSERT INTO notification(id, kind, scheduled_at, dedupe_key)
             VALUES ('n3', 'task', '2026-01-01T09:00:00Z', 'k')",
            [],
        );
        assert!(
            duplicate.is_err(),
            "dos filas vivas no pueden repetir la clave"
        );
    }

    #[test]
    fn rejects_newer_schema() {
        let mut store = Store::open_in_memory().unwrap();
        store
            .connection()
            .pragma_update(None, "user_version", 99)
            .unwrap();
        let err = store.migrate().unwrap_err();
        assert!(matches!(
            err,
            StoreError::SchemaTooNew {
                found: 99,
                supported
            } if supported == i64::from(SCHEMA_VERSION)
        ));
    }
}
