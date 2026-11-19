import { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  History,
  UserCheck,
  Users,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import {
  computeAssignmentPercentage,
  computeClassCompletionData,
  computeOverallStatusBreakdown,
} from '../../utils/grading';
import { AdminProgressCharts } from './AdminProgressCharts';
import type { AppRoute } from '../layout/AppShell';

interface AdminDashboardHomeProps {
  onNavigate?: (route: AppRoute) => void;
}

export function AdminDashboardHome({ onNavigate }: AdminDashboardHomeProps) {
  const {
    students,
    ustazList,
    classes,
    subjects,
    periods,
    assignments,
    auditLogs,
    settings,
  } = usePortal();

  const stats = useMemo(() => {
    const activeStudents = students.filter((s) => s.isActive).length;
    const activeUstaz = ustazList.filter((u) => u.isActive).length;
    const activeClasses = classes.filter((c) => c.isActive).length;
    const activeSubjects = subjects.filter((s) => s.isActive).length;
    const totalTasks = assignments.length;
    const completedTasks = assignments.filter(
      (a) => a.status === 'terkirim' || a.status === 'terkunci'
    ).length;
    const pendingTasks = totalTasks - completedTasks;
    const progressPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return {
      activeStudents,
      activeUstaz,
      activeClasses,
      activeSubjects,
      totalTasks,
      completedTasks,
      pendingTasks,
      progressPct,
    };
  }, [assignments, classes, students, subjects, ustazList]);

  const statusSlices = useMemo(
    () => computeOverallStatusBreakdown(assignments),
    [assignments]
  );

  const classProgress = useMemo(
    () => computeClassCompletionData(classes, assignments),
    [assignments, classes]
  );

  const setupChecklist = useMemo(() => {
    return [
      {
        label: 'Buat Periode Penilaian & Identitas Madrasah',
        done: periods.length > 0,
        route: 'admin-settings' as AppRoute,
      },
      {
        label: 'Tambahkan Daftar Kelas',
        done: classes.length > 0,
        route: 'admin-assignments' as AppRoute,
      },
      {
        label: 'Tambahkan Mata Pelajaran',
        done: subjects.length > 0,
        route: 'admin-subjects' as AppRoute,
      },
      {
        label: 'Tambahkan Data Santri (Manual / XLSX)',
        done: students.length > 0,
        route: 'admin-students' as AppRoute,
      },
      {
        label: 'Daftarkan Ustaz & PIN Akses',
        done: ustazList.length > 0,
        route: 'admin-ustaz' as AppRoute,
      },
      {
        label: 'Petakan Tugas Penilaian Ustaz',
        done: assignments.length > 0,
        route: 'admin-assignments' as AppRoute,
      },
    ];
  }, [assignments.length, classes.length, periods.length, students.length, subjects.length, ustazList.length]);

  const needsSetup = setupChecklist.some((item) => !item.done);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-800">{settings.schoolName}</p>
          <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
            Dashboard Administrasi Penilaian
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Tahun Pelajaran {settings.academicYear} · Semester {settings.semester}
        </p>
      </div>

      {/* 4 Primary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600">Total Santri Aktif</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0F7F4] border border-emerald-200/70 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-emerald-800" />
            </div>
          </div>
          <p className="font-display text-3xl font-bold text-slate-900 tabular-nums">{stats.activeStudents}</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600">Total Ustaz Aktif</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0F7F4] border border-emerald-200/70 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-emerald-800" />
            </div>
          </div>
          <p className="font-display text-3xl font-bold text-slate-900 tabular-nums">{stats.activeUstaz}</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600">Kelas &amp; Mapel</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0F7F4] border border-emerald-200/70 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-emerald-800" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 tabular-nums">
            <p className="font-display text-3xl font-bold text-slate-900">{stats.activeClasses}</p>
            <span className="text-sm text-slate-500">kelas · {stats.activeSubjects} mapel</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600">Progres Tugas Selesai</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0F7F4] border border-emerald-200/70 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-emerald-800" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 tabular-nums">
            <p className="font-display text-3xl font-bold text-emerald-800">{stats.progressPct}%</p>
            <span className="text-sm text-slate-500">
              {stats.completedTasks}/{stats.totalTasks} tugas
            </span>
          </div>
        </div>
      </section>

      {/* Initial Setup Guide (only shown when portal has incomplete master data) */}
      {needsSetup && (
        <section className="bg-white border border-emerald-200/90 rounded-2xl p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Panduan Penyiapan Data Awal Madrasah
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Lengkapi data berikut secara berurutan agar ustaz dapat mulai menginput nilai santri.
              </p>
            </div>
            <span className="text-sm font-semibold text-emerald-800 tabular-nums">
              {setupChecklist.filter((i) => i.done).length}/{setupChecklist.length} langkah selesai
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {setupChecklist.map((step, index) => (
              <button
                key={step.label}
                type="button"
                onClick={() => onNavigate?.(step.route)}
                className={`text-left p-4 rounded-xl border transition-colors flex items-center justify-between gap-3 min-h-[56px] ${
                  step.done
                    ? 'bg-[#F0F7F4] border-emerald-200 text-emerald-950'
                    : 'bg-slate-50/70 border-slate-200 hover:border-emerald-400 hover:bg-white text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-center tabular-nums shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <span className="text-sm font-semibold leading-snug">{step.label}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Real-time Recharts Visual Analytics */}
      <AdminProgressCharts
        statusSlices={statusSlices}
        classData={classProgress}
        totalTasks={stats.totalTasks}
        overallPercentage={stats.progressPct}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rincian Pengisian Tugas Terbaru */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Rincian Progres per Tugas
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Daftar mata pelajaran beserta progres pengisian nilai santri saat ini.
              </p>
            </div>
            <BookOpen className="w-5 h-5 text-emerald-700 shrink-0 mt-1" />
          </div>

          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              Belum ada pemetaan tugas penilaian yang aktif.
            </p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {assignments.slice(0, 8).map((a) => {
                const fillPct = computeAssignmentPercentage(a.filledCount, a.totalStudents);
                return (
                  <div
                    key={a.id}
                    className="space-y-1.5 py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-800 truncate">
                        {a.className} · {a.subjectName}
                        <span className="font-normal text-slate-500"> ({a.ustazName})</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-800 tabular-nums shrink-0">
                        {a.filledCount}/{a.totalStudents} ({fillPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full transition-all duration-300"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Ringkasan Aktivitas Terbaru */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Ringkasan Aktivitas Terbaru
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Catatan pengiriman nilai, pembukaan ulang, dan koreksi nilai.
              </p>
            </div>
            <History className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              Belum ada aktivitas penilaian yang tercatat.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-900">
                      {log.action === 'submit'
                        ? 'Pengiriman Nilai'
                        : log.action === 'unlock'
                        ? 'Pembukaan Kunci Tugas'
                        : 'Perubahan Nilai'}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">
                    {log.className} · {log.subjectName} — oleh <span className="font-medium">{log.changedByName}</span>
                  </p>
                  <p className="text-xs text-slate-500">{log.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
