import { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  LogOut,
  Users,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import type { Assignment } from '../../types/portal';
import {
  computeAssignmentPercentage,
  computeUstazProgress,
  getStatusLabel,
} from '../../utils/grading';

interface UstazDashboardProps {
  onSelectAssignment: (assignment: Assignment) => void;
  onBackHome: () => void;
}

export function UstazDashboard({
  onSelectAssignment,
  onBackHome,
}: UstazDashboardProps) {
  const { ustazSession, assignments, students, logoutUstaz } = usePortal();

  const myAssignments = useMemo(() => {
    if (!ustazSession) return [];
    return assignments
      .filter((a) => a.ustazId === ustazSession.ustazId)
      .sort((a, b) => a.className.localeCompare(b.className, 'id'));
  }, [assignments, ustazSession]);

  const progress = useMemo(() => {
    if (!ustazSession) {
      return { totalTasks: 0, completedTasks: 0, pendingTasks: 0, percentage: 0 };
    }
    return computeUstazProgress(ustazSession.ustazId, assignments);
  }, [assignments, ustazSession]);

  if (!ustazSession) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs">
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">Sesi Belum Aktif</h1>
        <p className="text-base text-slate-600 mb-6">
          Silakan pilih nama ustaz dan masukkan PIN akses terlebih dahulu.
        </p>
        <button
          type="button"
          onClick={onBackHome}
          className="min-h-[52px] px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-base"
        >
          Kembali ke Halaman Utama
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header & Progress Summary Panel */}
      <section className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="bg-[#064E3B] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#F1D98A]">Dashboard Penilaian Ustaz</p>
            <h1 className="font-display text-2xl sm:text-[30px] font-bold text-white mt-1 tracking-tight">
              {ustazSession.ustazName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[48px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Halaman Utama</span>
            </button>
            <button
              type="button"
              onClick={() => {
                logoutUstaz();
                onBackHome();
              }}
              className="min-h-[48px] px-4 rounded-xl bg-red-950/50 hover:bg-red-900/70 border border-red-300/30 text-red-100 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Single-Elevation Hairline 3-Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 border-b border-slate-200/80">
          <div className="p-5 sm:p-6">
            <p className="text-sm font-medium text-slate-500">Total Kelas &amp; Tugas</p>
            <p className="font-display text-3xl font-bold text-slate-900 tabular-nums mt-1">
              {progress.totalTasks}
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-sm font-medium text-emerald-800">Tugas Selesai</p>
            <p className="font-display text-3xl font-bold text-emerald-800 tabular-nums mt-1">
              {progress.completedTasks}
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-sm font-medium text-amber-800">Belum Selesai</p>
            <p className="font-display text-3xl font-bold text-amber-700 tabular-nums mt-1">
              {progress.pendingTasks}
            </p>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="p-5 sm:px-8 sm:py-6 space-y-2.5">
          <div className="flex items-center justify-between text-base font-semibold">
            <span className="text-slate-700">Kemajuan Pengisian Keseluruhan</span>
            <span className="text-emerald-800 tabular-nums font-mono">{progress.percentage}%</span>
          </div>
          <div className="w-full h-3.5 rounded-full bg-slate-100 border border-slate-200/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-700 to-teal-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </section>

      {/* Class & Subject Assignment Cards */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900">
          Daftar Kelas &amp; Mata Pelajaran Tanggung Jawab Anda
        </h2>

        {myAssignments.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
            <p className="font-display text-lg font-bold text-slate-900 mb-1">
              Belum Ada Tugas Penilaian
            </p>
            <p className="text-base text-slate-600">
              Admin belum memetakan kelas atau mata pelajaran untuk Anda pada periode ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {myAssignments.map((task) => {
              const liveStudentCount = students.filter(
                (s) => s.classId === task.classId && s.isActive
              ).length;
              const total = liveStudentCount > 0 ? liveStudentCount : task.totalStudents;
              const pct = computeAssignmentPercentage(task.filledCount, total);
              const isLocked = task.status === 'terkunci' || task.status === 'terkirim';

              return (
                <div
                  key={task.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] hover:border-emerald-400 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">
                          Kelas {task.className}
                        </p>
                        <h3 className="font-display text-[22px] font-bold text-slate-900 leading-snug mt-0.5">
                          {task.subjectName}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap ${
                          isLocked
                            ? 'text-emerald-800'
                            : task.status === 'dalam_proses'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="w-4 h-4" />
                        ) : task.status === 'dalam_proses' ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{getStatusLabel(task.status)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-base text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="tabular-nums">{total} Santri</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums font-medium">
                        Terisi {task.filledCount}/{total} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          isLocked ? 'bg-emerald-700' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectAssignment(task)}
                    className={`w-full min-h-[54px] px-5 rounded-xl font-semibold text-lg inline-flex items-center justify-center gap-2 transition-colors ${
                      isLocked
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                        : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
                    }`}
                  >
                    <span>
                      {isLocked
                        ? 'Lihat Nilai (Terkunci)'
                        : task.filledCount > 0
                        ? 'Lanjutkan Input Nilai'
                        : 'Mulai Input Nilai'}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
