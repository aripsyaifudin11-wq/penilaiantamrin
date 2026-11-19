import type { Assignment, Gender } from '../types/portal';

// Synchronized verbatim with firebase-blueprint.json
export const BLUEPRINT_LIMITS = {
  SCHOOL_NAME_MIN: 2,
  SCHOOL_NAME_MAX: 150,
  ADDRESS_MAX: 300,
  LOGO_URL_MAX: 2000,
  REPORT_HEADER_MAX: 400,
  HEADMASTER_NAME_MAX: 120,
  HEADMASTER_NIP_MAX: 50,
  ACADEMIC_YEAR_MAX: 20,
  PERIOD_NAME_MIN: 2,
  PERIOD_NAME_MAX: 120,
  CLASS_NAME_MIN: 1,
  CLASS_NAME_MAX: 60,
  SUBJECT_NAME_MIN: 1,
  SUBJECT_NAME_MAX: 100,
  SUBJECT_CLASSES_MAX: 50,
  USTAZ_NAME_MIN: 2,
  USTAZ_NAME_MAX: 120,
  WHATSAPP_MAX: 30,
  STUDENT_NAME_MIN: 2,
  STUDENT_NAME_MAX: 120,
  REASON_MIN: 3,
  REASON_MAX: 300,
  ID_MAX: 128,
} as const;

export const BLUEPRINT_PATTERNS = {
  ID: /^[a-zA-Z0-9_-]+$/,
  ACADEMIC_YEAR: /^[0-9]{4}\/[0-9]{4}$/,
  ISO_DATE: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  PIN: /^[0-9]{4,8}$/,
} as const;

export interface ScoreValidationResult {
  valid: boolean;
  score: number | null;
  error?: string;
}

export function parseScoreInput(raw: string): ScoreValidationResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, score: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, score: null, error: 'Nilai harus berupa angka bulat 0–100.' };
  }
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 0 || num > 100) {
    return { valid: false, score: null, error: 'Rentang nilai hanya boleh antara 0 sampai 100.' };
  }
  return { valid: true, score: num };
}

export function isValidDocumentId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_LIMITS.ID_MAX &&
    BLUEPRINT_PATTERNS.ID.test(id)
  );
}

export function makeSafeDocId(prefix: string, rawSeed: string): string {
  const slug = rawSeed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${slug || 'item'}_${rand}`.slice(0, BLUEPRINT_LIMITS.ID_MAX);
}

export function makeAssignmentId(periodId: string, classId: string, subjectId: string): string {
  return `${periodId}__${classId}__${subjectId}`.slice(0, BLUEPRINT_LIMITS.ID_MAX);
}

export function hasDuplicateAssignment(
  assignments: Pick<Assignment, 'periodId' | 'classId' | 'subjectId' | 'id'>[],
  periodId: string,
  classId: string,
  subjectId: string,
  excludeId?: string
): boolean {
  return assignments.some(
    (a) =>
      a.id !== excludeId &&
      a.periodId === periodId &&
      a.classId === classId &&
      a.subjectId === subjectId
  );
}

export function sanitizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function buildWhatsappReminderUrl(phoneRaw: string, message: string): string {
  const normalized = sanitizeWhatsappNumber(phoneRaw);
  const encodedText = encodeURIComponent(message.trim());
  if (!normalized) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${normalized}?text=${encodedText}`;
}

export type ReminderTone = 'ramah' | 'tenggat' | 'mendesak';

export interface ReminderTemplateParams {
  ustazName: string;
  schoolName: string;
  academicYear: string;
  semester: string;
  completedTasks: number;
  totalTasks: number;
  pendingAssignments: Pick<Assignment, 'subjectName' | 'className' | 'filledCount' | 'totalStudents'>[];
  deadlineDate?: string;
  deadlineLabel?: string;
  tone?: ReminderTone;
}

export function buildReminderMessageTemplate({
  ustazName,
  schoolName,
  academicYear,
  semester,
  completedTasks,
  totalTasks,
  pendingAssignments,
  deadlineDate,
  deadlineLabel,
  tone = 'ramah',
}: ReminderTemplateParams): string {
  const pendingLines = pendingAssignments
    .map((a) => `- ${a.subjectName} (${a.className}) — terisi ${a.filledCount}/${a.totalStudents} santri`)
    .join('\n');

  const deadlineInfo = deadlineDate
    ? `Batas akhir pengisian: ${deadlineDate}${deadlineLabel ? ` — ${deadlineLabel}` : ''}.`
    : '';

  if (tone === 'tenggat') {
    return (
      `Assalamu'alaikum ${ustazName},\n` +
      `Mengingatkan dengan hormat bahwa periode penilaian di ${schoolName} (${academicYear} Semester ${semester}) sudah mendekati tenggat waktu.\n` +
      (deadlineInfo ? `${deadlineInfo}\n` : '') +
      `Progres saat ini: ${completedTasks}/${totalTasks} tugas selesai.\n` +
      (pendingLines ? `Daftar tugas yang masih perlu dilengkapi:\n${pendingLines}\n` : '') +
      `Mohon kesediaannya untuk segera menyelesaikan dan mengirim nilai di Portal Penilaian. Jazakumullahu khairan.`
    );
  }

  if (tone === 'mendesak') {
    return (
      `Assalamu'alaikum ${ustazName},\n` +
      `Mohon perhatian segera terkait pengisian nilai santri di Portal Penilaian ${schoolName} (${academicYear} Semester ${semester}) untuk proses rekapitulasi rapor.\n` +
      (deadlineInfo ? `${deadlineInfo}\n` : '') +
      `Status saat ini: ${completedTasks}/${totalTasks} tugas selesai.\n` +
      (pendingLines ? `Tugas yang belum terkirim:\n${pendingLines}\n` : '') +
      `Silakan masuk ke Portal Penilaian dengan PIN Anda dan klik "SELESAI & KIRIM NILAI" jika sudah lengkap. Jazakumullahu khairan.`
    );
  }

  return (
    `Assalamu'alaikum ${ustazName},\n` +
    `Mohon kesediaannya untuk melengkapi input nilai di Portal Penilaian ${schoolName} (${academicYear} Semester ${semester}).\n` +
    (deadlineInfo ? `${deadlineInfo}\n` : '') +
    `Saat ini progres Anda ${completedTasks}/${totalTasks} tugas selesai.\n` +
    (pendingLines ? `Tugas yang belum selesai:\n${pendingLines}\n` : '') +
    `Jazakumullahu khairan.`
  );
}

export interface StudentImportValidation {
  rowNumber: number;
  name: string;
  gender: Gender | null;
  className: string;
  classId: string | null;
  errors: string[];
  isValid: boolean;
  isDuplicate?: boolean;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function validateStudentImportRow(
  rowNumber: number,
  rawName: unknown,
  rawGender: unknown,
  rawClassName: unknown,
  availableClasses: { id: string; name: string }[]
): StudentImportValidation {
  const errors: string[] = [];
  const name = normalizeText(rawName);
  const genderStr = normalizeText(rawGender).toUpperCase();
  const className = normalizeText(rawClassName);

  if (name.length < BLUEPRINT_LIMITS.STUDENT_NAME_MIN || name.length > BLUEPRINT_LIMITS.STUDENT_NAME_MAX) {
    errors.push('Nama santri harus 2–120 karakter');
  }

  let gender: Gender | null = null;
  if (genderStr === 'L' || genderStr === 'LAKI-LAKI' || genderStr === 'LAKI LAKI' || genderStr === 'LK' || genderStr === 'PUTRA') {
    gender = 'L';
  } else if (genderStr === 'P' || genderStr === 'PEREMPUAN' || genderStr === 'PR' || genderStr === 'PUTRI') {
    gender = 'P';
  } else {
    errors.push('Jenis kelamin wajib L atau P');
  }

  const matchedClass = availableClasses.find(
    (c) => normalizeText(c.name).toLowerCase() === className.toLowerCase()
  );
  if (!className) {
    errors.push('Kelas wajib diisi');
  } else if (!matchedClass) {
    errors.push(`Kelas "${className}" tidak ditemukan`);
  }

  return {
    rowNumber,
    name,
    gender,
    className: matchedClass ? matchedClass.name : className,
    classId: matchedClass ? matchedClass.id : null,
    errors,
    isValid: errors.length === 0,
  };
}

export function validateStudentSheetRows(
  rows: Record<string, unknown>[],
  availableClasses: { id: string; name: string }[],
  existingStudents: { name: string; classId: string }[] = []
): StudentImportValidation[] {
  const existingSet = new Set(
    existingStudents.map((s) => `${normalizeText(s.name).toLowerCase()}::${s.classId}`)
  );
  const seenInSheet = new Set<string>();
  const results: StudentImportValidation[] = [];

  rows.forEach((row, idx) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().replace(/\s+/g, ' ').toLowerCase()] = v;
    }

    const rawName =
      normalized['nama santri'] ??
      normalized['nama lengkap'] ??
      normalized['nama siswa'] ??
      normalized['nama'] ??
      normalized['name'] ??
      '';
    const rawGender =
      normalized['jenis kelamin (l/p)'] ??
      normalized['jenis kelamin'] ??
      normalized['kelamin'] ??
      normalized['jk'] ??
      normalized['gender'] ??
      normalized['l/p'] ??
      '';
    const rawClass =
      normalized['kelas'] ??
      normalized['nama kelas'] ??
      normalized['rombel'] ??
      normalized['class'] ??
      '';

    // Skip completely blank trailing rows in Excel sheets
    if (
      normalizeText(rawName) === '' &&
      normalizeText(rawGender) === '' &&
      normalizeText(rawClass) === ''
    ) {
      return;
    }

    const validated = validateStudentImportRow(idx + 2, rawName, rawGender, rawClass, availableClasses);
    if (validated.isValid && validated.classId) {
      const key = `${validated.name.toLowerCase()}::${validated.classId}`;
      if (existingSet.has(key) || seenInSheet.has(key)) {
        validated.isDuplicate = true;
      }
      seenInSheet.add(key);
    }
    results.push(validated);
  });

  return results;
}

export interface UstazImportValidation {
  rowNumber: number;
  name: string;
  whatsapp: string;
  pin: string;
  isActive: boolean;
  errors: string[];
  isValid: boolean;
}

export function validateUstazImportRow(
  rowNumber: number,
  rawName: unknown,
  rawWhatsapp: unknown,
  rawPin: unknown,
  rawStatus: unknown
): UstazImportValidation {
  const errors: string[] = [];
  const name = String(rawName ?? '').trim();
  const whatsapp = String(rawWhatsapp ?? '').trim();
  const pin = String(rawPin ?? '').trim();
  const statusStr = String(rawStatus ?? 'Aktif').trim().toLowerCase();

  if (name.length < BLUEPRINT_LIMITS.USTAZ_NAME_MIN || name.length > BLUEPRINT_LIMITS.USTAZ_NAME_MAX) {
    errors.push('Nama ustaz harus 2–120 karakter');
  }
  if (whatsapp.length > BLUEPRINT_LIMITS.WHATSAPP_MAX) {
    errors.push('Nomor WhatsApp maksimal 30 karakter');
  }
  if (!BLUEPRINT_PATTERNS.PIN.test(pin)) {
    errors.push('PIN harus 4–8 digit angka');
  }
  const isActive =
    statusStr === '' ||
    statusStr === 'aktif' ||
    statusStr === 'active' ||
    statusStr === '1' ||
    statusStr === 'ya';

  return {
    rowNumber,
    name,
    whatsapp,
    pin,
    isActive,
    errors,
    isValid: errors.length === 0,
  };
}
