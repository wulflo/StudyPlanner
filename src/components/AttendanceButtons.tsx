import { useTranslation } from "../lib/i18n";
import type { AttendanceStatus, ScheduleOccurrence } from "../lib/ipc";

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "attendance.present",
  absent: "attendance.absent",
  late: "attendance.late",
  justified: "attendance.justified",
};

const attendanceShort: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  late: "T",
  justified: "J",
};

const allAttendance: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "justified",
];

export function AttendanceButtons({
  occurrence,
  busy,
  onChange,
}: {
  occurrence: ScheduleOccurrence;
  busy: boolean;
  onChange: (status: AttendanceStatus | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <fieldset
      className="attendance-row"
      aria-label={t("attendance.groupAria", {
        subject: occurrence.subjectName,
        date: occurrence.date,
      })}
    >
      {allAttendance.map((status) => {
        const active = occurrence.attendanceStatus === status;
        const label = t(attendanceLabels[status]);
        return (
          <button
            type="button"
            key={status}
            className={`attendance-button${active ? " is-active" : ""}`}
            title={label}
            aria-label={t("attendance.markAria", {
              status: label.toLowerCase(),
              subject: occurrence.subjectName,
              date: occurrence.date,
            })}
            aria-pressed={active}
            onClick={() => onChange(active ? null : status)}
            disabled={busy}
          >
            {attendanceShort[status]}
          </button>
        );
      })}
    </fieldset>
  );
}
