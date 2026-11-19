import React, { useState } from 'react';
import { BookOpen, Edit3, Plus, Power, Trash2, X } from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import type { Subject } from '../../types/portal';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function AdminSubjectsPage() {
  const {
    subjects,
    classes,
    createSubject,
    updateSubject,
    deleteSubject,
    notify,
  } = usePortal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [formName, setFormName] = useState('');
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  const openAdd = () => {
    setEditing(null);
    setFormName('');
    setFormClassIds(classes.map((c) => c.id));
    setFormActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setFormName(s.name);
    setFormClassIds(s.classIds);
    setFormActive(s.isActive);
    setFormError('');
    setModalOpen(true);
  };

  const toggleClass = (classId: string) => {
    setFormClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('Nama mata pelajaran wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSubject(editing.id, {
          name: formName.trim(),
          classIds: formClassIds,
          isActive: formActive,
        });
      } else {
        await createSubject({
          name: formName.trim(),
          classIds: formClassIds,
          isActive: formActive,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan mata pelajaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: Subject) => {
    await updateSubject(s.id, {
      name: s.name,
      classIds: s.classIds,
      isActive: !s.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
            Data Mata Pelajaran
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Atur daftar kitab / mata pelajaran dan tentukan kelas-kelas yang mempelajarinya.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="min-h-[46px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Mata Pelajaran</span>
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="font-display text-lg font-bold text-slate-900">Belum Ada Mata Pelajaran</p>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Tambahkan mata pelajaran madrasah seperti Fiqih, Akidah Akhlak, Nahwu, Sharaf, atau Al-Qur&apos;an Hadis.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map((sub) => {
            const classNames = sub.classIds
              .map((cid) => classes.find((c) => c.id === cid)?.name)
              .filter(Boolean);
            return (
              <div
                key={sub.id}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 flex flex-col justify-between gap-4 hover:border-emerald-600/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-bold text-slate-900">{sub.name}</h2>
                    <span
                      className={`text-sm font-semibold shrink-0 ${
                        sub.isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {sub.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    Kelas: {classNames.length > 0 ? classNames.join(' · ') : 'Semua / belum dipilih'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openEdit(sub)}
                    className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(sub)}
                    className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Power className="w-4 h-4" />
                    <span>{sub.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(sub)}
                    className="min-h-[42px] px-3.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 text-sm font-medium inline-flex items-center gap-1.5 ml-auto transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
              </h2>
              <button
                type="button"
                aria-label="Tutup form mapel"
                onClick={() => setModalOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="subject-name" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Nama Mata Pelajaran
                </label>
                <input
                  id="subject-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Masukkan nama mata pelajaran"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">
                  Kelas yang Mempelajari
                </p>
                {classes.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 rounded-xl border border-slate-200 bg-[#F9FBFA]">
                    Belum ada kelas terdaftar. Anda dapat tetap menyimpan mata pelajaran ini dan memilih kelas nanti setelah kelas dibuat.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {classes.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-[#F9FBFA] hover:bg-[#F0F7F4] cursor-pointer text-sm font-medium"
                      >
                        <input
                          type="checkbox"
                          checked={formClassIds.includes(c.id)}
                          onChange={() => toggleClass(c.id)}
                          className="w-4 h-4 accent-emerald-700"
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-5 h-5 accent-emerald-700"
                />
                <span className="text-base font-medium text-slate-800">Mata pelajaran aktif</span>
              </label>

              {formError && <p className="text-sm text-red-700 font-medium">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Mata Pelajaran?"
        description={`Mata pelajaran "${deleteTarget?.name || ''}" hanya dapat dihapus jika belum memiliki riwayat penilaian.`}
        confirmLabel="Ya, Hapus"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await deleteSubject(deleteTarget.id);
          if (!res.ok) {
            notify('error', 'Tidak Dapat Menghapus', res.error);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
