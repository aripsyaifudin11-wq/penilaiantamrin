import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReminderMessageTemplate,
  buildWhatsappReminderUrl,
  hasDuplicateAssignment,
  parseScoreInput,
  sanitizeWhatsappNumber,
  validateStudentImportRow,
  validateStudentSheetRows,
  validateUstazImportRow,
} from './validation';
import {
  buildRecapMatrix,
  canSubmitAssignment,
  computeAssignmentPercentage,
  computeClassCompletionData,
  computeOverallStatusBreakdown,
  computeUstazProgress,
  determinePaperFormat,
  evaluateDeadlineUrgency,
  identifyUstazNeedingReminder,
} from './grading';
import { INITIAL_ADMIN_HASH, INITIAL_ADMIN_SALT, verifySecret } from './crypto';
import { createEmptyWorkspace, DEFAULT_SCHOOL_SETTINGS } from '../data/workspaceDefaults';
import type { Assignment, ClassRoom, GradeRecord, Period, Student, Subject, UstazCombined } from '../types/portal';

test('createEmptyWorkspace starts completely clean with zero dummy records', () => {
  const workspace = createEmptyWorkspace();
  assert.equal(workspace.periods.length, 0);
  assert.equal(workspace.classes.length, 0);
  assert.equal(workspace.subjects.length, 0);
  assert.equal(workspace.ustazList.length, 0);
  assert.equal(workspace.students.length, 0);
  assert.equal(workspace.assignments.length, 0);
  assert.equal(workspace.auditLogs.length, 0);
  assert.deepEqual(workspace.gradesByAssignmentId, {});
  assert.equal(workspace.settings.schoolName, DEFAULT_SCHOOL_SETTINGS.schoolName);
  assert.equal(workspace.settings.headmasterName, '');
  assert.equal(workspace.settings.activePeriodId, '');
});

test('INITIAL_ADMIN_HASH matches SHA-256 of initial install password without plaintext storage', async () => {
  const valid = await verifySecret('admin123', INITIAL_ADMIN_SALT, INITIAL_ADMIN_HASH);
  const invalid = await verifySecret('wrongpass', INITIAL_ADMIN_SALT, INITIAL_ADMIN_HASH);
  assert.equal(valid, true);
  assert.equal(invalid, false);
});

test('parseScoreInput validates integers 0-100 and allows empty draft', () => {
  assert.deepEqual(parseScoreInput(''), { valid: true, score: null });
  assert.deepEqual(parseScoreInput('0'), { valid: true, score: 0 });
  assert.deepEqual(parseScoreInput('85'), { valid: true, score: 85 });
  assert.deepEqual(parseScoreInput('100'), { valid: true, score: 100 });
  assert.equal(parseScoreInput('101').valid, false);
  assert.equal(parseScoreInput('-5').valid, false);
  assert.equal(parseScoreInput('85.5').valid, false);
  assert.equal(parseScoreInput('abc').valid, false);
});

test('canSubmitAssignment blocks submission when any student score is missing', () => {
  const students: Student[] = [
    { id: 's1', name: 'Ahmad', gender: 'L', classId: 'c1', className: '1 Ula', isActive: true, createdAt: '', updatedAt: '' },
    { id: 's2', name: 'Fatimah', gender: 'P', classId: 'c1', className: '1 Ula', isActive: true, createdAt: '', updatedAt: '' },
  ];
  const incomplete = canSubmitAssignment(students, { s1: 90, s2: null });
  assert.equal(incomplete.ready, false);
  assert.equal(incomplete.filledCount, 1);
  assert.equal(incomplete.missingStudents.length, 1);

  const complete = canSubmitAssignment(students, { s1: 90, s2: 0 });
  assert.equal(complete.ready, true);
  assert.equal(complete.filledCount, 2);
});

test('hasDuplicateAssignment detects duplicate class + subject + period combinations', () => {
  const existing = [
    { id: 'p1__c1__sub1', periodId: 'p1', classId: 'c1', subjectId: 'sub1' },
  ];
  assert.equal(hasDuplicateAssignment(existing, 'p1', 'c1', 'sub1'), true);
  assert.equal(hasDuplicateAssignment(existing, 'p1', 'c1', 'sub2'), false);
  assert.equal(hasDuplicateAssignment(existing, 'p1', 'c1', 'sub1', 'p1__c1__sub1'), false);
});

test('buildRecapMatrix leaves unsubmitted scores as null and never zero', () => {
  const students: Student[] = [
    { id: 's1', name: 'Zaid', gender: 'L', classId: 'c1', className: '1 Ula', isActive: true, createdAt: '', updatedAt: '' },
  ];
  const subjects: Subject[] = [
    { id: 'sub1', name: 'Fiqih', classIds: ['c1'], isActive: true, createdAt: '', updatedAt: '' },
    { id: 'sub2', name: 'Nahwu', classIds: ['c1'], isActive: true, createdAt: '', updatedAt: '' },
  ];
  const assignments: Assignment[] = [
    {
      id: 'a1', ustazId: 'u1', ustazName: 'Ust. Ali', classId: 'c1', className: '1 Ula',
      subjectId: 'sub1', subjectName: 'Fiqih', periodId: 'p1', periodName: 'PAS',
      status: 'terkunci', totalStudents: 1, filledCount: 1, createdAt: '', updatedAt: ''
    },
    {
      id: 'a2', ustazId: 'u2', ustazName: 'Ust. Umar', classId: 'c1', className: '1 Ula',
      subjectId: 'sub2', subjectName: 'Nahwu', periodId: 'p1', periodName: 'PAS',
      status: 'dalam_proses', totalStudents: 1, filledCount: 1, createdAt: '', updatedAt: ''
    },
  ];
  const gradesByAssignmentId: Record<string, GradeRecord[]> = {
    a1: [{
      studentId: 's1', studentName: 'Zaid', assignmentId: 'a1', classId: 'c1',
      subjectId: 'sub1', periodId: 'p1', ustazId: 'u1', score: 88,
      isDraft: false, isLocked: true, updatedAt: '', updatedById: 'u1', updatedByName: 'Ust. Ali'
    }],
    a2: [{
      studentId: 's1', studentName: 'Zaid', assignmentId: 'a2', classId: 'c1',
      subjectId: 'sub2', periodId: 'p1', ustazId: 'u2', score: 75,
      isDraft: true, isLocked: false, updatedAt: '', updatedById: 'u2', updatedByName: 'Ust. Umar'
    }],
  };

  const matrix = buildRecapMatrix(students, subjects, assignments, gradesByAssignmentId, false);
  assert.equal(matrix.rows[0].scoresBySubjectId['sub1'], 88);
  // Draft/unsubmitted Nahwu must be null, NEVER 0
  assert.equal(matrix.rows[0].scoresBySubjectId['sub2'], null);
  assert.equal(matrix.rows[0].average, 88);
  assert.equal(determinePaperFormat(6), 'a4');
  assert.equal(determinePaperFormat(9), 'a3');
});

test('WhatsApp phone normalization and URL builder', () => {
  assert.equal(sanitizeWhatsappNumber('0812-3456-7890'), '6281234567890');
  const url = buildWhatsappReminderUrl('08123456789', 'Assalamualaikum Ustaz');
  assert.equal(url, 'https://wa.me/628123456789?text=Assalamualaikum%20Ustaz');
});

test('XLSX import row validators catch invalid class, gender, and PIN', () => {
  const classes = [{ id: 'c1', name: '1 Ula A' }];
  const okStudent = validateStudentImportRow(2, 'Muhammad Hasan', 'L', '1 ula a', classes);
  assert.equal(okStudent.isValid, true);
  assert.equal(okStudent.classId, 'c1');

  const badStudent = validateStudentImportRow(3, 'A', 'X', 'Kelas Gaib', classes);
  assert.equal(badStudent.isValid, false);
  assert.equal(badStudent.errors.length, 3);

  const badUstaz = validateUstazImportRow(2, 'Ustaz Ahmad', '08123', '12ab', 'Aktif');
  assert.equal(badUstaz.isValid, false);

  const sheetValidated = validateStudentSheetRows(
    [
      { 'Nama Santri': 'Ahmad Fauzi', 'Jenis Kelamin (L/P)': 'Laki-laki', Kelas: '1   Ula A' },
      { 'Nama Santri': '', 'Jenis Kelamin (L/P)': '', Kelas: '' }, // blank trailing row skipped
      { 'Nama Santri': 'Siti', 'Jenis Kelamin (L/P)': '', Kelas: 'Kelas Tidak Ada' },
      { 'Nama Santri': 'Ahmad Fauzi', 'Jenis Kelamin (L/P)': 'L', Kelas: '1 Ula A' }, // duplicate
    ],
    classes,
    [{ name: 'Zaid', classId: 'c1' }]
  );
  assert.equal(sheetValidated.length, 3);
  assert.equal(sheetValidated[0].isValid, true);
  assert.equal(sheetValidated[0].gender, 'L');
  assert.equal(sheetValidated[0].className, '1 Ula A');
  assert.equal(sheetValidated[1].isValid, false);
  assert.equal(sheetValidated[1].errors.length, 2); // missing gender + unknown class
  assert.equal(sheetValidated[2].isValid, true);
  assert.equal(sheetValidated[2].isDuplicate, true);
});

test('Progress helpers compute percentages and overall status accurately', () => {
  assert.equal(computeAssignmentPercentage(5, 10), 50);
  assert.equal(computeAssignmentPercentage(0, 0), 0);
  const summary = computeUstazProgress('u1', [
    {
      id: 'a1', ustazId: 'u1', ustazName: 'Ust', classId: 'c1', className: '1 Ula',
      subjectId: 's1', subjectName: 'Fiqih', periodId: 'p1', periodName: 'PAS',
      status: 'terkunci', totalStudents: 10, filledCount: 10, createdAt: '', updatedAt: ''
    },
    {
      id: 'a2', ustazId: 'u1', ustazName: 'Ust', classId: 'c2', className: '2 Ula',
      subjectId: 's1', subjectName: 'Fiqih', periodId: 'p1', periodName: 'PAS',
      status: 'dalam_proses', totalStudents: 10, filledCount: 4, createdAt: '', updatedAt: ''
    },
  ]);
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.pendingTasks, 1);
  assert.equal(summary.percentage, 50);
  assert.equal(summary.overallStatus, 'Dalam Proses');
});

test('Chart aggregators compute overall status breakdown and per-class completion percentages', () => {
  const classes: ClassRoom[] = [
    { id: 'c1', name: '1 Ula A', level: 'Ula', orderIndex: 1, isActive: true, createdAt: '', updatedAt: '' },
    { id: 'c2', name: '2 Ula A', level: 'Ula', orderIndex: 2, isActive: true, createdAt: '', updatedAt: '' },
  ];
  const assignments: Assignment[] = [
    {
      id: 'a1', ustazId: 'u1', ustazName: 'Ust. Ali', classId: 'c1', className: '1 Ula A',
      subjectId: 's1', subjectName: 'Fiqih', periodId: 'p1', periodName: 'PAS',
      status: 'terkunci', totalStudents: 10, filledCount: 10, createdAt: '', updatedAt: ''
    },
    {
      id: 'a2', ustazId: 'u1', ustazName: 'Ust. Ali', classId: 'c1', className: '1 Ula A',
      subjectId: 's2', subjectName: 'Nahwu', periodId: 'p1', periodName: 'PAS',
      status: 'dalam_proses', totalStudents: 10, filledCount: 5, createdAt: '', updatedAt: ''
    },
    {
      id: 'a3', ustazId: 'u2', ustazName: 'Ust. Umar', classId: 'c2', className: '2 Ula A',
      subjectId: 's1', subjectName: 'Fiqih', periodId: 'p1', periodName: 'PAS',
      status: 'belum_mulai', totalStudents: 8, filledCount: 0, createdAt: '', updatedAt: ''
    },
  ];

  const slices = computeOverallStatusBreakdown(assignments);
  assert.equal(slices.find((s) => s.key === 'completed')?.value, 1);
  assert.equal(slices.find((s) => s.key === 'in_progress')?.value, 1);
  assert.equal(slices.find((s) => s.key === 'not_started')?.value, 1);

  const perClass = computeClassCompletionData(classes, assignments);
  assert.equal(perClass[0].name, '1 Ula A');
  assert.equal(perClass[0].pct, 50);
  assert.equal(perClass[1].name, '2 Ula A');
  assert.equal(perClass[1].pct, 0);
});

test('Deadline urgency detector and WhatsApp reminder templates handle approaching and overdue deadlines', () => {
  const ref = new Date('2026-11-18T10:00:00Z');
  assert.equal(evaluateDeadlineUrgency('2026-11-17', ref).level, 'overdue');
  assert.equal(evaluateDeadlineUrgency('2026-11-18', ref).level, 'due_soon');
  assert.equal(evaluateDeadlineUrgency('2026-11-20', ref).level, 'due_soon');
  assert.equal(evaluateDeadlineUrgency('2026-11-28', ref).level, 'on_track');

  const ustazList: UstazCombined[] = [
    { id: 'u1', name: 'Ust. Hasan', whatsapp: '081234567890', hasPin: true, isActive: true, createdAt: '', updatedAt: '' },
    { id: 'u2', name: 'Ust. Bilal', whatsapp: '081299998888', hasPin: true, isActive: true, createdAt: '', updatedAt: '' },
  ];
  const periods: Period[] = [
    {
      id: 'p1', name: 'PAS Ganjil', academicYear: '2025/2026', semester: 'Ganjil',
      startDate: '2026-11-01', endDate: '2026-11-20', isActive: true, allowReopen: true, createdAt: '', updatedAt: ''
    },
  ];
  const assignments: Assignment[] = [
    {
      id: 'a1', ustazId: 'u1', ustazName: 'Ust. Hasan', classId: 'c1', className: '1 Ula A',
      subjectId: 's1', subjectName: 'Fiqih', periodId: 'p1', periodName: 'PAS Ganjil',
      status: 'dalam_proses', totalStudents: 10, filledCount: 4, createdAt: '', updatedAt: ''
    },
    {
      id: 'a2', ustazId: 'u2', ustazName: 'Ust. Bilal', classId: 'c1', className: '1 Ula A',
      subjectId: 's2', subjectName: 'Nahwu', periodId: 'p1', periodName: 'PAS Ganjil',
      status: 'terkunci', totalStudents: 10, filledCount: 10, createdAt: '', updatedAt: ''
    },
  ];

  const candidates = identifyUstazNeedingReminder(ustazList, assignments, periods, 'p1', ref);
  assert.equal(candidates[0].needsReminder, true);
  assert.equal(candidates[0].urgency.level, 'due_soon');
  assert.equal(candidates[1].needsReminder, false);

  const msg = buildReminderMessageTemplate({
    ustazName: 'Ust. Hasan',
    schoolName: "MADRASAH DINIYAH MA'HADUL MUTA'ALLIMIN I",
    academicYear: '2025/2026',
    semester: 'Ganjil',
    completedTasks: 0,
    totalTasks: 1,
    pendingAssignments: candidates[0].pendingAssignments,
    deadlineDate: '2026-11-20',
    deadlineLabel: candidates[0].urgency.label,
    tone: 'tenggat',
  });
  assert.match(msg, /mendekati tenggat waktu/);
  assert.match(msg, /Fiqih \(1 Ula A\) — terisi 4\/10 santri/);
  assert.match(msg, /2026-11-20/);
});
