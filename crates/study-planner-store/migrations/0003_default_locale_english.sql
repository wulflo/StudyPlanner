-- Study Planner schema v3
--
-- English becomes the default interface language for new vaults.
-- The original seed lives in 0001_initial.sql and must never be edited.
-- Existing vaults that already contain academic or task data keep their
-- current language, so this migration only rewrites the untouched default.

UPDATE setting
SET value_json = '"en"',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'locale'
  AND scope = 'portable'
  AND value_json = '"es"'
  AND NOT EXISTS (SELECT 1 FROM academic_year)
  AND NOT EXISTS (SELECT 1 FROM subject)
  AND NOT EXISTS (SELECT 1 FROM task)
  AND NOT EXISTS (SELECT 1 FROM study_session);
