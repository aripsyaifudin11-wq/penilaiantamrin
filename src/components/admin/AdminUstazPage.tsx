import React, { useRef, useState } from 'react';
import {
  ClipboardList,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import {
  downloadUstazTemplateXlsx,
  exportUstazXlsx,
  parseUstazXlsx,
} from '../../services/excelService';
import type { UstazCombined } from '../../types/portal';
import { computeUstazProgress, getStatusLabel } from '../../utils/grading';
import { BLUEPRINT_PATTERNS, type UstazImportValidation } from '../../utils/validation';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function AdminUstazPage() {
  const {
    ustazList,
    assignments,
    createUstaz,
    updateUstaz,
    deleteUstaz,
    importUstazBatch,
    notify,
  } = usePortal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UstazCombined | null>(null);
  const [formName, setFormName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UstazCombined | null>(null);
  const [detailUstaz, setDetailUstaz] = useState<UstazCombined | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<UstazImportValidation[] | null>(null);
  const [importing, setImporting] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setFormName('');
    setFormWhatsapp('');
    setFormPin('');
    setFormActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u: UstazCombined) => {
    setEditing(u);
    setFormName(u.name);
    setFormWhatsapp(u.whatsapp);
    setFormPin('');
    setFormActive(u.isActive);
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (formName.trim().length < 2) {
      setFormError('Nama ustaz minimal 2 karakter.');
      return;
    }
    if (!editing && !BLUEPRINT_PATTERNS.PIN.test(formPin.trim())) {
      setFormError('PIN akses wajib 4–8 digit angka.');
      return;
    }
    if (editing && formPin.trim() && !BLUEPRINT_PATTERNS.PIN.test(formPin.trim())) {
      setFormError('Jika diubah, PIN harus 4–8 digit angka.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateUstaz(editing.id, {
          name: formName.trim(),
          whatsapp: formWhatsapp.trim(),
          pin: formPin.trim() || undefined,
          isActive: formActive,
        });
      } else {
        await createUstaz({
          name: formName.trim(),
          whatsapp: formWhatsapp.trim(),
          pin: formPin.trim(),
          isActive: formActive,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data ustaz.');
    } finally {
      setSaving(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseUstazXlsx(file);
      setImportPreview(parsed);
    } catch (err) {
      notify('error', 'Import XLSX Gagal', err instanceof Error ? err.message : 'File tidak valid.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const validRows = importPreview
      .filter((r) => r.isValid)
      .map((r) => ({
        name: r.name,
        whatsapp: r.whatsapp,
        pin: r.pin,
        isActive: r.isActive,
      }));
    if (validRows.length === 0) return;
    setImporting(true);
    await importUstazBatch(validRows);
    setImporting(false);
    setImportPreview(null);
  };

  const validImportCount = importPreview ? importPreview.filter((r) => r.isValid).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
            Daftar Ustaz
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola akun ustaz pengampu, nomor WhatsApp, PIN akses, dan pantau daftar tugasnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => downloadUstazTemplateXlsx()}
            className="min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Template XLSX</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFilePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[46px] px-4 rounded-xl border border-emerald-700/30 bg-[#F0F7F4] hover:bg-emerald-100 text-emerald-900 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>Import XLSX</span>
          </button>

          <button
            type="button"
            disabled={ustazList.length === 0}
            onClick={() => exportUstazXlsx(ustazList)}
            className="min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Export XLSX</span>
          </button>

          <button
            type="button"
            onClick={openAdd}
            className="min-h-[46px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Ustaz</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {ustazList.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <UserCheck className="w-6 h-6" />
            </div>
            <p className="font-display text-lg font-bold text-slate-900">Belum Ada Data Ustaz</p>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Tambahkan ustaz pengampu secara manual atau import melalui file Excel (.xlsx) agar dapat masuk di portal utama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FBFA] border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Nama Ustaz</th>
                  <th className="py-3.5 px-4">WhatsApp</th>
                  <th className="py-3.5 px-4">Progres Tugas</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {ustazList.map((u) => {
                  const prog = computeUstazProgress(u.id, assignments);
                  return (
                    <tr key={u.id} className="hover:bg-[#F6F8F7]/60 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-3.5 px-4 font-mono text-sm text-slate-700 tabular-nums">
                        {u.whatsapp || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-slate-700 tabular-nums">
                        {prog.completedTasks}/{prog.totalTasks} selesai ({prog.percentage}%)
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold">
                        <span className={u.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`Lihat tugas ${u.name}`}
                            onClick={() => setDetailUstaz(u)}
                            className="min-h-[42px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                          >
                            <ClipboardList className="w-4 h-4 text-emerald-700" />
                            <span>Tugas</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ustaz ${u.name}`}
                            onClick={() => openEdit(u)}
                            className="min-h-[42px] min-w-[42px] px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 inline-flex items-center justify-center transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus ustaz ${u.name}`}
                            onClick={() => setDeleteTarget(u)}
                            className="min-h-[42px] min-w-[42px] px-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 inline-flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {editing ? 'Edit Data Ustaz' : 'Tambah Ustaz Baru'}
              </h2>
              <button
                type="button"
                aria-label="Tutup form ustaz"
                onClick={() => setModalOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="ustaz-name" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Nama Ustaz / Ustadzah
                </label>
                <input
                  id="ustaz-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Masukkan nama lengkap ustaz"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="ustaz-wa" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Nomor HP WhatsApp
                </label>
                <input
                  id="ustaz-wa"
                  type="tel"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="ustaz-pin" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  {editing ? 'PIN Akses Baru (kosongkan jika tetap)' : 'PIN Akses (4–8 digit angka)'}
                </label>
                <input
                  id="ustaz-pin"
                  type="text"
                  inputMode="numeric"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="4–8 digit angka"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-5 h-5 accent-emerald-700 rounded"
                />
                <span className="text-base font-medium text-slate-800">Status Aktif (tampil di portal)</span>
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

      {/* Detail Task Drawer Modal */}
      {detailUstaz && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">{detailUstaz.name}</h2>
                <p className="text-sm text-slate-500">Daftar Tugas Penilaian &amp; Progres</p>
              </div>
              <button
                type="button"
                aria-label="Tutup daftar tugas"
                onClick={() => setDetailUstaz(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {assignments.filter((a) => a.ustazId === detailUstaz.id).length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Belum ada tugas penilaian untuk ustaz ini.
                </p>
              ) : (
                assignments
                  .filter((a) => a.ustazId === detailUstaz.id)
                  .map((a) => (
                    <div key={a.id} className="p-3.5 rounded-xl border border-slate-200 bg-[#F9FBFA] flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {a.subjectName} — {a.className}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          Terisi {a.filledCount}/{a.totalStudents} santri
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-700">
                        {getStatusLabel(a.status)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">Preview Import Ustaz XLSX</h2>
              <button
                type="button"
                aria-label="Tutup preview"
                onClick={() => setImportPreview(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-[#F9FBFA] border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Baris</th>
                    <th className="p-3">Nama Ustaz</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importPreview.map((r) => (
                    <tr key={r.rowNumber} className={r.isValid ? '' : 'bg-red-50/50'}>
                      <td className="p-3 tabular-nums text-slate-500">{r.rowNumber}</td>
                      <td className="p-3 font-medium text-slate-900">{r.name || '-'}</td>
                      <td className="p-3 font-mono text-slate-700">{r.whatsapp || '-'}</td>
                      <td className="p-3">
                        {r.isValid ? (
                          <span className="text-emerald-700 font-semibold">Valid</span>
                        ) : (
                          <span className="text-red-700">{r.errors.join('; ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importing || validImportCount === 0}
                onClick={handleConfirmImport}
                className="min-h-[48px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold"
              >
                {importing ? 'Mengimport...' : `Import ${validImportCount} Ustaz Valid`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Data Ustaz?"
        description={`Ustaz "${deleteTarget?.name || ''}" akan dihapus dari sistem.`}
        confirmLabel="Ya, Hapus"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteUstaz(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
