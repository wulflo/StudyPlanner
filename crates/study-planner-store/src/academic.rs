//! Repositorio de la estructura académica: años, términos y materias.
//!
//! Todas las entidades usan borrado lógico. Un padre con hijos vivos no se
//! puede borrar: primero hay que borrar o mover los hijos.

use rusqlite::{OptionalExtension, Row, params};
use serde::Deserialize;
use study_planner_core::{
    AcademicYear, StudyCycle, StudyPlanSubject, Subject, Term, TermKind, new_id, normalize_color,
    normalize_date, normalize_name, normalize_optional_short, normalize_optional_text,
    validate_basis_points, validate_date_range,
};

use crate::{Store, StoreError};

const YEAR_COLUMNS: &str = "id, name, start_date, end_date, created_at, updated_at";
const TERM_COLUMNS: &str = "id, year_id, name, kind, start_date, end_date, created_at, updated_at";
const SUBJECT_COLUMNS: &str = "id, term_id, name, code, color, teacher, room, credits, \
     goal_score_cp, attendance_min_bp, created_at, updated_at";
const STUDY_CYCLE_COLUMNS: &str = "id, name, position, created_at, updated_at";
const STUDY_PLAN_SUBJECT_COLUMNS: &str =
    "id, cycle_id, name, code, approved, position, created_at, updated_at";

/// Datos editables de un término.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TermInput {
    pub name: String,
    pub kind: String,
    pub start_date: String,
    pub end_date: String,
}

/// Datos editables de una materia.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectInput {
    pub name: String,
    pub code: Option<String>,
    pub color: Option<String>,
    pub teacher: Option<String>,
    pub room: Option<String>,
    pub credits: Option<i64>,
    pub attendance_min_bp: Option<i64>,
}

/// Datos editables de un ciclo del plan de estudios.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyCycleInput {
    pub name: String,
    pub position: i64,
}

/// Datos editables de una materia del plan de estudios.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyPlanSubjectInput {
    pub name: String,
    pub code: Option<String>,
    pub approved: bool,
    pub position: i64,
}

impl Store {
    /// Lista los años académicos vivos, del más reciente al más antiguo.
    pub fn list_academic_years(&self) -> Result<Vec<AcademicYear>, StoreError> {
        let mut statement = self.connection().prepare(&format!(
            "SELECT {YEAR_COLUMNS}
             FROM academic_year
             WHERE deleted_at IS NULL
             ORDER BY start_date DESC, name"
        ))?;
        let rows = statement.query_map([], year_from_row)?;
        let mut years = Vec::new();
        for row in rows {
            years.push(row?);
        }
        Ok(years)
    }

    /// Crea un año académico.
    pub fn create_academic_year(
        &self,
        name: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<AcademicYear, StoreError> {
        let name = normalize_name(name).map_err(StoreError::InvalidAcademic)?;
        let start_date = normalize_date(start_date).map_err(StoreError::InvalidAcademic)?;
        let end_date = normalize_date(end_date).map_err(StoreError::InvalidAcademic)?;
        validate_date_range(&start_date, &end_date).map_err(StoreError::InvalidAcademic)?;

        let id = new_id();
        self.connection().execute(
            "INSERT INTO academic_year (id, name, start_date, end_date)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, name, start_date, end_date],
        )?;

        self.get_academic_year(&id)?
            .ok_or(StoreError::AcademicYearNotFound)
    }

    /// Actualiza un año académico vivo.
    pub fn update_academic_year(
        &self,
        id: &str,
        name: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<AcademicYear, StoreError> {
        let name = normalize_name(name).map_err(StoreError::InvalidAcademic)?;
        let start_date = normalize_date(start_date).map_err(StoreError::InvalidAcademic)?;
        let end_date = normalize_date(end_date).map_err(StoreError::InvalidAcademic)?;
        validate_date_range(&start_date, &end_date).map_err(StoreError::InvalidAcademic)?;

        let changed = self.connection().execute(
            "UPDATE academic_year
             SET name = ?1, start_date = ?2, end_date = ?3,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?4 AND deleted_at IS NULL",
            params![name, start_date, end_date, id],
        )?;

        if changed == 0 {
            return Err(StoreError::AcademicYearNotFound);
        }

        self.get_academic_year(id)?
            .ok_or(StoreError::AcademicYearNotFound)
    }

    /// Borra lógicamente un año académico sin términos vivos.
    pub fn delete_academic_year(&self, id: &str) -> Result<(), StoreError> {
        self.with_transaction(|| {
            self.ensure_year_is_empty(id)?;

            let changed = self.connection().execute(
                "UPDATE academic_year
                 SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1 AND deleted_at IS NULL",
                params![id],
            )?;

            if changed == 0 {
                return Err(StoreError::AcademicYearNotFound);
            }
            Ok(())
        })
    }

    /// Lista los términos vivos, opcionalmente filtrados por año.
    pub fn list_terms(&self, year_id: Option<&str>) -> Result<Vec<Term>, StoreError> {
        let mut statement = self.connection().prepare(&format!(
            "SELECT {TERM_COLUMNS}
             FROM term
             WHERE deleted_at IS NULL AND (?1 IS NULL OR year_id = ?1)
             ORDER BY start_date, name"
        ))?;
        let rows = statement.query_map(params![year_id], term_from_row)?;
        let mut terms = Vec::new();
        for row in rows {
            terms.push(row?);
        }
        Ok(terms)
    }

    /// Crea un término dentro de un año académico existente.
    pub fn create_term(&self, year_id: &str, input: &TermInput) -> Result<Term, StoreError> {
        let year = self
            .get_academic_year(year_id)?
            .ok_or(StoreError::AcademicYearNotFound)?;
        let (name, kind, start_date, end_date) = validate_term_input(input)?;

        if start_date < year.start_date || end_date > year.end_date {
            return Err(StoreError::InvalidAcademic(
                "El término debe estar dentro del año académico.",
            ));
        }

        let id = new_id();
        self.connection().execute(
            "INSERT INTO term (id, year_id, name, kind, start_date, end_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, year_id, name, kind, start_date, end_date],
        )?;

        self.get_term(&id)?.ok_or(StoreError::TermNotFound)
    }

    /// Actualiza un término vivo.
    pub fn update_term(&self, id: &str, input: &TermInput) -> Result<Term, StoreError> {
        let current = self.get_term(id)?.ok_or(StoreError::TermNotFound)?;
        let year = self
            .get_academic_year(&current.year_id)?
            .ok_or(StoreError::AcademicYearNotFound)?;
        let (name, kind, start_date, end_date) = validate_term_input(input)?;

        if start_date < year.start_date || end_date > year.end_date {
            return Err(StoreError::InvalidAcademic(
                "El término debe estar dentro del año académico.",
            ));
        }

        let changed = self.connection().execute(
            "UPDATE term
             SET name = ?1, kind = ?2, start_date = ?3, end_date = ?4,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?5 AND deleted_at IS NULL",
            params![name, kind, start_date, end_date, id],
        )?;

        if changed == 0 {
            return Err(StoreError::TermNotFound);
        }

        self.get_term(id)?.ok_or(StoreError::TermNotFound)
    }

    /// Borra lógicamente un término sin materias vivas.
    pub fn delete_term(&self, id: &str) -> Result<(), StoreError> {
        self.with_transaction(|| {
            self.ensure_no_live_rows(
                "SELECT count(*) FROM subject WHERE term_id = ?1 AND deleted_at IS NULL",
                id,
                "El término todavía tiene materias; borralas o movelas primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM exam WHERE term_id = ?1 AND deleted_at IS NULL",
                id,
                "El término todavía tiene exámenes; borralos primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM rotation_config WHERE term_id = ?1 AND deleted_at IS NULL",
                id,
                "El término todavía tiene configuraciones de rotación; borralas primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM holiday WHERE term_id = ?1 AND deleted_at IS NULL",
                id,
                "El término todavía tiene feriados; borralos primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM class_slot cs
                 JOIN subject s ON s.id = cs.subject_id
                 WHERE s.term_id = ?1 AND cs.deleted_at IS NULL",
                id,
                "El término todavía tiene clases en el horario; borralas primero.",
            )?;

            let changed = self.connection().execute(
                "UPDATE term
                 SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1 AND deleted_at IS NULL",
                params![id],
            )?;

            if changed == 0 {
                return Err(StoreError::TermNotFound);
            }
            Ok(())
        })
    }

    /// Lista las materias vivas de un término, ordenadas por nombre.
    pub fn list_subjects(&self, term_id: &str) -> Result<Vec<Subject>, StoreError> {
        let mut statement = self.connection().prepare(&format!(
            "SELECT {SUBJECT_COLUMNS}
             FROM subject
             WHERE term_id = ?1 AND deleted_at IS NULL
             ORDER BY name"
        ))?;
        let rows = statement.query_map(params![term_id], subject_from_row)?;
        let mut subjects = Vec::new();
        for row in rows {
            subjects.push(row?);
        }
        Ok(subjects)
    }

    /// Crea una materia dentro de un término existente.
    pub fn create_subject(
        &self,
        term_id: &str,
        input: &SubjectInput,
    ) -> Result<Subject, StoreError> {
        self.get_term(term_id)?.ok_or(StoreError::TermNotFound)?;
        let values = validate_subject_input(input)?;
        let id = new_id();

        self.connection().execute(
            "INSERT INTO subject
               (id, term_id, name, code, color, teacher, room, credits, attendance_min_bp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                term_id,
                values.name,
                values.code,
                values.color,
                values.teacher,
                values.room,
                values.credits,
                values.attendance_min_bp,
            ],
        )?;

        self.get_subject(&id)?.ok_or(StoreError::SubjectNotFound)
    }

    /// Actualiza una materia viva.
    pub fn update_subject(&self, id: &str, input: &SubjectInput) -> Result<Subject, StoreError> {
        let values = validate_subject_input(input)?;

        let changed = self.connection().execute(
            "UPDATE subject
             SET name = ?1, code = ?2, color = ?3, teacher = ?4, room = ?5,
                 credits = ?6, attendance_min_bp = ?7,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?8 AND deleted_at IS NULL",
            params![
                values.name,
                values.code,
                values.color,
                values.teacher,
                values.room,
                values.credits,
                values.attendance_min_bp,
                id,
            ],
        )?;

        if changed == 0 {
            return Err(StoreError::SubjectNotFound);
        }

        self.get_subject(id)?.ok_or(StoreError::SubjectNotFound)
    }

    /// Borra lógicamente una materia sin datos vivos asociados.
    pub fn delete_subject(&self, id: &str) -> Result<(), StoreError> {
        self.with_transaction(|| {
            self.ensure_no_live_rows(
                "SELECT count(*) FROM class_slot WHERE subject_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene clases en el horario; borralas primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM task WHERE subject_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene tareas; borralas o movelas primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM exam WHERE subject_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene exámenes; borralos primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM topic WHERE subject_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene temas; borralos primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM note WHERE subject_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene notas; borralas primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT (SELECT count(*) FROM grade_scale
                         WHERE subject_id = ?1 AND deleted_at IS NULL)
                      + (SELECT count(*) FROM grade_category
                         WHERE subject_id = ?1 AND deleted_at IS NULL)
                      + (SELECT count(*) FROM grade_entry
                         WHERE subject_id = ?1 AND deleted_at IS NULL)",
                id,
                "La materia todavía tiene datos de calificaciones; borralos primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM study_session WHERE subject_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene sesiones de estudio; borralas primero.",
            )?;
            self.ensure_no_live_rows(
                "SELECT count(*) FROM attachment
                 WHERE owner_type = 'subject' AND owner_id = ?1 AND deleted_at IS NULL",
                id,
                "La materia todavía tiene adjuntos; borralos primero.",
            )?;

            let changed = self.connection().execute(
                "UPDATE subject
                 SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1 AND deleted_at IS NULL",
                params![id],
            )?;

            if changed == 0 {
                return Err(StoreError::SubjectNotFound);
            }
            Ok(())
        })
    }

    /// Lista los ciclos vivos del plan de estudios, en orden.
    pub fn list_study_cycles(&self) -> Result<Vec<StudyCycle>, StoreError> {
        let mut statement = self.connection().prepare(&format!(
            "SELECT {STUDY_CYCLE_COLUMNS}
             FROM study_cycle
             WHERE deleted_at IS NULL
             ORDER BY position, name"
        ))?;
        let rows = statement.query_map([], study_cycle_from_row)?;
        let mut cycles = Vec::new();
        for row in rows {
            cycles.push(row?);
        }
        Ok(cycles)
    }

    /// Crea un ciclo del plan de estudios.
    pub fn create_study_cycle(&self, input: &StudyCycleInput) -> Result<StudyCycle, StoreError> {
        let name = normalize_name(&input.name).map_err(StoreError::InvalidAcademic)?;
        let position = validate_position(input.position)?;
        let id = new_id();

        self.connection().execute(
            "INSERT INTO study_cycle (id, name, position) VALUES (?1, ?2, ?3)",
            params![id, name, position],
        )?;

        self.get_study_cycle(&id)?
            .ok_or(StoreError::StudyCycleNotFound)
    }

    /// Actualiza un ciclo vivo del plan de estudios.
    pub fn update_study_cycle(
        &self,
        id: &str,
        input: &StudyCycleInput,
    ) -> Result<StudyCycle, StoreError> {
        let name = normalize_name(&input.name).map_err(StoreError::InvalidAcademic)?;
        let position = validate_position(input.position)?;

        let changed = self.connection().execute(
            "UPDATE study_cycle
             SET name = ?1, position = ?2,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?3 AND deleted_at IS NULL",
            params![name, position, id],
        )?;

        if changed == 0 {
            return Err(StoreError::StudyCycleNotFound);
        }

        self.get_study_cycle(id)?
            .ok_or(StoreError::StudyCycleNotFound)
    }

    /// Borra lógicamente un ciclo sin materias vivas en el plan.
    pub fn delete_study_cycle(&self, id: &str) -> Result<(), StoreError> {
        self.with_transaction(|| {
            self.ensure_no_live_rows(
                "SELECT count(*) FROM study_plan_subject
                 WHERE cycle_id = ?1 AND deleted_at IS NULL",
                id,
                "El ciclo todavía tiene materias del plan; borralas primero.",
            )?;

            let changed = self.connection().execute(
                "UPDATE study_cycle
                 SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1 AND deleted_at IS NULL",
                params![id],
            )?;

            if changed == 0 {
                return Err(StoreError::StudyCycleNotFound);
            }
            Ok(())
        })
    }

    /// Lista las materias vivas del plan, opcionalmente filtradas por ciclo.
    pub fn list_study_plan_subjects(
        &self,
        cycle_id: Option<&str>,
    ) -> Result<Vec<StudyPlanSubject>, StoreError> {
        let mut statement = self.connection().prepare(&format!(
            "SELECT {STUDY_PLAN_SUBJECT_COLUMNS}
             FROM study_plan_subject
             WHERE deleted_at IS NULL AND (?1 IS NULL OR cycle_id = ?1)
             ORDER BY position, name"
        ))?;
        let rows = statement.query_map(params![cycle_id], study_plan_subject_from_row)?;
        let mut subjects = Vec::new();
        for row in rows {
            subjects.push(row?);
        }
        Ok(subjects)
    }

    /// Crea una materia dentro de un ciclo existente.
    pub fn create_study_plan_subject(
        &self,
        cycle_id: &str,
        input: &StudyPlanSubjectInput,
    ) -> Result<StudyPlanSubject, StoreError> {
        self.get_study_cycle(cycle_id)?
            .ok_or(StoreError::StudyCycleNotFound)?;
        let values = validate_study_plan_subject_input(input)?;
        let id = new_id();

        self.connection().execute(
            "INSERT INTO study_plan_subject
               (id, cycle_id, name, code, approved, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                cycle_id,
                values.name,
                values.code,
                values.approved,
                values.position,
            ],
        )?;

        self.get_study_plan_subject(&id)?
            .ok_or(StoreError::StudyPlanSubjectNotFound)
    }

    /// Actualiza una materia viva del plan de estudios.
    pub fn update_study_plan_subject(
        &self,
        id: &str,
        input: &StudyPlanSubjectInput,
    ) -> Result<StudyPlanSubject, StoreError> {
        let values = validate_study_plan_subject_input(input)?;

        let changed = self.connection().execute(
            "UPDATE study_plan_subject
             SET name = ?1, code = ?2, approved = ?3, position = ?4,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?5 AND deleted_at IS NULL",
            params![
                values.name,
                values.code,
                values.approved,
                values.position,
                id,
            ],
        )?;

        if changed == 0 {
            return Err(StoreError::StudyPlanSubjectNotFound);
        }

        self.get_study_plan_subject(id)?
            .ok_or(StoreError::StudyPlanSubjectNotFound)
    }

    /// Marca o desmarca una materia del plan como aprobada.
    pub fn set_study_plan_subject_approved(
        &self,
        id: &str,
        approved: bool,
    ) -> Result<StudyPlanSubject, StoreError> {
        let changed = self.connection().execute(
            "UPDATE study_plan_subject
             SET approved = ?1,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?2 AND deleted_at IS NULL",
            params![approved, id],
        )?;

        if changed == 0 {
            return Err(StoreError::StudyPlanSubjectNotFound);
        }

        self.get_study_plan_subject(id)?
            .ok_or(StoreError::StudyPlanSubjectNotFound)
    }

    /// Borra lógicamente una materia del plan de estudios.
    pub fn delete_study_plan_subject(&self, id: &str) -> Result<(), StoreError> {
        let changed = self.connection().execute(
            "UPDATE study_plan_subject
             SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
        )?;

        if changed == 0 {
            return Err(StoreError::StudyPlanSubjectNotFound);
        }
        Ok(())
    }

    fn get_study_cycle(&self, id: &str) -> Result<Option<StudyCycle>, StoreError> {
        let cycle = self
            .connection()
            .query_row(
                &format!(
                    "SELECT {STUDY_CYCLE_COLUMNS}
                     FROM study_cycle
                     WHERE id = ?1 AND deleted_at IS NULL"
                ),
                params![id],
                study_cycle_from_row,
            )
            .optional()?;
        Ok(cycle)
    }

    fn get_study_plan_subject(&self, id: &str) -> Result<Option<StudyPlanSubject>, StoreError> {
        let subject = self
            .connection()
            .query_row(
                &format!(
                    "SELECT {STUDY_PLAN_SUBJECT_COLUMNS}
                     FROM study_plan_subject
                     WHERE id = ?1 AND deleted_at IS NULL"
                ),
                params![id],
                study_plan_subject_from_row,
            )
            .optional()?;
        Ok(subject)
    }

    fn get_academic_year(&self, id: &str) -> Result<Option<AcademicYear>, StoreError> {
        let year = self
            .connection()
            .query_row(
                &format!(
                    "SELECT {YEAR_COLUMNS}
                     FROM academic_year
                     WHERE id = ?1 AND deleted_at IS NULL"
                ),
                params![id],
                year_from_row,
            )
            .optional()?;
        Ok(year)
    }

    fn ensure_year_is_empty(&self, id: &str) -> Result<(), StoreError> {
        let exists = self.get_academic_year(id)?.is_some();
        if !exists {
            return Err(StoreError::AcademicYearNotFound);
        }

        self.ensure_no_live_rows(
            "SELECT count(*) FROM term WHERE year_id = ?1 AND deleted_at IS NULL",
            id,
            "El año todavía tiene términos; borralos primero.",
        )?;
        // Las comprobaciones siguientes cubren hijos vivos colgados de términos
        // ya borrados (por ejemplo, datos importados de forma inconsistente).
        self.ensure_no_live_rows(
            "SELECT count(*) FROM subject s
             JOIN term t ON t.id = s.term_id
             WHERE t.year_id = ?1 AND s.deleted_at IS NULL",
            id,
            "El año todavía tiene materias; borralas o movelas primero.",
        )?;
        self.ensure_no_live_rows(
            "SELECT count(*) FROM exam e
             JOIN term t ON t.id = e.term_id
             WHERE t.year_id = ?1 AND e.deleted_at IS NULL",
            id,
            "El año todavía tiene exámenes; borralos primero.",
        )?;
        self.ensure_no_live_rows(
            "SELECT count(*) FROM rotation_config r
             JOIN term t ON t.id = r.term_id
             WHERE t.year_id = ?1 AND r.deleted_at IS NULL",
            id,
            "El año todavía tiene configuraciones de rotación; borralas primero.",
        )?;
        self.ensure_no_live_rows(
            "SELECT count(*) FROM holiday h
             JOIN term t ON t.id = h.term_id
             WHERE t.year_id = ?1 AND h.deleted_at IS NULL",
            id,
            "El año todavía tiene feriados; borralos primero.",
        )?;
        Ok(())
    }

    pub(crate) fn get_term(&self, id: &str) -> Result<Option<Term>, StoreError> {
        let term = self
            .connection()
            .query_row(
                &format!(
                    "SELECT {TERM_COLUMNS}
                     FROM term
                     WHERE id = ?1 AND deleted_at IS NULL"
                ),
                params![id],
                term_from_row,
            )
            .optional()?;
        Ok(term)
    }

    pub(crate) fn get_subject(&self, id: &str) -> Result<Option<Subject>, StoreError> {
        let subject = self
            .connection()
            .query_row(
                &format!(
                    "SELECT {SUBJECT_COLUMNS}
                     FROM subject
                     WHERE id = ?1 AND deleted_at IS NULL"
                ),
                params![id],
                subject_from_row,
            )
            .optional()?;
        Ok(subject)
    }
}

struct ValidSubject {
    name: String,
    code: Option<String>,
    color: String,
    teacher: Option<String>,
    room: Option<String>,
    credits: Option<i64>,
    attendance_min_bp: Option<i64>,
}

fn validate_term_input(
    input: &TermInput,
) -> Result<(String, &'static str, String, String), StoreError> {
    let name = normalize_name(&input.name).map_err(StoreError::InvalidAcademic)?;
    let kind = TermKind::from_db(&input.kind)
        .ok_or(StoreError::InvalidAcademic("Tipo de término inválido."))?;
    let start_date = normalize_date(&input.start_date).map_err(StoreError::InvalidAcademic)?;
    let end_date = normalize_date(&input.end_date).map_err(StoreError::InvalidAcademic)?;
    validate_date_range(&start_date, &end_date).map_err(StoreError::InvalidAcademic)?;
    Ok((name, kind.as_str(), start_date, end_date))
}

fn validate_subject_input(input: &SubjectInput) -> Result<ValidSubject, StoreError> {
    let name = normalize_name(&input.name).map_err(StoreError::InvalidAcademic)?;
    let code = normalize_optional_short(input.code.as_deref().unwrap_or_default())
        .map_err(StoreError::InvalidAcademic)?;
    let color = normalize_color(input.color.as_deref().unwrap_or_default())
        .map_err(StoreError::InvalidAcademic)?;
    let teacher = normalize_optional_text(input.teacher.as_deref().unwrap_or_default())
        .map_err(StoreError::InvalidAcademic)?;
    let room = normalize_optional_text(input.room.as_deref().unwrap_or_default())
        .map_err(StoreError::InvalidAcademic)?;

    let credits = match input.credits {
        Some(value) if value < 0 => {
            return Err(StoreError::InvalidAcademic(
                "Los créditos no pueden ser negativos.",
            ));
        }
        value => value,
    };

    let attendance_min_bp = match input.attendance_min_bp {
        Some(value) => Some(validate_basis_points(value).map_err(StoreError::InvalidAcademic)?),
        None => None,
    };

    Ok(ValidSubject {
        name,
        code,
        color,
        teacher,
        room,
        credits,
        attendance_min_bp,
    })
}

struct ValidStudyPlanSubject {
    name: String,
    code: Option<String>,
    approved: bool,
    position: i64,
}

fn validate_position(position: i64) -> Result<i64, StoreError> {
    if position < 0 {
        return Err(StoreError::InvalidAcademic(
            "La posición no puede ser negativa.",
        ));
    }
    Ok(position)
}

fn validate_study_plan_subject_input(
    input: &StudyPlanSubjectInput,
) -> Result<ValidStudyPlanSubject, StoreError> {
    let name = normalize_name(&input.name).map_err(StoreError::InvalidAcademic)?;
    let code = normalize_optional_short(input.code.as_deref().unwrap_or_default())
        .map_err(StoreError::InvalidAcademic)?;
    let position = validate_position(input.position)?;

    Ok(ValidStudyPlanSubject {
        name,
        code,
        approved: input.approved,
        position,
    })
}

fn year_from_row(row: &Row<'_>) -> rusqlite::Result<AcademicYear> {
    Ok(AcademicYear {
        id: row.get(0)?,
        name: row.get(1)?,
        start_date: row.get(2)?,
        end_date: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn term_from_row(row: &Row<'_>) -> rusqlite::Result<Term> {
    let kind: String = row.get(3)?;

    Ok(Term {
        id: row.get(0)?,
        year_id: row.get(1)?,
        name: row.get(2)?,
        kind: TermKind::from_db(&kind).unwrap_or(TermKind::Other),
        start_date: row.get(4)?,
        end_date: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn subject_from_row(row: &Row<'_>) -> rusqlite::Result<Subject> {
    Ok(Subject {
        id: row.get(0)?,
        term_id: row.get(1)?,
        name: row.get(2)?,
        code: row.get(3)?,
        color: row.get(4)?,
        teacher: row.get(5)?,
        room: row.get(6)?,
        credits: row.get(7)?,
        goal_score_cp: row.get(8)?,
        attendance_min_bp: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn study_cycle_from_row(row: &Row<'_>) -> rusqlite::Result<StudyCycle> {
    Ok(StudyCycle {
        id: row.get(0)?,
        name: row.get(1)?,
        position: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn study_plan_subject_from_row(row: &Row<'_>) -> rusqlite::Result<StudyPlanSubject> {
    Ok(StudyPlanSubject {
        id: row.get(0)?,
        cycle_id: row.get(1)?,
        name: row.get(2)?,
        code: row.get(3)?,
        approved: row.get(4)?,
        position: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn migrated_store() -> Store {
        let mut store = Store::open_in_memory().expect("abrir memoria");
        store.migrate().expect("migrar");
        store
    }

    fn seed_subject(store: &Store) -> Subject {
        let year = store
            .create_academic_year("2026", "2026-03-01", "2026-12-20")
            .unwrap();
        let term = store
            .create_term(
                &year.id,
                &TermInput {
                    name: "Primer semestre".to_string(),
                    kind: "semester".to_string(),
                    start_date: "2026-03-02".to_string(),
                    end_date: "2026-07-10".to_string(),
                },
            )
            .unwrap();
        store
            .create_subject(
                &term.id,
                &SubjectInput {
                    name: "  Álgebra lineal  ".to_string(),
                    code: Some(" MAT-101 ".to_string()),
                    color: Some("#aabbcc".to_string()),
                    teacher: Some("Docente".to_string()),
                    room: Some("Aula 3".to_string()),
                    credits: Some(6),
                    attendance_min_bp: Some(7_500),
                },
            )
            .unwrap()
    }

    #[test]
    fn manages_study_plan_cycles_and_approved_subjects() {
        let store = migrated_store();
        let cycle = store
            .create_study_cycle(&StudyCycleInput {
                name: "  Ciclo 1  ".to_string(),
                position: 0,
            })
            .unwrap();
        assert_eq!(cycle.name, "Ciclo 1");

        let subject = store
            .create_study_plan_subject(
                &cycle.id,
                &StudyPlanSubjectInput {
                    name: "  Análisis I  ".to_string(),
                    code: Some(" MAT-201 ".to_string()),
                    approved: false,
                    position: 0,
                },
            )
            .unwrap();
        assert_eq!(subject.name, "Análisis I");
        assert_eq!(subject.code.as_deref(), Some("MAT-201"));
        assert!(!subject.approved);

        let approved = store
            .set_study_plan_subject_approved(&subject.id, true)
            .unwrap();
        assert!(approved.approved);
        assert_eq!(store.list_study_plan_subjects(None).unwrap().len(), 1);
        assert_eq!(
            store
                .list_study_plan_subjects(Some(&cycle.id))
                .unwrap()
                .len(),
            1
        );

        assert!(matches!(
            store.delete_study_cycle(&cycle.id).unwrap_err(),
            StoreError::Conflict(_)
        ));

        let updated = store
            .update_study_cycle(
                &cycle.id,
                &StudyCycleInput {
                    name: "Ciclo A".to_string(),
                    position: 2,
                },
            )
            .unwrap();
        assert_eq!(updated.name, "Ciclo A");
        assert_eq!(updated.position, 2);

        store.delete_study_plan_subject(&subject.id).unwrap();
        store.delete_study_cycle(&cycle.id).unwrap();
        assert!(store.list_study_cycles().unwrap().is_empty());
        assert!(store.list_study_plan_subjects(None).unwrap().is_empty());
    }

    #[test]
    fn rejects_negative_study_plan_positions() {
        let store = migrated_store();
        let error = store
            .create_study_cycle(&StudyCycleInput {
                name: "Ciclo".to_string(),
                position: -1,
            })
            .unwrap_err();
        assert!(matches!(error, StoreError::InvalidAcademic(_)));
    }

    #[test]
    fn creates_and_updates_the_academic_structure() {
        let store = migrated_store();
        let subject = seed_subject(&store);

        assert_eq!(subject.name, "Álgebra lineal");
        assert_eq!(subject.code.as_deref(), Some("MAT-101"));
        assert_eq!(subject.color, "#AABBCC");
        assert_eq!(subject.attendance_min_bp, Some(7_500));

        let years = store.list_academic_years().unwrap();
        assert_eq!(years.len(), 1);
        let terms = store.list_terms(Some(&years[0].id)).unwrap();
        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].kind, TermKind::Semester);
        assert_eq!(store.list_subjects(&terms[0].id).unwrap().len(), 1);

        let renamed = store
            .update_academic_year(&years[0].id, "2026 completo", "2026-03-01", "2026-12-20")
            .unwrap();
        assert_eq!(renamed.name, "2026 completo");
    }

    #[test]
    fn rejects_terms_outside_the_year_and_invalid_ranges() {
        let store = migrated_store();
        let year = store
            .create_academic_year("2026", "2026-03-01", "2026-12-20")
            .unwrap();

        let error = store
            .create_term(
                &year.id,
                &TermInput {
                    name: "Fuera".to_string(),
                    kind: "semester".to_string(),
                    start_date: "2026-01-01".to_string(),
                    end_date: "2026-06-01".to_string(),
                },
            )
            .unwrap_err();
        assert!(matches!(error, StoreError::InvalidAcademic(_)));

        let error = store
            .create_term(
                &year.id,
                &TermInput {
                    name: "Invertido".to_string(),
                    kind: "semester".to_string(),
                    start_date: "2026-07-01".to_string(),
                    end_date: "2026-06-01".to_string(),
                },
            )
            .unwrap_err();
        assert!(matches!(error, StoreError::InvalidAcademic(_)));
    }

    #[test]
    fn soft_deletes_respect_live_children() {
        let store = migrated_store();
        let subject = seed_subject(&store);
        let year = store.list_academic_years().unwrap().remove(0);
        let term = store.list_terms(Some(&year.id)).unwrap().remove(0);

        assert!(matches!(
            store.delete_academic_year(&year.id).unwrap_err(),
            StoreError::Conflict(_)
        ));
        assert!(matches!(
            store.delete_term(&term.id).unwrap_err(),
            StoreError::Conflict(_)
        ));

        store.delete_subject(&subject.id).unwrap();
        assert!(store.list_subjects(&term.id).unwrap().is_empty());

        store.delete_term(&term.id).unwrap();
        store.delete_academic_year(&year.id).unwrap();
        assert!(store.list_academic_years().unwrap().is_empty());
    }

    #[test]
    fn deleting_a_subject_requires_no_live_domain_data() {
        let store = migrated_store();
        let subject = seed_subject(&store);

        let task = store
            .create_task_full(&crate::TaskInput {
                subject_id: Some(subject.id.clone()),
                title: "Trabajo práctico".to_string(),
                ..crate::TaskInput::default()
            })
            .unwrap();
        assert!(matches!(
            store.delete_subject(&subject.id).unwrap_err(),
            StoreError::Conflict(_)
        ));
        store.delete_task(&task.id).unwrap();

        let topic = store
            .create_topic(
                &subject.id,
                &crate::TopicInput {
                    name: "Unidad 1".to_string(),
                    ..crate::TopicInput::default()
                },
            )
            .unwrap();
        assert!(matches!(
            store.delete_subject(&subject.id).unwrap_err(),
            StoreError::Conflict(_)
        ));
        store.delete_topic(&topic.id).unwrap();

        store.delete_subject(&subject.id).unwrap();
    }

    #[test]
    fn deleting_a_term_requires_no_live_rotation_or_holidays() {
        let store = migrated_store();
        let subject = seed_subject(&store);
        let year = store.list_academic_years().unwrap().remove(0);
        let term = store.list_terms(Some(&year.id)).unwrap().remove(0);
        store.delete_subject(&subject.id).unwrap();

        let holiday = store
            .create_holiday(Some(&term.id), "2026-03-02", "Feriado")
            .unwrap();
        assert!(matches!(
            store.delete_term(&term.id).unwrap_err(),
            StoreError::Conflict(_)
        ));
        store.delete_holiday(&holiday.id).unwrap();

        store
            .save_rotation(
                &term.id,
                &crate::RotationInput {
                    mode: "weekly_ab".to_string(),
                    anchor_date: "2026-03-02".to_string(),
                    cycle_length: 2,
                    labels: vec!["A".to_string(), "B".to_string()],
                    day_cycle: Vec::new(),
                },
            )
            .unwrap();
        assert!(matches!(
            store.delete_term(&term.id).unwrap_err(),
            StoreError::Conflict(_)
        ));
        store.delete_rotation(&term.id).unwrap();

        store.delete_term(&term.id).unwrap();
    }
}
