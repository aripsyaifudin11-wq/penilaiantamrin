import type {
  Assignment,
  AssignmentStatus,
  ClassRoom,
  GradeRecord,
  Period,
  Student,
  Subject,
  UstazCombined,
} from '../types/portal';

export interface StatusBreakdownSlice {
  key: 'completed' | 'in_progress' | 'not_started';
  name: string;
  value: number;
  color: string;
}

export function computeOverallStatusBreakdown(
  assignments: Assignment[]
): StatusBreakdownSlice[] {
  const completed = assignments.filter(
    (a) => a.status === 'terkirim' || a.status === 'terkunci'
  ).length;
  const inProgress = assignments.filter((a) => a.status === 'dalam_proses').length;
  const notStarted = assignments.filter((a) => a.status === 'belum_mulai').length;

  return [
    { key: 'completed', name: 'Selesai & Terkunci', value: completed, color: '#065F46' },
    { key: 'in_progress', name: 'Dalam Proses', value: inProgress, color: '#D97706' },
    { key: 'not_started', name: 'Belum Mulai', value: notStarted, color: '#CBD5E1' },
  ];
}

export interface ClassCompletionItem {
  id: string;
  name: string;
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  pct: number;
}

export function computeClassCompletionData(
  classes: ClassRoom[],
  assignments: Assignment[]
): ClassCompletionItem[] {
  return [...classes]
    .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name, 'id'))
    .map((cls) => {
      const classTasks = assignments.filter((a) => a.classId === cls.id);
      const done = classTasks.filter(
        (a) => a.status === 'terkirim' || a.status === 'terkunci'
      ).length;
      const inProgress = classTasks.filter((a) => a.status === 'dalam_proses').length;
      const notStarted = classTasks.filter((a) => a.status === 'belum_mulai').length;
      const pct = classTasks.length === 0 ? 0 : Math.round((done / classTasks.length) * 100);
      return {
        id: cls.id,
        name: cls.name,
        total: classTasks.length,
        done,
        inProgress,
        notStarted,
        pct,
      };
    });
}

export type DeadlineUrgencyLevel = 'overdue' | 'due_soon' | 'on_track' | 'no_deadline';

export interface DeadlineUrgencyResult {
  level: DeadlineUrgencyLevel;
  daysRemaining: number | null;
  label: string;
}

export function evaluateDeadlineUrgency(
  endDateIso: string | undefined | null,
  referenceDate: Date = new Date()
): DeadlineUrgencyResult {
  if (!endDateIso || !/^\d{4}-\d{2}-\d{2}/.test(endDateIso)) {
    return { level: 'no_deadline', daysRemaining: null, label: 'Tanpa tenggat waktu' };
  }
  const [y, m, d] = endDateIso.slice(0, 10).split('-').map(Number);
  const endUtc = Date.UTC(y, m - 1, d);
  const refUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const daysRemaining = Math.round((endUtc - refUtc) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      level: 'overdue',
      daysRemaining,
      label: `Melewati tenggat ${Math.abs(daysRemaining)} hari`,
    };
  }
  if (daysRemaining === 0) {
    return {
      level: 'due_soon',
      daysRemaining: 0,
      label: 'Tenggat hari ini',
    };
  }
  if (daysRemaining <= 3) {
    return {
      level: 'due_soon',
      daysRemaining,
      label: `Mendekati tenggat (${daysRemaining} hari lagi)`,
    };
  }
  return {
    level: 'on_track',
    daysRemaining,
    label: `Tenggat ${daysRemaining} hari lagi`,
  };
}

export interface UstazReminderCandidate {
  ustaz: UstazCombined;
  progress: UstazProgressSummary;
  pendingAssignments: Assignment[];
  urgency: DeadlineUrgencyResult;
  nearestEndDate: string;
  needsReminder: boolean;
}

export function identifyUstazNeedingReminder(
  ustazList: UstazCombined[],
  assignments: Assignment[],
  periods: Period[],
  activePeriodId?: string,
  referenceDate: Date = new Date()
): UstazReminderCandidate[] {
  const periodById = new Map(periods.map((p) => [p.id, p]));
  const activePeriod = periods.find((p) => p.id === activePeriodId) || periods.find((p) => p.isActive);

  return ustazList
    .filter((u) => u.isActive)
    .map((u) => {
      const progress = computeUstazProgress(u.id, assignments);
      const pendingAssignments = assignments.filter(
        (a) => a.ustazId === u.id && a.status !== 'terkirim' && a.status !== 'terkunci'
      );

      let nearestEndDate = '';
      if (pendingAssignments.length > 0) {
        const endDates = pendingAssignments
          .map((a) => periodById.get(a.periodId)?.endDate || activePeriod?.endDate || '')
          .filter(Boolean)
          .sort();
        nearestEndDate = endDates[0] || '';
      } else if (activePeriod?.endDate) {
        nearestEndDate = activePeriod.endDate;
      }

      const urgency =
        pendingAssignments.length > 0
          ? evaluateDeadlineUrgency(nearestEndDate, referenceDate)
          : { level: 'no_deadline' as const, daysRemaining: null, label: 'Semua tugas selesai' };

      return {
        ustaz: u,
        progress,
        pendingAssignments,
        urgency,
        nearestEndDate,
        needsReminder: pendingAssignments.length > 0,
      };
    });
}

export function computeAssignmentPercentage(filledCount: number, totalStudents: number): number {
  if (totalStudents <= 0) return 0;
  const pct = Math.round((filledCount / totalStudents) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function getStatusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'belum_mulai':
      return 'Belum Mulai';
    case 'dalam_proses':
      return 'Dalam Proses';
    case 'terkirim':
      return 'Terkirim';
    case 'terkunci':
      return 'Terkunci';
  }
}

export function canSubmitAssignment(
  students: Student[],
  gradesByStudentId: Record<string, number | null | undefined>
): {
  ready: boolean;
  totalStudents: number;
  filledCount: number;
  missingStudents: Student[];
} {
  const totalStudents = students.length;
  const missingStudents = students.filter((s) => {
    const score = gradesByStudentId[s.id];
    return score === null || score === undefined || Number.isNaN(score) || score < 0 || score > 100;
  });
  const filledCount = totalStudents - missingStudents.length;
  return {
    ready: totalStudents > 0 && missingStudents.length === 0,
    totalStudents,
    filledCount,
    missingStudents,
  };
}

export interface UstazProgressSummary {
  ustazId: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  percentage: number;
  overallStatus: 'Belum Mulai' | 'Dalam Proses' | 'Selesai';
}

export function computeUstazProgress(
  ustazId: string,
  assignments: Assignment[]
): UstazProgressSummary {
  const mine = assignments.filter((a) => a.ustazId === ustazId);
  const totalTasks = mine.length;
  const completedTasks = mine.filter(
    (a) => a.status === 'terkirim' || a.status === 'terkunci'
  ).length;
  const pendingTasks = totalTasks - completedTasks;
  const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  let overallStatus: 'Belum Mulai' | 'Dalam Proses' | 'Selesai' = 'Belum Mulai';
  if (totalTasks > 0 && completedTasks === totalTasks) {
    overallStatus = 'Selesai';
  } else if (
    completedTasks > 0 ||
    mine.some((a) => a.status === 'dalam_proses' || a.filledCount > 0)
  ) {
    overallStatus = 'Dalam Proses';
  }

  return {
    ustazId,
    totalTasks,
    completedTasks,
    pendingTasks,
    percentage,
    overallStatus,
  };
}

export interface RecapMatrixRow {
  no: number;
  studentId: string;
  studentName: string;
  gender: 'L' | 'P';
  // Missing / unsubmitted scores remain null (never 0)
  scoresBySubjectId: Record<string, number | null>;
  average: number | null;
}

export interface RecapMatrixResult {
  subjects: Subject[];
  rows: RecapMatrixRow[];
  paperFormat: 'a4' | 'a3';
}

export function determinePaperFormat(subjectCount: number): 'a4' | 'a3' {
  return subjectCount > 7 ? 'a3' : 'a4';
}

export function buildRecapMatrix(
  classStudents: Student[],
  classSubjects: Subject[],
  assignments: Assignment[],
  gradesByAssignmentId: Record<string, GradeRecord[]>,
  includeDrafts = false
): RecapMatrixResult {
  const sortedStudents = [...classStudents]
    .filter((s) => s.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  const sortedSubjects = [...classSubjects]
    .filter((sub) => sub.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  const assignmentBySubjectId: Record<string, Assignment | undefined> = {};
  for (const sub of sortedSubjects) {
    assignmentBySubjectId[sub.id] = assignments.find((a) => a.subjectId === sub.id);
  }

  const rows: RecapMatrixRow[] = sortedStudents.map((student, idx) => {
    const scoresBySubjectId: Record<string, number | null> = {};
    let sum = 0;
    let count = 0;

    for (const sub of sortedSubjects) {
      const assignment = assignmentBySubjectId[sub.id];
      if (!assignment) {
        scoresBySubjectId[sub.id] = null;
        continue;
      }

      const isFinal = assignment.status === 'terkirim' || assignment.status === 'terkunci';
      if (!isFinal && !includeDrafts) {
        scoresBySubjectId[sub.id] = null;
        continue;
      }

      const grades = gradesByAssignmentId[assignment.id] || [];
      const record = grades.find((g) => g.studentId === student.id);
      if (!record || record.score === null || record.score === undefined) {
        scoresBySubjectId[sub.id] = null;
      } else if (!includeDrafts && record.isDraft && !isFinal) {
        scoresBySubjectId[sub.id] = null;
      } else {
        scoresBySubjectId[sub.id] = record.score;
        sum += record.score;
        count += 1;
      }
    }

    return {
      no: idx + 1,
      studentId: student.id,
      studentName: student.name,
      gender: student.gender,
      scoresBySubjectId,
      average: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
    };
  });

  return {
    subjects: sortedSubjects,
    rows,
    paperFormat: determinePaperFormat(sortedSubjects.length),
  };
}
