-- Los índices únicos de estas tablas deben ignorar las filas con borrado
-- lógico: una fila borrada no puede bloquear la creación de su reemplazo.
--
-- SQLite no permite quitar una restricción UNIQUE de una tabla existente, así
-- que cada tabla se reconstruye con las mismas columnas y restricciones, sin
-- el UNIQUE de columna, y luego se crea el índice parcial.

CREATE TABLE strength_override_new (
  id             TEXT PRIMARY KEY,
  topic_id       TEXT NOT NULL REFERENCES topic(id) ON DELETE RESTRICT,
  classification TEXT NOT NULL CHECK (classification IN ('strength', 'neutral', 'weak')),
  reason         TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
) STRICT;

INSERT INTO strength_override_new
  (id, topic_id, classification, reason, created_at, updated_at, deleted_at)
SELECT id, topic_id, classification, reason, created_at, updated_at, deleted_at
FROM strength_override;

DROP TABLE strength_override;
ALTER TABLE strength_override_new RENAME TO strength_override;

CREATE UNIQUE INDEX strength_override_topic_unique
  ON strength_override(topic_id)
  WHERE deleted_at IS NULL;

CREATE TABLE review_item_new (
  id                TEXT PRIMARY KEY,
  topic_id          TEXT NOT NULL REFERENCES topic(id) ON DELETE RESTRICT,
  algorithm         TEXT NOT NULL DEFAULT 'sm2' CHECK (algorithm IN ('sm2')),
  algorithm_version TEXT NOT NULL DEFAULT '1',
  ease_factor_cp    INTEGER NOT NULL DEFAULT 250 CHECK (ease_factor_cp >= 130),
  interval_days     INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  repetitions       INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  lapses            INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  due_date          TEXT,
  last_reviewed_at  TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at        TEXT
) STRICT;

INSERT INTO review_item_new
  (id, topic_id, algorithm, algorithm_version, ease_factor_cp, interval_days,
   repetitions, lapses, due_date, last_reviewed_at, created_at, updated_at, deleted_at)
SELECT
  id, topic_id, algorithm, algorithm_version, ease_factor_cp, interval_days,
  repetitions, lapses, due_date, last_reviewed_at, created_at, updated_at, deleted_at
FROM review_item;

DROP TABLE review_item;
ALTER TABLE review_item_new RENAME TO review_item;

CREATE UNIQUE INDEX review_item_topic_unique
  ON review_item(topic_id)
  WHERE deleted_at IS NULL;

CREATE TABLE notification_new (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('class', 'task', 'exam', 'review', 'backup', 'update')),
  entity_type  TEXT,
  entity_id    TEXT,
  scheduled_at TEXT NOT NULL,
  fired_at     TEXT,
  snooze_until TEXT,
  state        TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (state IN ('scheduled', 'fired', 'snoozed', 'dismissed', 'done', 'released')),
  dedupe_key   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at   TEXT
) STRICT;

INSERT INTO notification_new
  (id, kind, entity_type, entity_id, scheduled_at, fired_at, snooze_until, state,
   dedupe_key, created_at, updated_at, deleted_at)
SELECT
  id, kind, entity_type, entity_id, scheduled_at, fired_at, snooze_until, state,
  dedupe_key, created_at, updated_at, deleted_at
FROM notification;

DROP TABLE notification;
ALTER TABLE notification_new RENAME TO notification;

CREATE UNIQUE INDEX notification_dedupe_key_unique
  ON notification(dedupe_key)
  WHERE deleted_at IS NULL;
