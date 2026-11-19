import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isFirebaseConfigured,
  OperationType,
  storage,
  testConnection,
} from '../lib/firebase';
import {
  createEmptyWorkspace,
  DEFAULT_SCHOOL_SETTINGS,
  type WorkspaceDataset,
} from '../data/workspaceDefaults';
import type {
  AdminSecurityConfig,
  AdminSession,
  Assignment,
  ClassRoom,
  Gender,
  GradeAuditLog,
  GradeRecord,
  NotificationToast,
  Period,
  SchoolSettings,
  Student,
  Subject,
  SyncState,
  UstazCombined,
  UstazSession,
} from '../types/portal';
import {
  generateSalt,
  hashSecret,
  INITIAL_ADMIN_HASH,
  INITIAL_ADMIN_SALT,
  verifySecret,
} from '../utils/crypto';
import {
  hasDuplicateAssignment,
  makeAssignmentId,
  makeSafeDocId,
} from '../utils/validation';

const LEGACY_DUMMY_STORAGE_KEY = 'madin_mm1_preview_sandbox_v1';
const LOCAL_WORKSPACE_STORAGE_KEY = 'madin_mm1_local_workspace_v2';
const USTAZ_SESSION_KEY = 'madin_mm1_ustaz_session_v1';
const ADMIN_SESSION_KEY = 'madin_mm1_admin_session_v1';

function toIso(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

interface PortalContextValue {
  firebaseReady: boolean;
  connectionChecked: boolean;
  connectionError: string | null;
  authUser: User | null;
  isLiveFirestore: boolean;
  isLoadingData: boolean;
  syncState: SyncState;
  isOnline: boolean;

  settings: SchoolSettings;
  adminSecurity: AdminSecurityConfig;
  periods: Period[];
  classes: ClassRoom[];
  subjects: Subject[];
  ustazList: UstazCombined[];
  students: Student[];
  assignments: Assignment[];
  gradesByAssignmentId: Record<string, GradeRecord[]>;
  auditLogs: GradeAuditLog[];

  ustazSession: UstazSession | null;
  adminSession: AdminSession | null;
  toasts: NotificationToast[];
  notify: (type: NotificationToast['type'], title: string, message?: string) => void;
  dismissToast: (id: string) => void;

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  verifyUstazPin: (ustazId: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  logoutUstaz: () => void;
  loginAdminWithPassword: (password: string) => Promise<{ ok: boolean; mustChange?: boolean; error?: string }>;
  changeAdminPassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logoutAdmin: () => void;

  // Grading Actions
  loadGradesForAssignment: (assignmentId: string) => Promise<GradeRecord[]>;
  saveDraftScore: (params: {
    assignment: Assignment;
    student: Student;
    score: number | null;
    allStudents: Student[];
  }) => Promise<void>;
  submitAssignmentFinal: (params: {
    assignment: Assignment;
    students: Student[];
    scoresByStudentId: Record<string, number | null>;
  }) => Promise<{ ok: boolean; error?: string }>;

  // Admin Actions
  saveSettings: (next: Partial<SchoolSettings>) => Promise<void>;
  uploadLogoFile: (file: File) => Promise<string>;
  createPeriod: (data: Omit<Period, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePeriod: (id: string, data: Partial<Period>) => Promise<void>;
  createClassRoom: (data: { name: string; level: string; orderIndex: number }) => Promise<void>;
  updateClassRoom: (id: string, data: Partial<ClassRoom>) => Promise<void>;
  deleteClassRoom: (id: string) => Promise<void>;

  createStudent: (data: { name: string; gender: Gender; classId: string }) => Promise<void>;
  updateStudent: (id: string, data: { name: string; gender: Gender; classId: string; isActive: boolean }) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  importStudentsBatch: (rows: { name: string; gender: Gender; classId: string; className: string }[]) => Promise<number>;

  createUstaz: (data: { name: string; whatsapp: string; pin: string; isActive: boolean }) => Promise<void>;
  updateUstaz: (id: string, data: { name: string; whatsapp: string; pin?: string; isActive: boolean }) => Promise<void>;
  deleteUstaz: (id: string) => Promise<void>;
  importUstazBatch: (rows: { name: string; whatsapp: string; pin: string; isActive: boolean }[]) => Promise<number>;

  createSubject: (data: { name: string; classIds: string[]; isActive: boolean }) => Promise<void>;
  updateSubject: (id: string, data: { name: string; classIds: string[]; isActive: boolean }) => Promise<void>;
  deleteSubject: (id: string) => Promise<{ ok: boolean; error?: string }>;

  createAssignment: (data: { ustazId: string; classId: string; subjectId: string; periodId: string }) => Promise<{ ok: boolean; error?: string }>;
  deleteAssignment: (id: string) => Promise<void>;
  unlockAssignment: (assignmentId: string, reason: string) => Promise<void>;
  adminUpdateGrade: (params: {
    assignment: Assignment;
    student: Student;
    oldScore: number | null;
    newScore: number;
    reason: string;
  }) => Promise<void>;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const firebaseReady = isFirebaseConfigured();
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Local Workspace State (starts clean without dummy data when authUser === null)
  const [previewData, setPreviewData] = useState<WorkspaceDataset | null>(null);

  // Live Firestore State (used when authUser !== null)
  const [liveSettings, setLiveSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [liveAdminSecurity, setLiveAdminSecurity] = useState<AdminSecurityConfig>({
    passwordHash: INITIAL_ADMIN_HASH,
    passwordSalt: INITIAL_ADMIN_SALT,
    mustChangePassword: true,
    updatedAt: '',
  });
  const [livePeriods, setLivePeriods] = useState<Period[]>([]);
  const [liveClasses, setLiveClasses] = useState<ClassRoom[]>([]);
  const [liveSubjects, setLiveSubjects] = useState<Subject[]>([]);
  const [liveUstazPublic, setLiveUstazPublic] = useState<Record<string, { name: string; isActive: boolean; linkedUid?: string; createdAt: string; updatedAt: string }>>({});
  const [liveUstazPrivate, setLiveUstazPrivate] = useState<Record<string, { whatsapp: string; pinHash: string; pinSalt: string; updatedAt: string }>>({});
  const [liveStudents, setLiveStudents] = useState<Student[]>([]);
  const [liveAssignments, setLiveAssignments] = useState<Assignment[]>([]);
  const [liveGradesByAssignment, setLiveGradesByAssignment] = useState<Record<string, GradeRecord[]>>({});
  const [liveAuditLogs, setLiveAuditLogs] = useState<GradeAuditLog[]>([]);

  const [ustazSession, setUstazSession] = useState<UstazSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(USTAZ_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as UstazSession;
      if (parsed.expiresAt > Date.now()) return parsed;
      sessionStorage.removeItem(USTAZ_SESSION_KEY);
      return null;
    } catch {
      return null;
    }
  });

  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      return raw ? (JSON.parse(raw) as AdminSession) : null;
    } catch {
      return null;
    }
  });

  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const submittingLockRef = useRef<Record<string, boolean>>({});

  const notify = useCallback(
    (type: NotificationToast['type'], title: string, message?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setSyncState((prev) => (prev === 'offline' ? 'saved' : prev));
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Boot testConnection() + Auth listener
  useEffect(() => {
    let active = true;
    async function init() {
      if (!firebaseReady) {
        setConnectionChecked(true);
        setConnectionError('Konfigurasi Firebase belum tersedia.');
        setIsLoadingData(false);
        return;
      }
      const res = await testConnection();
      if (!active) return;
      setConnectionChecked(true);
      if (!res.ok && res.error?.includes('the client is offline')) {
        setConnectionError('Tidak dapat terhubung ke server Firestore. Periksa konfigurasi Firebase.');
      } else {
        setConnectionError(null);
      }
    }
    init();

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        try {
          sessionStorage.removeItem(LEGACY_DUMMY_STORAGE_KEY);
          const cached = sessionStorage.getItem(LOCAL_WORKSPACE_STORAGE_KEY);
          if (cached) {
            setPreviewData(JSON.parse(cached) as WorkspaceDataset);
          } else {
            const emptyWorkspace = createEmptyWorkspace();
            sessionStorage.setItem(LOCAL_WORKSPACE_STORAGE_KEY, JSON.stringify(emptyWorkspace));
            setPreviewData(emptyWorkspace);
          }
        } catch {
          setPreviewData(createEmptyWorkspace());
        }
        setIsLoadingData(false);
      }
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, [firebaseReady]);

  const updatePreview = useCallback((updater: (prev: WorkspaceDataset) => WorkspaceDataset) => {
    setPreviewData((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      try {
        sessionStorage.setItem(LOCAL_WORKSPACE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota warnings
      }
      return next;
    });
  }, []);

  const isLiveFirestore = Boolean(firebaseReady && authUser);

  // Live Firestore subscriptions ONLY when authenticated
  useEffect(() => {
    if (!isLiveFirestore || !authUser) return;
    setIsLoadingData(true);

    // Ensure singleton public settings & admin security exist if admin logs in first time
    const ensureDefaults = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'public');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          await setDoc(settingsRef, {
            schoolName: DEFAULT_SCHOOL_SETTINGS.schoolName,
            address: DEFAULT_SCHOOL_SETTINGS.address,
            logoUrl: DEFAULT_SCHOOL_SETTINGS.logoUrl,
            reportHeader: DEFAULT_SCHOOL_SETTINGS.reportHeader,
            headmasterName: DEFAULT_SCHOOL_SETTINGS.headmasterName,
            headmasterNip: DEFAULT_SCHOOL_SETTINGS.headmasterNip,
            academicYear: DEFAULT_SCHOOL_SETTINGS.academicYear,
            semester: DEFAULT_SCHOOL_SETTINGS.semester,
            activePeriodId: '',
            allowUstazReopenRequest: true,
            updatedAt: serverTimestamp(),
          });
        }
        const secRef = doc(db, 'admin_security', 'config');
        const secSnap = await getDoc(secRef);
        if (!secSnap.exists()) {
          await setDoc(secRef, {
            passwordHash: INITIAL_ADMIN_HASH,
            passwordSalt: INITIAL_ADMIN_SALT,
            mustChangePassword: true,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-admin user cannot create settings/admin_security; that's expected
      }
    };
    ensureDefaults();

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'public'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setLiveSettings({
              schoolName: d.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName,
              address: d.address || '',
              logoUrl: d.logoUrl || DEFAULT_SCHOOL_SETTINGS.logoUrl,
              reportHeader: d.reportHeader || '',
              headmasterName: d.headmasterName || '',
              headmasterNip: d.headmasterNip || '',
              academicYear: d.academicYear || '2025/2026',
              semester: d.semester === 'Genap' ? 'Genap' : 'Ganjil',
              activePeriodId: d.activePeriodId || '',
              allowUstazReopenRequest: Boolean(d.allowUstazReopenRequest),
              updatedAt: toIso(d.updatedAt),
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'settings/public')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'admin_security', 'config'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setLiveAdminSecurity({
              passwordHash: d.passwordHash,
              passwordSalt: d.passwordSalt,
              mustChangePassword: Boolean(d.mustChangePassword),
              updatedAt: toIso(d.updatedAt),
            });
          }
        },
        () => {
          // Ignore for non-admins
        }
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'periods'),
        (snap) => {
          setLivePeriods(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name,
                academicYear: d.academicYear,
                semester: d.semester,
                startDate: d.startDate,
                endDate: d.endDate,
                isActive: Boolean(d.isActive),
                allowReopen: Boolean(d.allowReopen),
                createdAt: toIso(d.createdAt),
                updatedAt: toIso(d.updatedAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'periods')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'classes'),
        (snap) => {
          setLiveClasses(
            snap.docs
              .map((docSnap) => {
                const d = docSnap.data();
                return {
                  id: docSnap.id,
                  name: d.name,
                  level: d.level || '',
                  orderIndex: Number(d.orderIndex ?? 0),
                  isActive: Boolean(d.isActive),
                  createdAt: toIso(d.createdAt),
                  updatedAt: toIso(d.updatedAt),
                };
              })
              .sort((a, b) => a.orderIndex - b.orderIndex)
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'subjects'),
        (snap) => {
          setLiveSubjects(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name,
                classIds: Array.isArray(d.classIds) ? d.classIds : [],
                isActive: Boolean(d.isActive),
                createdAt: toIso(d.createdAt),
                updatedAt: toIso(d.updatedAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'subjects')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'ustaz_public'),
        (snap) => {
          const map: Record<string, { name: string; isActive: boolean; linkedUid?: string; createdAt: string; updatedAt: string }> = {};
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            map[docSnap.id] = {
              name: d.name,
              isActive: Boolean(d.isActive),
              linkedUid: d.linkedUid || '',
              createdAt: toIso(d.createdAt),
              updatedAt: toIso(d.updatedAt),
            };
          });
          setLiveUstazPublic(map);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'ustaz_public')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'ustaz_private'),
        (snap) => {
          const map: Record<string, { whatsapp: string; pinHash: string; pinSalt: string; updatedAt: string }> = {};
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            map[docSnap.id] = {
              whatsapp: d.whatsapp || '',
              pinHash: d.pinHash || '',
              pinSalt: d.pinSalt || '',
              updatedAt: toIso(d.updatedAt),
            };
          });
          setLiveUstazPrivate(map);
        },
        () => {
          // Non-admin does not read ustaz_private
        }
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'students'),
        (snap) => {
          setLiveStudents(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name,
                gender: d.gender === 'P' ? 'P' : 'L',
                classId: d.classId,
                className: d.className,
                isActive: Boolean(d.isActive),
                createdAt: toIso(d.createdAt),
                updatedAt: toIso(d.updatedAt),
              };
            })
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'assignments'),
        (snap) => {
          setLiveAssignments(
            snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                ustazId: d.ustazId,
                ustazName: d.ustazName,
                assignedUid: d.assignedUid || '',
                classId: d.classId,
                className: d.className,
                subjectId: d.subjectId,
                subjectName: d.subjectName,
                periodId: d.periodId,
                periodName: d.periodName,
                status: d.status,
                totalStudents: Number(d.totalStudents ?? 0),
                filledCount: Number(d.filledCount ?? 0),
                submittedAt: d.submittedAt ? toIso(d.submittedAt) : null,
                submittedById: d.submittedById || null,
                submittedByName: d.submittedByName || null,
                unlockedReason: d.unlockedReason || null,
                unlockedAt: d.unlockedAt ? toIso(d.unlockedAt) : null,
                createdAt: toIso(d.createdAt),
                updatedAt: toIso(d.updatedAt),
              };
            })
          );
          setIsLoadingData(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'assignments')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'grade_audit_logs'),
        (snap) => {
          setLiveAuditLogs(
            snap.docs
              .map((docSnap) => {
                const d = docSnap.data();
                return {
                  id: docSnap.id,
                  action: d.action,
                  assignmentId: d.assignmentId,
                  studentId: d.studentId || null,
                  studentName: d.studentName || null,
                  className: d.className,
                  subjectName: d.subjectName,
                  periodName: d.periodName,
                  oldScore: d.oldScore ?? null,
                  newScore: d.newScore ?? null,
                  changedById: d.changedById,
                  changedByName: d.changedByName,
                  changedByRole: d.changedByRole,
                  reason: d.reason,
                  createdAt: toIso(d.createdAt),
                };
              })
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          );
        },
        () => {
          // Non-admin does not list audit logs
        }
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [isLiveFirestore, authUser]);

  // Derived unified state
  const settings = isLiveFirestore
    ? liveSettings
    : previewData?.settings || DEFAULT_SCHOOL_SETTINGS;
  const adminSecurity = isLiveFirestore
    ? liveAdminSecurity
    : previewData?.adminSecurity || {
        passwordHash: INITIAL_ADMIN_HASH,
        passwordSalt: INITIAL_ADMIN_SALT,
        mustChangePassword: true,
        updatedAt: '',
      };
  const periods = isLiveFirestore ? livePeriods : previewData?.periods || [];
  const classes = isLiveFirestore ? liveClasses : previewData?.classes || [];
  const subjects = isLiveFirestore ? liveSubjects : previewData?.subjects || [];
  const ustazList: UstazCombined[] = useMemo(() => {
    if (!isLiveFirestore) {
      return (previewData?.ustazList || []).map(({ pinHash: _ph, pinSalt: _ps, ...rest }) => rest);
    }
    return Object.entries(liveUstazPublic).map(([id, pub]) => {
      const priv = liveUstazPrivate[id];
      return {
        id,
        name: pub.name,
        isActive: pub.isActive,
        linkedUid: pub.linkedUid,
        whatsapp: priv?.whatsapp || '',
        hasPin: Boolean(priv?.pinHash),
        createdAt: pub.createdAt,
        updatedAt: pub.updatedAt,
      };
    });
  }, [isLiveFirestore, previewData, liveUstazPublic, liveUstazPrivate]);

  const students = isLiveFirestore ? liveStudents : previewData?.students || [];
  const assignments = isLiveFirestore ? liveAssignments : previewData?.assignments || [];
  const gradesByAssignmentId = isLiveFirestore
    ? liveGradesByAssignment
    : previewData?.gradesByAssignmentId || {};
  const auditLogs = isLiveFirestore ? liveAuditLogs : previewData?.auditLogs || [];

  // ==================== AUTH ACTIONS ====================
  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const session: AdminSession = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || user.email || 'Administrator',
        authMethod: 'google',
        mustChangePassword: false,
        verifiedAt: Date.now(),
      };
      setAdminSession(session);
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      notify('success', 'Terhubung ke Cloud Firestore', `Masuk sebagai ${session.email}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal masuk dengan Google';
      notify('error', 'Login Google Gagal', msg);
    }
  }, [notify]);

  const logoutGoogle = useCallback(async () => {
    await signOut(auth);
    setAdminSession(null);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    notify('info', 'Keluar dari sesi Google Firebase');
  }, [notify]);

  const verifyUstazPin = useCallback(
    async (ustazId: string, pin: string): Promise<{ ok: boolean; error?: string }> => {
      const cleanPin = pin.trim();
      if (!cleanPin) {
        return { ok: false, error: 'PIN akses wajib diisi.' };
      }
      if (!isLiveFirestore) {
        const target = previewData?.ustazList.find((u) => u.id === ustazId);
        if (!target) return { ok: false, error: 'Data ustaz tidak ditemukan.' };
        if (!target.isActive) return { ok: false, error: 'Akun ustaz sedang dinonaktifkan oleh admin.' };
        const matched = await verifySecret(cleanPin, target.pinSalt, target.pinHash);
        if (!matched) return { ok: false, error: 'PIN akses tidak sesuai. Silakan coba lagi.' };
        const session: UstazSession = {
          ustazId: target.id,
          ustazName: target.name,
          verifiedAt: Date.now(),
          expiresAt: Date.now() + 12 * 60 * 60 * 1000,
          deviceToken: makeSafeDocId('sess', target.id),
        };
        setUstazSession(session);
        sessionStorage.setItem(USTAZ_SESSION_KEY, JSON.stringify(session));
        return { ok: true };
      }

      const pub = liveUstazPublic[ustazId];
      const priv = liveUstazPrivate[ustazId];
      if (!pub || !priv) {
        return { ok: false, error: 'Data PIN ustaz tidak tersedia untuk akun ini.' };
      }
      if (!pub.isActive) {
        return { ok: false, error: 'Akun ustaz sedang dinonaktifkan oleh admin.' };
      }
      const matched = await verifySecret(cleanPin, priv.pinSalt, priv.pinHash);
      if (!matched) {
        return { ok: false, error: 'PIN akses tidak sesuai.' };
      }
      const session: UstazSession = {
        ustazId,
        ustazName: pub.name,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
        deviceToken: makeSafeDocId('sess', ustazId),
      };
      setUstazSession(session);
      sessionStorage.setItem(USTAZ_SESSION_KEY, JSON.stringify(session));
      return { ok: true };
    },
    [isLiveFirestore, previewData, liveUstazPublic, liveUstazPrivate]
  );

  const logoutUstaz = useCallback(() => {
    setUstazSession(null);
    sessionStorage.removeItem(USTAZ_SESSION_KEY);
  }, []);

  const loginAdminWithPassword = useCallback(
    async (password: string): Promise<{ ok: boolean; mustChange?: boolean; error?: string }> => {
      const trimmed = password.trim();
      if (!trimmed) {
        return { ok: false, error: 'Password wajib diisi.' };
      }
      const matched = await verifySecret(
        trimmed,
        adminSecurity.passwordSalt,
        adminSecurity.passwordHash
      );
      if (!matched) {
        return { ok: false, error: 'Password admin tidak sesuai.' };
      }
      const session: AdminSession = {
        uid: authUser?.uid || 'admin_local_session',
        email: authUser?.email || 'admin@madrasah.local',
        name: authUser?.displayName || 'Administrator Madrasah',
        authMethod: authUser ? 'google' : 'password',
        mustChangePassword: adminSecurity.mustChangePassword,
        verifiedAt: Date.now(),
      };
      setAdminSession(session);
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      return { ok: true, mustChange: adminSecurity.mustChangePassword };
    },
    [adminSecurity, authUser]
  );

  const changeAdminPassword = useCallback(
    async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = newPassword.trim();
      if (trimmed.length < 6) {
        return { ok: false, error: 'Password baru minimal 6 karakter.' };
      }
      const isSameAsDefault = await verifySecret(
        trimmed,
        INITIAL_ADMIN_SALT,
        INITIAL_ADMIN_HASH
      );
      if (isSameAsDefault) {
        return { ok: false, error: 'Password baru tidak boleh sama dengan password awal instalasi.' };
      }
      const salt = generateSalt();
      const hash = await hashSecret(trimmed, salt);

      if (isLiveFirestore) {
        try {
          await setDoc(doc(db, 'admin_security', 'config'), {
            passwordHash: hash,
            passwordSalt: salt,
            mustChangePassword: false,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'admin_security/config');
        }
      } else {
        updatePreview((prev) => ({
          ...prev,
          adminSecurity: {
            passwordHash: hash,
            passwordSalt: salt,
            mustChangePassword: false,
            updatedAt: new Date().toISOString(),
          },
        }));
      }

      setAdminSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, mustChangePassword: false };
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(next));
        return next;
      });
      notify('success', 'Password Admin Diperbarui', 'Password baru telah tersimpan aman.');
      return { ok: true };
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const logoutAdmin = useCallback(() => {
    setAdminSession(null);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }, []);

  // ==================== GRADING ACTIONS ====================
  const loadGradesForAssignment = useCallback(
    async (assignmentId: string): Promise<GradeRecord[]> => {
      if (!isLiveFirestore) {
        return previewData?.gradesByAssignmentId[assignmentId] || [];
      }
      const path = `assignments/${assignmentId}/grades`;
      try {
        const snap = await getDocs(collection(db, 'assignments', assignmentId, 'grades'));
        const list: GradeRecord[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            studentId: d.studentId,
            studentName: d.studentName,
            assignmentId: d.assignmentId,
            classId: d.classId,
            subjectId: d.subjectId,
            periodId: d.periodId,
            ustazId: d.ustazId,
            score: d.score ?? null,
            isDraft: Boolean(d.isDraft),
            isLocked: Boolean(d.isLocked),
            updatedAt: toIso(d.updatedAt),
            updatedById: d.updatedById,
            updatedByName: d.updatedByName,
          };
        });
        setLiveGradesByAssignment((prev) => ({ ...prev, [assignmentId]: list }));
        return list;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    },
    [isLiveFirestore, previewData]
  );

  const saveDraftScore = useCallback(
    async ({
      assignment,
      student,
      score,
      allStudents,
    }: {
      assignment: Assignment;
      student: Student;
      score: number | null;
      allStudents: Student[];
    }) => {
      if (assignment.status === 'terkunci' || assignment.status === 'terkirim') {
        return;
      }
      setSyncState(isOnline ? 'saving' : 'offline');

      const existingGrades = gradesByAssignmentId[assignment.id] || [];
      const mergedMap: Record<string, number | null> = {};
      existingGrades.forEach((g) => {
        mergedMap[g.studentId] = g.score;
      });
      mergedMap[student.id] = score;

      const filledCount = allStudents.filter((s) => {
        const val = mergedMap[s.id];
        return val !== null && val !== undefined;
      }).length;

      const nextStatus = filledCount > 0 ? 'dalam_proses' : 'belum_mulai';

      if (!isLiveFirestore) {
        const now = new Date().toISOString();
        const actorId = ustazSession?.ustazId || assignment.ustazId;
        const actorName = ustazSession?.ustazName || assignment.ustazName;

        updatePreview((prev) => {
          const prevGrades = prev.gradesByAssignmentId[assignment.id] || [];
          const idx = prevGrades.findIndex((g) => g.studentId === student.id);
          const nextRecord: GradeRecord = {
            studentId: student.id,
            studentName: student.name,
            assignmentId: assignment.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            periodId: assignment.periodId,
            ustazId: assignment.ustazId,
            score,
            isDraft: true,
            isLocked: false,
            updatedAt: now,
            updatedById: actorId,
            updatedByName: actorName,
          };
          const nextGrades =
            idx >= 0
              ? prevGrades.map((g, i) => (i === idx ? nextRecord : g))
              : [...prevGrades, nextRecord];

          return {
            ...prev,
            gradesByAssignmentId: {
              ...prev.gradesByAssignmentId,
              [assignment.id]: nextGrades,
            },
            assignments: prev.assignments.map((a) =>
              a.id === assignment.id
                ? {
                    ...a,
                    status: nextStatus,
                    totalStudents: allStudents.length,
                    filledCount,
                    updatedAt: now,
                  }
                : a
            ),
          };
        });
        setSyncState(isOnline ? 'saved' : 'offline');
        return;
      }

      const actorUid = authUser?.uid || ustazSession?.ustazId || assignment.ustazId;
      const actorName = ustazSession?.ustazName || authUser?.displayName || assignment.ustazName;
      const gradeRef = doc(db, 'assignments', assignment.id, 'grades', student.id);
      const assignmentRef = doc(db, 'assignments', assignment.id);

      try {
        const batch = writeBatch(db);
        batch.set(gradeRef, {
          studentId: student.id,
          studentName: student.name,
          assignmentId: assignment.id,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          periodId: assignment.periodId,
          ustazId: assignment.ustazId,
          assignedUid: assignment.assignedUid || actorUid,
          score,
          isDraft: true,
          isLocked: false,
          updatedAt: serverTimestamp(),
          updatedById: actorUid,
          updatedByName: actorName,
        });
        batch.update(assignmentRef, {
          status: nextStatus,
          filledCount,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        setSyncState(isOnline ? 'saved' : 'offline');
      } catch (err) {
        setSyncState(isOnline ? 'error' : 'offline');
        handleFirestoreError(err, OperationType.WRITE, `assignments/${assignment.id}/grades/${student.id}`);
      }
    },
    [authUser, gradesByAssignmentId, isLiveFirestore, isOnline, updatePreview, ustazSession]
  );

  const submitAssignmentFinal = useCallback(
    async ({
      assignment,
      students: classStudents,
      scoresByStudentId,
    }: {
      assignment: Assignment;
      students: Student[];
      scoresByStudentId: Record<string, number | null>;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (submittingLockRef.current[assignment.id]) {
        return { ok: false, error: 'Pengiriman sedang diproses.' };
      }
      if (assignment.status === 'terkunci' || assignment.status === 'terkirim') {
        return { ok: false, error: 'Tugas ini sudah terkirim dan terkunci.' };
      }
      if (classStudents.length === 0) {
        return { ok: false, error: 'Tidak ada santri aktif pada kelas ini.' };
      }

      for (const s of classStudents) {
        const val = scoresByStudentId[s.id];
        if (val === null || val === undefined || Number.isNaN(val) || val < 0 || val > 100) {
          return {
            ok: false,
            error: `Nilai santri "${s.name}" belum valid atau masih kosong (harus 0–100).`,
          };
        }
      }

      submittingLockRef.current[assignment.id] = true;
      setSyncState('saving');

      try {
        if (!isLiveFirestore) {
          const now = new Date().toISOString();
          const actorId = ustazSession?.ustazId || assignment.ustazId;
          const actorName = ustazSession?.ustazName || assignment.ustazName;

          const finalGrades: GradeRecord[] = classStudents.map((s) => ({
            studentId: s.id,
            studentName: s.name,
            assignmentId: assignment.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            periodId: assignment.periodId,
            ustazId: assignment.ustazId,
            score: scoresByStudentId[s.id]!,
            isDraft: false,
            isLocked: true,
            updatedAt: now,
            updatedById: actorId,
            updatedByName: actorName,
          }));

          const logItem: GradeAuditLog = {
            id: makeSafeDocId('log', assignment.id),
            action: 'submit',
            assignmentId: assignment.id,
            className: assignment.className,
            subjectName: assignment.subjectName,
            periodName: assignment.periodName,
            changedById: actorId,
            changedByName: actorName,
            changedByRole: 'ustaz',
            reason: 'Pengiriman nilai final oleh ustaz pengampu',
            createdAt: now,
          };

          updatePreview((prev) => ({
            ...prev,
            gradesByAssignmentId: {
              ...prev.gradesByAssignmentId,
              [assignment.id]: finalGrades,
            },
            assignments: prev.assignments.map((a) =>
              a.id === assignment.id
                ? {
                    ...a,
                    status: 'terkunci',
                    totalStudents: classStudents.length,
                    filledCount: classStudents.length,
                    submittedAt: now,
                    submittedById: actorId,
                    submittedByName: actorName,
                    updatedAt: now,
                  }
                : a
            ),
            auditLogs: [logItem, ...prev.auditLogs],
          }));
          setSyncState('saved');
          notify(
            'success',
            'Nilai Berhasil Dikirim & Dikunci',
            `${assignment.subjectName} — ${assignment.className} telah tersimpan.`
          );
          return { ok: true };
        }

        const actorUid = authUser?.uid || ustazSession?.ustazId || assignment.ustazId;
        const actorName = ustazSession?.ustazName || authUser?.displayName || assignment.ustazName;

        const batch = writeBatch(db);
        for (const s of classStudents) {
          const gradeRef = doc(db, 'assignments', assignment.id, 'grades', s.id);
          batch.set(gradeRef, {
            studentId: s.id,
            studentName: s.name,
            assignmentId: assignment.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            periodId: assignment.periodId,
            ustazId: assignment.ustazId,
            assignedUid: assignment.assignedUid || actorUid,
            score: scoresByStudentId[s.id]!,
            isDraft: false,
            isLocked: true,
            updatedAt: serverTimestamp(),
            updatedById: actorUid,
            updatedByName: actorName,
          });
        }

        const assignmentRef = doc(db, 'assignments', assignment.id);
        batch.update(assignmentRef, {
          status: 'terkunci',
          filledCount: classStudents.length,
          submittedAt: serverTimestamp(),
          submittedById: actorUid,
          submittedByName: actorName,
          updatedAt: serverTimestamp(),
        });

        const logId = makeSafeDocId('log', assignment.id);
        batch.set(doc(db, 'grade_audit_logs', logId), {
          action: 'submit',
          assignmentId: assignment.id,
          studentId: null,
          studentName: null,
          className: assignment.className,
          subjectName: assignment.subjectName,
          periodName: assignment.periodName,
          oldScore: null,
          newScore: null,
          changedById: actorUid,
          changedByName: actorName,
          changedByRole: 'ustaz',
          reason: 'Pengiriman nilai final oleh ustaz pengampu',
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        setSyncState('saved');
        notify(
          'success',
          'Nilai Berhasil Dikirim & Dikunci',
          `${assignment.subjectName} — ${assignment.className} telah tersimpan.`
        );
        return { ok: true };
      } catch (err) {
        setSyncState('error');
        const msg = err instanceof Error ? err.message : 'Gagal mengirim nilai ke server.';
        notify('error', 'Pengiriman Gagal', 'Koneksi atau izin bermasalah. Status tugas tetap aman.');
        return { ok: false, error: msg };
      } finally {
        submittingLockRef.current[assignment.id] = false;
      }
    },
    [authUser, isLiveFirestore, notify, updatePreview, ustazSession]
  );

  // ==================== ADMIN CRUD ACTIONS ====================
  const saveSettings = useCallback(
    async (next: Partial<SchoolSettings>) => {
      const merged: SchoolSettings = {
        ...settings,
        ...next,
        updatedAt: new Date().toISOString(),
      };
      if (!isLiveFirestore) {
        updatePreview((prev) => ({ ...prev, settings: merged }));
        notify('success', 'Pengaturan Disimpan');
        return;
      }
      try {
        await setDoc(doc(db, 'settings', 'public'), {
          schoolName: merged.schoolName,
          address: merged.address,
          logoUrl: merged.logoUrl,
          reportHeader: merged.reportHeader,
          headmasterName: merged.headmasterName,
          headmasterNip: merged.headmasterNip,
          academicYear: merged.academicYear,
          semester: merged.semester,
          activePeriodId: merged.activePeriodId,
          allowUstazReopenRequest: merged.allowUstazReopenRequest,
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Pengaturan Disimpan ke Firestore');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'settings/public');
      }
    },
    [isLiveFirestore, notify, settings, updatePreview]
  );

  const uploadLogoFile = useCallback(
    async (file: File): Promise<string> => {
      if (!isLiveFirestore) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Gagal membaca file logo'));
          reader.readAsDataURL(file);
        });
      }
      const logoRef = ref(storage, `madrasah/logo_${Date.now()}_${file.name}`);
      await uploadBytes(logoRef, file);
      return getDownloadURL(logoRef);
    },
    [isLiveFirestore]
  );

  const createPeriod = useCallback(
    async (data: Omit<Period, 'id' | 'createdAt' | 'updatedAt'>) => {
      const id = makeSafeDocId('per', data.name);
      const now = new Date().toISOString();
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          periods: [
            ...prev.periods.map((p) => (data.isActive ? { ...p, isActive: false } : p)),
            { ...data, id, createdAt: now, updatedAt: now },
          ],
          settings: data.isActive ? { ...prev.settings, activePeriodId: id } : prev.settings,
        }));
        notify('success', 'Periode Penilaian Ditambahkan');
        return;
      }
      try {
        await setDoc(doc(db, 'periods', id), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Periode Penilaian Ditambahkan');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `periods/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const updatePeriod = useCallback(
    async (id: string, data: Partial<Period>) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          periods: prev.periods.map((p) => {
            if (p.id === id) return { ...p, ...data, updatedAt: new Date().toISOString() };
            if (data.isActive) return { ...p, isActive: false };
            return p;
          }),
          settings: data.isActive ? { ...prev.settings, activePeriodId: id } : prev.settings,
        }));
        notify('success', 'Periode Penilaian Diperbarui');
        return;
      }
      try {
        await updateDoc(doc(db, 'periods', id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Periode Penilaian Diperbarui');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `periods/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const createClassRoom = useCallback(
    async (data: { name: string; level: string; orderIndex: number }) => {
      const id = makeSafeDocId('cls', data.name);
      const now = new Date().toISOString();
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          classes: [
            ...prev.classes,
            { id, name: data.name, level: data.level, orderIndex: data.orderIndex, isActive: true, createdAt: now, updatedAt: now },
          ],
        }));
        notify('success', 'Kelas Ditambahkan', data.name);
        return;
      }
      try {
        await setDoc(doc(db, 'classes', id), {
          name: data.name,
          level: data.level,
          orderIndex: data.orderIndex,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Kelas Ditambahkan', data.name);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `classes/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const updateClassRoom = useCallback(
    async (id: string, data: Partial<ClassRoom>) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          classes: prev.classes.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c)),
        }));
        notify('success', 'Kelas Diperbarui');
        return;
      }
      try {
        await updateDoc(doc(db, 'classes', id), { ...data, updatedAt: serverTimestamp() });
        notify('success', 'Kelas Diperbarui');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `classes/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const deleteClassRoom = useCallback(
    async (id: string) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({ ...prev, classes: prev.classes.filter((c) => c.id !== id) }));
        notify('success', 'Kelas Dihapus');
        return;
      }
      try {
        await deleteDoc(doc(db, 'classes', id));
        notify('success', 'Kelas Dihapus');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `classes/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const createStudent = useCallback(
    async (data: { name: string; gender: Gender; classId: string }) => {
      const cls = classes.find((c) => c.id === data.classId);
      if (!cls) throw new Error('Kelas tidak ditemukan');
      const id = makeSafeDocId('std', data.name);
      const now = new Date().toISOString();

      if (!isLiveFirestore) {
        updatePreview((prev) => {
          const nextStudents = [
            ...prev.students,
            {
              id,
              name: data.name.trim(),
              gender: data.gender,
              classId: cls.id,
              className: cls.name,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
          ];
          const classCount = nextStudents.filter((s) => s.classId === cls.id && s.isActive).length;
          return {
            ...prev,
            students: nextStudents,
            assignments: prev.assignments.map((a) =>
              a.classId === cls.id ? { ...a, totalStudents: classCount } : a
            ),
          };
        });
        notify('success', 'Santri Ditambahkan', data.name);
        return;
      }

      try {
        await setDoc(doc(db, 'students', id), {
          name: data.name.trim(),
          gender: data.gender,
          classId: cls.id,
          className: cls.name,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Santri Ditambahkan', data.name);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `students/${id}`);
      }
    },
    [classes, isLiveFirestore, notify, updatePreview]
  );

  const updateStudent = useCallback(
    async (id: string, data: { name: string; gender: Gender; classId: string; isActive: boolean }) => {
      const cls = classes.find((c) => c.id === data.classId);
      if (!cls) throw new Error('Kelas tidak ditemukan');
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          students: prev.students.map((s) =>
            s.id === id
              ? {
                  ...s,
                  name: data.name.trim(),
                  gender: data.gender,
                  classId: cls.id,
                  className: cls.name,
                  isActive: data.isActive,
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));
        notify('success', 'Data Santri Diperbarui');
        return;
      }
      try {
        await updateDoc(doc(db, 'students', id), {
          name: data.name.trim(),
          gender: data.gender,
          classId: cls.id,
          className: cls.name,
          isActive: data.isActive,
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Data Santri Diperbarui');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `students/${id}`);
      }
    },
    [classes, isLiveFirestore, notify, updatePreview]
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          students: prev.students.filter((s) => s.id !== id),
        }));
        notify('success', 'Santri Dihapus');
        return;
      }
      try {
        await deleteDoc(doc(db, 'students', id));
        notify('success', 'Santri Dihapus');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const importStudentsBatch = useCallback(
    async (rows: { name: string; gender: Gender; classId: string; className: string }[]) => {
      if (rows.length === 0) return 0;
      const now = new Date().toISOString();
      if (!isLiveFirestore) {
        const added: Student[] = rows.map((r) => ({
          id: makeSafeDocId('std', r.name),
          name: r.name,
          gender: r.gender,
          classId: r.classId,
          className: r.className,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }));
        updatePreview((prev) => {
          const allStudents = [...prev.students, ...added];
          return {
            ...prev,
            students: allStudents,
            assignments: prev.assignments.map((a) => ({
              ...a,
              totalStudents: allStudents.filter((s) => s.classId === a.classId && s.isActive).length,
            })),
          };
        });
        notify('success', 'Import Santri Berhasil', `${rows.length} santri ditambahkan.`);
        return rows.length;
      }

      try {
        const CHUNK_SIZE = 450;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const r of chunk) {
            const safeName = r.name.trim().slice(0, 120);
            const safeClassName = r.className.trim().slice(0, 60);
            if (safeName.length < 2 || (r.gender !== 'L' && r.gender !== 'P') || !r.classId) {
              continue;
            }
            const id = makeSafeDocId('std', safeName);
            batch.set(doc(db, 'students', id), {
              name: safeName,
              gender: r.gender,
              classId: r.classId,
              className: safeClassName,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
        notify('success', 'Import Santri Berhasil', `${rows.length} santri ditambahkan ke Firestore.`);
        return rows.length;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'students');
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const createUstaz = useCallback(
    async (data: { name: string; whatsapp: string; pin: string; isActive: boolean }) => {
      const id = makeSafeDocId('ust', data.name);
      const pinSalt = generateSalt();
      const pinHash = await hashSecret(data.pin.trim(), pinSalt);
      const now = new Date().toISOString();

      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          ustazList: [
            ...prev.ustazList,
            {
              id,
              name: data.name.trim(),
              whatsapp: data.whatsapp.trim(),
              hasPin: true,
              pinHash,
              pinSalt,
              isActive: data.isActive,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        notify('success', 'Ustaz Ditambahkan', data.name);
        return;
      }

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'ustaz_public', id), {
          name: data.name.trim(),
          isActive: data.isActive,
          linkedUid: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'ustaz_private', id), {
          whatsapp: data.whatsapp.trim(),
          pinHash,
          pinSalt,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        notify('success', 'Ustaz Ditambahkan', data.name);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `ustaz_public/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const updateUstaz = useCallback(
    async (id: string, data: { name: string; whatsapp: string; pin?: string; isActive: boolean }) => {
      const newPinTrimmed = data.pin?.trim();
      const newSalt = newPinTrimmed ? generateSalt() : null;
      const newHash = newPinTrimmed && newSalt ? await hashSecret(newPinTrimmed, newSalt) : null;

      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          ustazList: prev.ustazList.map((u) =>
            u.id === id
              ? {
                  ...u,
                  name: data.name.trim(),
                  whatsapp: data.whatsapp.trim(),
                  isActive: data.isActive,
                  pinSalt: newSalt || u.pinSalt,
                  pinHash: newHash || u.pinHash,
                  updatedAt: new Date().toISOString(),
                }
              : u
          ),
          assignments: prev.assignments.map((a) =>
            a.ustazId === id ? { ...a, ustazName: data.name.trim() } : a
          ),
        }));
        notify('success', 'Data Ustaz Diperbarui');
        return;
      }

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'ustaz_public', id), {
          name: data.name.trim(),
          isActive: data.isActive,
          updatedAt: serverTimestamp(),
        });
        const existingPriv = liveUstazPrivate[id];
        batch.set(doc(db, 'ustaz_private', id), {
          whatsapp: data.whatsapp.trim(),
          pinSalt: newSalt || existingPriv?.pinSalt || generateSalt(),
          pinHash: newHash || existingPriv?.pinHash || INITIAL_ADMIN_HASH,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        notify('success', 'Data Ustaz Diperbarui');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `ustaz_public/${id}`);
      }
    },
    [isLiveFirestore, liveUstazPrivate, notify, updatePreview]
  );

  const deleteUstaz = useCallback(
    async (id: string) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          ustazList: prev.ustazList.filter((u) => u.id !== id),
        }));
        notify('success', 'Ustaz Dihapus');
        return;
      }
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'ustaz_public', id));
        batch.delete(doc(db, 'ustaz_private', id));
        await batch.commit();
        notify('success', 'Ustaz Dihapus');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `ustaz_public/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const importUstazBatch = useCallback(
    async (rows: { name: string; whatsapp: string; pin: string; isActive: boolean }[]) => {
      if (rows.length === 0) return 0;
      const now = new Date().toISOString();
      const prepared = await Promise.all(
        rows.map(async (r) => {
          const pinSalt = generateSalt();
          const pinHash = await hashSecret(r.pin, pinSalt);
          return {
            id: makeSafeDocId('ust', r.name),
            ...r,
            pinSalt,
            pinHash,
          };
        })
      );

      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          ustazList: [
            ...prev.ustazList,
            ...prepared.map((p) => ({
              id: p.id,
              name: p.name,
              whatsapp: p.whatsapp,
              hasPin: true,
              pinHash: p.pinHash,
              pinSalt: p.pinSalt,
              isActive: p.isActive,
              createdAt: now,
              updatedAt: now,
            })),
          ],
        }));
        notify('success', 'Import Ustaz Berhasil', `${prepared.length} ustaz ditambahkan.`);
        return prepared.length;
      }

      try {
        const batch = writeBatch(db);
        for (const p of prepared) {
          batch.set(doc(db, 'ustaz_public', p.id), {
            name: p.name,
            isActive: p.isActive,
            linkedUid: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'ustaz_private', p.id), {
            whatsapp: p.whatsapp,
            pinHash: p.pinHash,
            pinSalt: p.pinSalt,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        notify('success', 'Import Ustaz Berhasil', `${prepared.length} ustaz ditambahkan.`);
        return prepared.length;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'ustaz_public');
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const createSubject = useCallback(
    async (data: { name: string; classIds: string[]; isActive: boolean }) => {
      const id = makeSafeDocId('sub', data.name);
      const now = new Date().toISOString();
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          subjects: [
            ...prev.subjects,
            { id, name: data.name.trim(), classIds: data.classIds, isActive: data.isActive, createdAt: now, updatedAt: now },
          ],
        }));
        notify('success', 'Mata Pelajaran Ditambahkan', data.name);
        return;
      }
      try {
        await setDoc(doc(db, 'subjects', id), {
          name: data.name.trim(),
          classIds: data.classIds,
          isActive: data.isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Mata Pelajaran Ditambahkan', data.name);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `subjects/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const updateSubject = useCallback(
    async (id: string, data: { name: string; classIds: string[]; isActive: boolean }) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          subjects: prev.subjects.map((s) =>
            s.id === id
              ? { ...s, name: data.name.trim(), classIds: data.classIds, isActive: data.isActive, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
        notify('success', 'Mata Pelajaran Diperbarui');
        return;
      }
      try {
        await updateDoc(doc(db, 'subjects', id), {
          name: data.name.trim(),
          classIds: data.classIds,
          isActive: data.isActive,
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Mata Pelajaran Diperbarui');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `subjects/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const deleteSubject = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const hasHistory = assignments.some((a) => a.subjectId === id && (a.filledCount > 0 || a.status !== 'belum_mulai'));
      if (hasHistory) {
        return {
          ok: false,
          error: 'Mata pelajaran sudah memiliki riwayat penilaian sehingga tidak dapat dihapus. Anda dapat menonaktifkannya.',
        };
      }
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          subjects: prev.subjects.filter((s) => s.id !== id),
        }));
        notify('success', 'Mata Pelajaran Dihapus');
        return { ok: true };
      }
      try {
        await deleteDoc(doc(db, 'subjects', id));
        notify('success', 'Mata Pelajaran Dihapus');
        return { ok: true };
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `subjects/${id}`);
      }
    },
    [assignments, isLiveFirestore, notify, updatePreview]
  );

  const createAssignment = useCallback(
    async (data: {
      ustazId: string;
      classId: string;
      subjectId: string;
      periodId: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (hasDuplicateAssignment(assignments, data.periodId, data.classId, data.subjectId)) {
        return {
          ok: false,
          error: 'Kombinasi Kelas, Mata Pelajaran, dan Periode tersebut sudah memiliki tugas pengampu.',
        };
      }

      const ustaz = ustazList.find((u) => u.id === data.ustazId);
      const cls = classes.find((c) => c.id === data.classId);
      const sub = subjects.find((s) => s.id === data.subjectId);
      const per = periods.find((p) => p.id === data.periodId);

      if (!ustaz || !cls || !sub || !per) {
        return { ok: false, error: 'Data ustaz, kelas, mata pelajaran, atau periode tidak valid.' };
      }

      const id = makeAssignmentId(per.id, cls.id, sub.id);
      const totalStudents = students.filter((s) => s.classId === cls.id && s.isActive).length;
      const now = new Date().toISOString();

      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          assignments: [
            ...prev.assignments,
            {
              id,
              ustazId: ustaz.id,
              ustazName: ustaz.name,
              classId: cls.id,
              className: cls.name,
              subjectId: sub.id,
              subjectName: sub.name,
              periodId: per.id,
              periodName: per.name,
              status: 'belum_mulai',
              totalStudents,
              filledCount: 0,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        notify('success', 'Pemetaan Tugas Dibuat', `${ustaz.name} · ${sub.name} (${cls.name})`);
        return { ok: true };
      }

      try {
        await setDoc(doc(db, 'assignments', id), {
          ustazId: ustaz.id,
          ustazName: ustaz.name,
          assignedUid: ustaz.linkedUid || '',
          classId: cls.id,
          className: cls.name,
          subjectId: sub.id,
          subjectName: sub.name,
          periodId: per.id,
          periodName: per.name,
          status: 'belum_mulai',
          totalStudents,
          filledCount: 0,
          submittedAt: null,
          submittedById: null,
          submittedByName: null,
          unlockedReason: null,
          unlockedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('success', 'Pemetaan Tugas Dibuat', `${ustaz.name} · ${sub.name} (${cls.name})`);
        return { ok: true };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `assignments/${id}`);
      }
    },
    [assignments, classes, isLiveFirestore, notify, periods, students, subjects, updatePreview, ustazList]
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      if (!isLiveFirestore) {
        updatePreview((prev) => ({
          ...prev,
          assignments: prev.assignments.filter((a) => a.id !== id),
        }));
        notify('success', 'Pemetaan Tugas Dihapus');
        return;
      }
      try {
        await deleteDoc(doc(db, 'assignments', id));
        notify('success', 'Pemetaan Tugas Dihapus');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `assignments/${id}`);
      }
    },
    [isLiveFirestore, notify, updatePreview]
  );

  const unlockAssignment = useCallback(
    async (assignmentId: string, reason: string) => {
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) return;
      const cleanReason = reason.trim();
      const actorId = adminSession?.uid || 'admin';
      const actorName = adminSession?.name || 'Administrator';
      const now = new Date().toISOString();

      if (!isLiveFirestore) {
        updatePreview((prev) => {
          const grades = prev.gradesByAssignmentId[assignmentId] || [];
          return {
            ...prev,
            assignments: prev.assignments.map((a) =>
              a.id === assignmentId
                ? {
                    ...a,
                    status: a.filledCount > 0 ? 'dalam_proses' : 'belum_mulai',
                    unlockedReason: cleanReason,
                    unlockedAt: now,
                    updatedAt: now,
                  }
                : a
            ),
            gradesByAssignmentId: {
              ...prev.gradesByAssignmentId,
              [assignmentId]: grades.map((g) => ({ ...g, isLocked: false })),
            },
            auditLogs: [
              {
                id: makeSafeDocId('log', assignmentId),
                action: 'unlock',
                assignmentId,
                className: assignment.className,
                subjectName: assignment.subjectName,
                periodName: assignment.periodName,
                changedById: actorId,
                changedByName: actorName,
                changedByRole: 'admin',
                reason: cleanReason,
                createdAt: now,
              },
              ...prev.auditLogs,
            ],
          };
        });
        notify('success', 'Tugas Dibuka Kembali', `${assignment.subjectName} (${assignment.className}) dapat diisi ulang.`);
        return;
      }

      try {
        const gradesSnap = await getDocs(collection(db, 'assignments', assignmentId, 'grades'));
        const batch = writeBatch(db);
        gradesSnap.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { isLocked: false, updatedAt: serverTimestamp() });
        });
        batch.update(doc(db, 'assignments', assignmentId), {
          status: assignment.filledCount > 0 ? 'dalam_proses' : 'belum_mulai',
          unlockedReason: cleanReason,
          unlockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const logId = makeSafeDocId('log', assignmentId);
        batch.set(doc(db, 'grade_audit_logs', logId), {
          action: 'unlock',
          assignmentId,
          studentId: null,
          studentName: null,
          className: assignment.className,
          subjectName: assignment.subjectName,
          periodName: assignment.periodName,
          oldScore: null,
          newScore: null,
          changedById: actorId,
          changedByName: actorName,
          changedByRole: 'admin',
          reason: cleanReason,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        notify('success', 'Tugas Dibuka Kembali', `${assignment.subjectName} (${assignment.className}) dapat diisi ulang.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `assignments/${assignmentId}`);
      }
    },
    [adminSession, assignments, isLiveFirestore, notify, updatePreview]
  );

  const adminUpdateGrade = useCallback(
    async ({
      assignment,
      student,
      oldScore,
      newScore,
      reason,
    }: {
      assignment: Assignment;
      student: Student;
      oldScore: number | null;
      newScore: number;
      reason: string;
    }) => {
      const actorId = adminSession?.uid || 'admin';
      const actorName = adminSession?.name || 'Administrator';
      const now = new Date().toISOString();

      if (!isLiveFirestore) {
        updatePreview((prev) => {
          const grades = prev.gradesByAssignmentId[assignment.id] || [];
          const exists = grades.some((g) => g.studentId === student.id);
          const nextRecord: GradeRecord = {
            studentId: student.id,
            studentName: student.name,
            assignmentId: assignment.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            periodId: assignment.periodId,
            ustazId: assignment.ustazId,
            score: newScore,
            isDraft: false,
            isLocked: assignment.status === 'terkunci',
            updatedAt: now,
            updatedById: actorId,
            updatedByName: actorName,
          };
          const nextGrades = exists
            ? grades.map((g) => (g.studentId === student.id ? nextRecord : g))
            : [...grades, nextRecord];

          return {
            ...prev,
            gradesByAssignmentId: {
              ...prev.gradesByAssignmentId,
              [assignment.id]: nextGrades,
            },
            auditLogs: [
              {
                id: makeSafeDocId('log', student.id),
                action: 'score_edit',
                assignmentId: assignment.id,
                studentId: student.id,
                studentName: student.name,
                className: assignment.className,
                subjectName: assignment.subjectName,
                periodName: assignment.periodName,
                oldScore,
                newScore,
                changedById: actorId,
                changedByName: actorName,
                changedByRole: 'admin',
                reason,
                createdAt: now,
              },
              ...prev.auditLogs,
            ],
          };
        });
        notify('success', 'Nilai Diperbarui & Tercatat di Audit Log');
        return;
      }

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'assignments', assignment.id, 'grades', student.id), {
          studentId: student.id,
          studentName: student.name,
          assignmentId: assignment.id,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          periodId: assignment.periodId,
          ustazId: assignment.ustazId,
          assignedUid: assignment.assignedUid || '',
          score: newScore,
          isDraft: false,
          isLocked: assignment.status === 'terkunci',
          updatedAt: serverTimestamp(),
          updatedById: actorId,
          updatedByName: actorName,
        });
        const logId = makeSafeDocId('log', student.id);
        batch.set(doc(db, 'grade_audit_logs', logId), {
          action: 'score_edit',
          assignmentId: assignment.id,
          studentId: student.id,
          studentName: student.name,
          className: assignment.className,
          subjectName: assignment.subjectName,
          periodName: assignment.periodName,
          oldScore,
          newScore,
          changedById: actorId,
          changedByName: actorName,
          changedByRole: 'admin',
          reason,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        notify('success', 'Nilai Diperbarui & Tercatat di Audit Log');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `assignments/${assignment.id}/grades/${student.id}`);
      }
    },
    [adminSession, isLiveFirestore, notify, updatePreview]
  );

  // Preload grades when assignments change in live Firestore for Admin Recap Matrix
  useEffect(() => {
    if (!isLiveFirestore || !adminSession || assignments.length === 0) return;
    assignments.forEach((a) => {
      if (!liveGradesByAssignment[a.id]) {
        loadGradesForAssignment(a.id).catch(() => {});
      }
    });
  }, [adminSession, assignments, isLiveFirestore, liveGradesByAssignment, loadGradesForAssignment]);

  const value: PortalContextValue = {
    firebaseReady,
    connectionChecked,
    connectionError,
    authUser,
    isLiveFirestore,
    isLoadingData,
    syncState,
    isOnline,
    settings,
    adminSecurity,
    periods,
    classes,
    subjects,
    ustazList,
    students,
    assignments,
    gradesByAssignmentId,
    auditLogs,
    ustazSession,
    adminSession,
    toasts,
    notify,
    dismissToast,
    loginWithGoogle,
    logoutGoogle,
    verifyUstazPin,
    logoutUstaz,
    loginAdminWithPassword,
    changeAdminPassword,
    logoutAdmin,
    loadGradesForAssignment,
    saveDraftScore,
    submitAssignmentFinal,
    saveSettings,
    uploadLogoFile,
    createPeriod,
    updatePeriod,
    createClassRoom,
    updateClassRoom,
    deleteClassRoom,
    createStudent,
    updateStudent,
    deleteStudent,
    importStudentsBatch,
    createUstaz,
    updateUstaz,
    deleteUstaz,
    importUstazBatch,
    createSubject,
    updateSubject,
    deleteSubject,
    createAssignment,
    deleteAssignment,
    unlockAssignment,
    adminUpdateGrade,
  };

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error('usePortal must be used inside PortalProvider');
  }
  return ctx;
}
