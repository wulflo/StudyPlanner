-- Study Planner schema v4
--
-- The study plan ("degree cycles") is independent from the term-based subject
-- list: it tracks the whole degree and which subjects are already approved.
-- Cycles and plan subjects use soft deletes like the rest of the domain.

CREATE TABLE study_cycle (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
) STRICT;

CREATE INDEX study_cycle_position
  ON study_cycle(position)
  WHERE deleted_at IS NULL;

CREATE TABLE study_plan_subject (
  id         TEXT PRIMARY KEY,
  cycle_id   TEXT NOT NULL REFERENCES study_cycle(id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  code       TEXT,
  approved   INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0, 1)),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
) STRICT;

CREATE INDEX study_plan_subject_cycle
  ON study_plan_subject(cycle_id, position)
  WHERE deleted_at IS NULL;
