import React, { useMemo, useState } from 'react';
import { AlertCircle, ClipboardList, GraduationCap, Plus, Trash2, X } from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import type { Assignment } from '../../types/portal';
import { getStatusLabel } from '../../utils/grading';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function AdminAssignmentsPage() {
  const {
    ustazList,
    classes,
    subjects,
    periods,
    assignments,
    createAssignment,
    deleteAssignment,
    createClassRoom,
    deleteClassRoom,
    settings,
  } = usePortal();

  const [ustazId, setUstazId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  // Class Management Modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('Ula');

  const resolvedPeriodId = periodId || settings.activePeriodId || periods[0]?.id || '';

  const activeUstaz = useMemo(() => ustazList.filter((u) => u.isActive), [ustazList]);
  const activeSubjects = useMemo(() => {
    return subjects.filter(
      (s) => s.isActive && (!classId || s.classIds.length === 0 || s.classIds.includes(classId))
    );
  }, [classId, subjects]);

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!ustazId || !classId || !subjectId || !resolvedPeriodId) {
      setFormError('Lengkapi pilihan Ustaz, Kelas, Mata Pelajaran, dan Periode Penilaian.');
      return;
    }
    setSaving(true);
    const res = await createAssignment({
      ustazId,
      classId,
      subjectId,
      periodId: resolvedPeriodId,
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error || 'Gagal membuat pemetaan tugas.');
      return;
    }
    setSubjectId('');
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    await createClassRoom({
      name: newClassName.trim(),
      level: newClassLevel.trim() || 'Ula',
      orderIndex: classes.length + 1,
    });
    setNewClassName('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
            Pemetaan Tugas Ustaz
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola daftar kelas dan hubungkan ustaz pengampu dengan mata pelajaran serta periode penilaian.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setClassModalOpen(true)}
          className="min-h-[46px] px-4 rounded-xl border border-emerald-700/30 bg-[#F0F7F4] hover:bg-emerald-100 text-emerald-900 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <GraduationCap className="w-4 h-4 text-emerald-700" />
          <span>Kelola Daftar Kelas ({classes.length})</span>
        </button>
      </div>

      {/* Create Assignment Form */}
      <form
        onSubmit={handleCreateMapping}
        className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-4"
      >
        <h2 className="font-display text-lg font-bold text-slate-900">Tambah Pemetaan Tugas Baru</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="map-ustaz" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Nama Ustaz
            </label>
            <select
              id="map-ustaz"
              value={ustazId}
              onChange={(e) => setUstazId(e.target.value)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              <option value="">-- Pilih Ustaz --</option>
              {activeUstaz.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="map-class" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Kelas
            </label>
            <select
              id="map-class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSubjectId('');
              }}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              <option value="">-- Pilih Kelas --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="map-subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Mata Pelajaran
            </label>
            <select
              id="map-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              <option value="">-- Pilih Mata Pelajaran --</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="map-period" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Periode Penilaian
            </label>
            <select
              id="map-period"
              value={resolvedPeriodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              {periods.length === 0 && <option value="">Belum ada periode</option>}
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.academicYear})
                </option>
              ))}
            </select>
          </div>
        </div>

        {formError && (
          <div role="alert" className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[46px] px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold text-sm inline-flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pemetaan Tugas'}</span>
          </button>
        </div>
      </form>

      {/* Existing Assignments Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {assignments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <p className="font-display text-lg font-bold text-slate-900">Belum Ada Pemetaan Tugas</p>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Tambahkan pemetaan tugas di formulir atas agar otomatis muncul pada dashboard ustaz terkait.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FBFA] border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Ustaz Pengampu</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4">Mata Pelajaran</th>
                  <th className="py-3.5 px-4">Periode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F6F8F7]/60 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-slate-900">{a.ustazName}</td>
                    <td className="py-3.5 px-4 text-slate-700">{a.className}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{a.subjectName}</td>
                    <td className="py-3.5 px-4 text-slate-600">{a.periodName}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-700 tabular-nums">
                      {getStatusLabel(a.status)} ({a.filledCount}/{a.totalStudents})
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        aria-label={`Hapus pemetaan ${a.subjectName} kelas ${a.className}`}
                        onClick={() => setDeleteTarget(a)}
                        className="min-h-[42px] min-w-[42px] px-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 inline-flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manage Classes Modal */}
      {classModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">Kelola Daftar Kelas</h2>
              <button
                type="button"
                aria-label="Tutup modal kelas"
                onClick={() => setClassModalOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddClass} className="flex gap-2">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Nama kelas (misal: 1 Ula A)"
                className="flex-1 min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
              <select
                value={newClassLevel}
                onChange={(e) => setNewClassLevel(e.target.value)}
                className="min-h-[46px] px-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="Ula">Ula</option>
                <option value="Wustha">Wustha</option>
                <option value="Ulya">Ulya</option>
              </select>
              <button
                type="submit"
                className="min-h-[46px] px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm whitespace-nowrap"
              >
                Tambah
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto border border-slate-200 rounded-2xl">
              {classes.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Belum ada kelas terdaftar. Tambahkan kelas pertama di atas.
                </p>
              ) : (
                classes.map((c) => (
                  <div key={c.id} className="p-3.5 flex items-center justify-between hover:bg-[#F9FBFA]">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                      <p className="text-xs text-slate-500">Tingkat {c.level}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus kelas ${c.name}`}
                      onClick={() => deleteClassRoom(c.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Pemetaan Tugas?"
        description={`Tugas penilaian ${deleteTarget?.subjectName || ''} kelas ${deleteTarget?.className || ''} oleh ${deleteTarget?.ustazName || ''} akan dihapus.`}
        confirmLabel="Ya, Hapus"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteAssignment(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
