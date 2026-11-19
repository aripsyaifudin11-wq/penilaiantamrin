export type AssignmentStatus = 'belum_mulai' | 'dalam_proses' | 'terkirim' | 'terkunci';
export type Gender = 'L' | 'P';
export type SemesterType = 'Ganjil' | 'Genap';
export type UserRole = 'admin' | 'ustaz';

export interface SchoolSettings {
  schoolName: string;
  address: string;
  logoUrl: string;
  reportHeader: string;
  headmasterName: string;
  headmasterNip: string;
  academicYear: string;
  semester: SemesterType;
  activePeriodId: string;
  allowUstazReopenRequest: boolean;
  updatedAt: string;
}

export interface AdminSecurityConfig {
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  updatedAt: string;
}

export interface Period {
  id: string;
  name: string;
  academicYear: string;
  semester: SemesterType;
  startDate: string;
  endDate: string;
  isActive: boolean;
  allowReopen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  level: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  classIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UstazPublic {
  id: string;
  name: string;
  isActive: boolean;
  linkedUid?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UstazPrivate {
  id: string;
  whatsapp: string;
  pinHash: string;
  pinSalt: string;
  updatedAt: string;
}

export interface UstazCombined extends UstazPublic {
  whatsapp: string;
  hasPin: boolean;
}

export interface Student {
  id: string;
  name: string;
  gender: Gender;
  classId: string;
  className: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  ustazId: string;
  ustazName: string;
  assignedUid?: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  periodId: string;
  periodName: string;
  status: AssignmentStatus;
  totalStudents: number;
  filledCount: number;
  submittedAt?: string | null;
  submittedById?: string | null;
  submittedByName?: string | null;
  unlockedReason?: string | null;
  unlockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GradeRecord {
  studentId: string;
  studentName: string;
  assignmentId: string;
  classId: string;
  subjectId: string;
  periodId: string;
  ustazId: string;
  score: number | null;
  isDraft: boolean;
  isLocked: boolean;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
}

export interface GradeAuditLog {
  id: string;
  action: 'submit' | 'unlock' | 'score_edit' | 'admin_override';
  assignmentId: string;
  studentId?: string | null;
  studentName?: string | null;
  className: string;
  subjectName: string;
  periodName: string;
  oldScore?: number | null;
  newScore?: number | null;
  changedById: string;
  changedByName: string;
  changedByRole: UserRole;
  reason: string;
  createdAt: string;
}

export interface UstazSession {
  ustazId: string;
  ustazName: string;
  verifiedAt: number;
  expiresAt: number;
  deviceToken: string;
}

export interface AdminSession {
  uid: string;
  email: string;
  name: string;
  authMethod: 'google' | 'password';
  mustChangePassword: boolean;
  verifiedAt: number;
}

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export interface NotificationToast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}
