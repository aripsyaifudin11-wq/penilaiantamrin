import type {
  Assignment,
  ClassRoom,
  GradeAuditLog,
  GradeRecord,
  Period,
  SchoolSettings,
  Student,
  Subject,
  UstazCombined,
} from '../types/portal';
import { INITIAL_ADMIN_HASH, INITIAL_ADMIN_SALT } from '../utils/crypto';

export interface WorkspaceDataset {
  settings: SchoolSettings;
  adminSecurity: {
    passwordHash: string;
    passwordSalt: string;
    mustChangePassword: boolean;
    updatedAt: string;
  };
  periods: Period[];
  classes: ClassRoom[];
  subjects: Subject[];
  ustazList: (UstazCombined & { pinHash: string; pinSalt: string })[];
  students: Student[];
  assignments: Assignment[];
  gradesByAssignmentId: Record<string, GradeRecord[]>;
  auditLogs: GradeAuditLog[];
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: "MADRASAH DINIYAH MA'HADUL MUTA'ALLIMIN I",
  address: '',
  logoUrl: '/src/assets/images/madrasah_emblem_logo_1795054724183.jpg',
  reportHeader: 'LEMBAGA PENDIDIKAN ISLAM · PENILAIAN RESMI SEMESTER',
  headmasterName: '',
  headmasterNip: '',
  academicYear: '2025/2026',
  semester: 'Ganjil',
  activePeriodId: '',
  allowUstazReopenRequest: true,
  updatedAt: '',
};

export function createEmptyWorkspace(): WorkspaceDataset {
  return {
    settings: {
      ...DEFAULT_SCHOOL_SETTINGS,
      updatedAt: new Date().toISOString(),
    },
    adminSecurity: {
      passwordHash: INITIAL_ADMIN_HASH,
      passwordSalt: INITIAL_ADMIN_SALT,
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    },
    periods: [],
    classes: [],
    subjects: [],
    ustazList: [],
    students: [],
    assignments: [],
    gradesByAssignmentId: {},
    auditLogs: [],
  };
}
