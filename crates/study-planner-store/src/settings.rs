//! Ajustes portables y registro de eventos de red del updater.
//!
//! `network_event` guarda solo metadatos técnicos: tipo, host, bytes y
//! resultado. Nunca incluye datos de la bóveda ni identificadores de usuario.

use rusqlite::{OptionalExtension, Row, params};
use serde::Serialize;
use serde_json::Value;
use study_planner_core::new_id;

use crate::{Store, StoreError};

const NETWORK_COLUMNS: &str = "id, occurred_at, kind, host, bytes_sent, bytes_received, \
     outcome, detail, created_at, updated_at";

/// Claves portables que se pueden exportar e importar.
///
/// La lista es explícita para que una importación no pueda inyectar ajustes
/// arbitrarios que la interfaz o el updater interpreten más tarde.
pub const PORTABLE_SETTING_KEYS: &[&str] = &[
    "theme.mode",
    "theme.accent",
    "theme.variant",
    "theme.contrast",
    "locale",
    "backup.retention.daily",
    "backup.retention.weekly",
    "backup.retention.monthly",
    "backup.interval_hours",
    "notifications.enabled",
    "notifications.sound",
    "notifications.class_lead_minutes",
    "notifications.task_lead_minutes",
    "notifications.exam_lead_hours",
    "study.weak_threshold",
    "study.strong_threshold",
    "study.priority_decay_days",
    "updater.auto_check",
    "updater.strict_offline",
    "background.enabled",
];

/// Longitud máxima de una clave de ajuste.
pub const SETTING_KEY_MAX_CHARS: usize = 120;
/// Tamaño máximo del JSON de un ajuste.
pub const SETTING_VALUE_MAX_BYTES: usize = 4_096;

/// Valida el nombre de una clave de ajuste.
pub fn validate_setting_key(key: &str) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("la clave del ajuste no puede estar vacía".to_string());
    }
    if key.chars().count() > SETTING_KEY_MAX_CHARS {
        return Err(format!(
            "la clave del ajuste supera {SETTING_KEY_MAX_CHARS} caracteres"
        ));
    }
    if !key
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-'))
    {
        return Err(
            "la clave del ajuste solo admite letras, números, punto, guion y guion bajo"
                .to_string(),
        );
    }
    Ok(())
}

/// Comprueba que el valor sea JSON válido y no supere el límite de tamaño.
pub fn validate_setting_value(value_json: &str) -> Result<(), String> {
    if value_json.len() > SETTING_VALUE_MAX_BYTES {
        return Err(format!(
            "el valor del ajuste supera {SETTING_VALUE_MAX_BYTES} bytes"
        ));
    }
    serde_json::from_str::<Value>(value_json)
        .map(|_| ())
        .map_err(|_| "el valor del ajuste no es JSON válido".to_string())
}

/// Indica si una clave portable está permitida en exportación/importación.
pub fn is_portable_setting_key(key: &str) -> bool {
    PORTABLE_SETTING_KEYS.contains(&key)
}

/// Evento de red registrado por el updater.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEvent {
    pub id: String,
    pub occurred_at: String,
    pub kind: String,
    pub host: String,
    pub bytes_sent: i64,
    pub bytes_received: i64,
    pub outcome: String,
    pub detail: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Store {
    /// Lee un ajuste por clave.
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, StoreError> {
        self.connection()
            .query_row(
                "SELECT value_json FROM setting WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .map_err(StoreError::from)
    }

    /// Crea o actualiza un ajuste.
    pub fn set_setting(&self, key: &str, value_json: &str, scope: &str) -> Result<(), StoreError> {
        if !matches!(scope, "portable" | "machine") {
            return Err(StoreError::InvalidSetting(
                "el alcance del ajuste debe ser portable o machine".to_string(),
            ));
        }
        validate_setting_key(key).map_err(StoreError::InvalidSetting)?;
        validate_setting_value(value_json).map_err(StoreError::InvalidSetting)?;
        self.connection().execute(
            "INSERT INTO setting (key, value_json, scope)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET
               value_json = excluded.value_json,
               scope = excluded.scope,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![key, value_json, scope],
        )?;
        Ok(())
    }

    /// Registra un intento de red sin contenido de usuario.
    pub fn log_network_event(
        &self,
        kind: &str,
        host: &str,
        bytes_sent: i64,
        bytes_received: i64,
        outcome: &str,
        detail: Option<&str>,
    ) -> Result<NetworkEvent, StoreError> {
        let id = new_id();
        self.connection().execute(
            "INSERT INTO network_event
               (id, kind, host, bytes_sent, bytes_received, outcome, detail)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                kind,
                host,
                bytes_sent.max(0),
                bytes_received.max(0),
                outcome,
                detail
            ],
        )?;
        self.get_network_event(&id)?
            .ok_or(StoreError::NetworkEventNotFound)
    }

    /// Lista los eventos de red más recientes.
    pub fn list_network_events(&self, limit: i64) -> Result<Vec<NetworkEvent>, StoreError> {
        let limit = limit.clamp(1, 200);
        let sql = format!(
            "SELECT {NETWORK_COLUMNS} FROM network_event
             WHERE deleted_at IS NULL
             ORDER BY occurred_at DESC, id DESC
             LIMIT ?1"
        );
        let mut statement = self.connection().prepare(&sql)?;
        let rows = statement.query_map(params![limit], network_event_from_row)?;
        let mut events = Vec::new();
        for row in rows {
            events.push(row?);
        }
        Ok(events)
    }

    fn get_network_event(&self, id: &str) -> Result<Option<NetworkEvent>, StoreError> {
        let sql = format!("SELECT {NETWORK_COLUMNS} FROM network_event WHERE id = ?1");
        self.connection()
            .query_row(&sql, params![id], network_event_from_row)
            .optional()
            .map_err(StoreError::from)
    }
}

fn network_event_from_row(row: &Row<'_>) -> rusqlite::Result<NetworkEvent> {
    Ok(NetworkEvent {
        id: row.get(0)?,
        occurred_at: row.get(1)?,
        kind: row.get(2)?,
        host: row.get(3)?,
        bytes_sent: row.get(4)?,
        bytes_received: row.get(5)?,
        outcome: row.get(6)?,
        detail: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

#[cfg(test)]
mod tests {
    use crate::StoreError;
    use crate::tests_support::migrated_store;

    use super::SETTING_VALUE_MAX_BYTES;

    #[test]
    fn seeded_updater_settings_are_opt_in() {
        let store = migrated_store();
        assert_eq!(
            store.get_setting("updater.auto_check").unwrap().as_deref(),
            Some("false")
        );
        assert_eq!(
            store
                .get_setting("updater.strict_offline")
                .unwrap()
                .as_deref(),
            Some("false")
        );
    }

    #[test]
    fn settings_can_be_updated_and_read_back() {
        let store = migrated_store();
        store
            .set_setting("updater.auto_check", "true", "portable")
            .expect("guardar ajuste");
        assert_eq!(
            store.get_setting("updater.auto_check").unwrap().as_deref(),
            Some("true")
        );
        assert!(matches!(
            store.set_setting("updater.auto_check", "false", "otro"),
            Err(crate::StoreError::InvalidSetting(_))
        ));
    }

    #[test]
    fn rejects_invalid_setting_keys_and_values() {
        let store = migrated_store();

        assert!(matches!(
            store.set_setting("", "true", "portable"),
            Err(StoreError::InvalidSetting(_))
        ));
        assert!(matches!(
            store.set_setting("clave con espacios", "true", "portable"),
            Err(StoreError::InvalidSetting(_))
        ));
        assert!(matches!(
            store.set_setting("ok.key", "{", "portable"),
            Err(StoreError::InvalidSetting(_))
        ));

        let oversized = format!("\"{}\"", "x".repeat(SETTING_VALUE_MAX_BYTES));
        assert!(matches!(
            store.set_setting("ok.key", &oversized, "portable"),
            Err(StoreError::InvalidSetting(_))
        ));

        store
            .set_setting("ok.key", "{\"a\":1}", "portable")
            .expect("ajuste válido");
        assert_eq!(
            store.get_setting("ok.key").unwrap().as_deref(),
            Some("{\"a\":1}")
        );
    }

    #[test]
    fn network_events_keep_metadata_only() {
        let store = migrated_store();
        let event = store
            .log_network_event(
                "update_check",
                "github.com",
                0,
                512,
                "ok",
                Some("manifest válido"),
            )
            .expect("registrar evento");
        assert_eq!(event.kind, "update_check");
        assert_eq!(event.host, "github.com");
        assert_eq!(event.bytes_received, 512);

        let events = store.list_network_events(10).expect("listar eventos");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].detail.as_deref(), Some("manifest válido"));
    }
}
