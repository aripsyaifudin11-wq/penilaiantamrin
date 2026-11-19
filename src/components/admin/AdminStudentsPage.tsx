import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import {
  downloadStudentTemplateXlsx,
  exportStudentsXlsx,
  parseStudentsXlsx,
  type ParsedStudentImportResult,
} from '../../services/excelService';
import type { Gender, Student } from '../../types/portal';
import { ConfirmDialog } from '../common/ConfirmDialog';

type PreviewFilter = 'all' | 'valid' | 'invalid';

export function AdminStudentsPage() {
  const {
    students,
    classes,
    createStudent,
    updateStudent,
    deleteStudent,
    importStudentsBatch,
    isLiveFirestore,
    notify,
  } = usePortal();

  const [search, setSearch] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<Gender>('L');
  const [formClassId, setFormClassId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  // Import XLSX Modal & Preview State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ParsedStudentImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [importing, setImporting] = useState(false);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (filterClassId === 'all' ? true : s.classId === filterClassId))
      .filter((s) => (!q ? true : s.name.toLowerCase().includes(q)))
      .sort((a, b) => a.className.localeCompare(b.className, 'id') || a.name.localeCompare(b.name, 'id'));
  }, [students, filterClassId, search]);

  const classSummary = useMemo(() => {
    const male = filteredStudents.filter((s) => s.gender === 'L').length;
    const female = filteredStudents.filter((s) => s.gender === 'P').length;
    return { total: filteredStudents.length, male, female };
  }, [filteredStudents]);

  const openAddModal = () => {
    setEditingStudent(null);
    setFormName('');
    setFormGender('L');
    setFormClassId(classes[0]?.id || '');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setFormName(s.name);
    setFormGender(s.gender);
    setFormClassId(s.classId);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (formName.trim().length < 2) {
      setFormError('Nama santri minimal 2 karakter.');
      return;
    }
    if (!formClassId) {
      setFormError('Pilih kelas terlebih dahulu. Jika belum ada, buat kelas di menu Pemetaan Tugas.');
      return;
    }
    setSaving(true);
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          name: formName.trim(),
          gender: formGender,
          classId: formClassId,
          isActive: editingStudent.isActive,
        });
      } else {
        await createStudent({
          name: formName.trim(),
          gender: formGender,
          classId: formClassId,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data santri.');
    } finally {
      setSaving(false);
    }
  };

  const openImportModal = () => {
    setImportResult(null);
    setImportError('');
    setPreviewFilter('all');
    setSkipDuplicates(true);
    setDragActive(false);
    setImportModalOpen(true);
  };

  const processSelectedFile = async (file: File) => {
    setImportError('');
    setParsingFile(true);
    try {
      const parsed = await parseStudentsXlsx(file, classes, students);
      setImportResult(parsed);
      setPreviewFilter('all');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Format file tidak valid.';
      setImportError(msg);
      setImportResult(null);
      notify('error', 'Import XLSX Gagal', msg);
    } finally {
      setParsingFile(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processSelectedFile(file);
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const validRows = useMemo(() => {
    if (!importResult) return [];
    return importResult.rows.filter(
      (r) => r.isValid && r.gender && r.classId && (!skipDuplicates || !r.isDuplicate)
    );
  }, [importResult, skipDuplicates]);

  const invalidRowsCount = useMemo(() => {
    if (!importResult) return 0;
    return importResult.rows.filter((r) => !r.isValid).length;
  }, [importResult]);

  const duplicateRowsCount = useMemo(() => {
    if (!importResult) return 0;
    return importResult.rows.filter((r) => r.isValid && r.isDuplicate).length;
  }, [importResult]);

  const displayedPreviewRows = useMemo(() => {
    if (!importResult) return [];
    if (previewFilter === 'valid') return importResult.rows.filter((r) => r.isValid);
    if (previewFilter === 'invalid') return importResult.rows.filter((r) => !r.isValid);
    return importResult.rows;
  }, [importResult, previewFilter]);

  const handleConfirmImport = async () => {
    if (!importResult) return;
    const rowsToCommit = validRows.map((r) => ({
      name: r.name,
      gender: r.gender!,
      classId: r.classId!,
      className: r.className,
    }));

    if (rowsToCommit.length === 0) {
      notify('warning', 'Tidak Ada Baris Siap Simpan', 'Periksa kesalahan validasi atau nonaktifkan lewati duplikat.');
      return;
    }
    setImporting(true);
    try {
      await importStudentsBatch(rowsToCommit);
      setImportModalOpen(false);
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
            Data Santri
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola daftar santri per kelas, tambah manual, atau import massal melalui Excel (.xlsx).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => downloadStudentTemplateXlsx(classes)}
            className="min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Template XLSX</span>
          </button>

          <button
            type="button"
            onClick={openImportModal}
            className="min-h-[46px] px-4 rounded-xl border border-emerald-700/30 bg-[#F0F7F4] hover:bg-emerald-100 text-emerald-900 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>Import XLSX</span>
          </button>

          <button
            type="button"
            disabled={filteredStudents.length === 0}
            onClick={() => exportStudentsXlsx(filteredStudents)}
            className="min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Export XLSX</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[46px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Santri</span>
          </button>
        </div>
      </div>

      {/* Filters & Summary */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="search-student" className="block text-xs font-semibold text-slate-600 mb-1">
              Cari Nama Santri
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-student"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik nama santri..."
                className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 transition-colors"
              />
            </div>
          </div>
          <div>
            <label htmlFor="filter-student-class" className="block text-xs font-semibold text-slate-600 mb-1">
              Filter Kelas
            </label>
            <select
              id="filter-student-class"
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="all">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100 text-sm text-slate-600 tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <Users className="w-4 h-4 text-emerald-700" />
            <span>{classSummary.total} Santri Ditampilkan</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Laki-laki: {classSummary.male}</span>
          <span aria-hidden="true">·</span>
          <span>Perempuan: {classSummary.female}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <p className="font-display text-lg font-bold text-slate-900">Belum Ada Data Santri</p>
              <p className="text-sm text-slate-600 mt-1">
                {classes.length === 0
                  ? 'Tambahkan daftar kelas terlebih dahulu di menu Pemetaan Tugas Ustaz, lalu tambah atau import data santri.'
                  : 'Tambahkan santri secara manual atau import file Excel (.xlsx).'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={openImportModal}
                className="min-h-[46px] px-4 rounded-xl border border-emerald-700/30 bg-[#F0F7F4] hover:bg-emerald-100 text-emerald-900 font-semibold text-sm inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Import XLSX</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[46px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Santri</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4 w-14">No</th>
                  <th className="py-3.5 px-4">Nama Santri</th>
                  <th className="py-3.5 px-4">Jenis Kelamin</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-[#F4FAF7] transition-colors">
                    <td className="py-3.5 px-4 tabular-nums text-slate-500 font-mono text-sm">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {s.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{s.className}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`Edit santri ${s.name}`}
                          onClick={() => openEditModal(s)}
                          className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus santri ${s.name}`}
                          onClick={() => setDeleteTarget(s)}
                          className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="student-form-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 id="student-form-title" className="font-display text-xl font-bold text-slate-900">
                {editingStudent ? 'Edit Data Santri' : 'Tambah Santri Baru'}
              </h2>
              <button
                type="button"
                aria-label="Tutup form"
                onClick={() => setModalOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label htmlFor="student-name" className="block text-sm font-semibold text-slate-800 mb-1">
                  Nama Lengkap Santri
                </label>
                <input
                  id="student-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="student-gender" className="block text-sm font-semibold text-slate-800 mb-1">
                  Jenis Kelamin
                </label>
                <select
                  id="student-gender"
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as Gender)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
              <div>
                <label htmlFor="student-class" className="block text-sm font-semibold text-slate-800 mb-1">
                  Kelas
                </label>
                <select
                  id="student-class"
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  {classes.length === 0 && <option value="">Belum ada kelas</option>}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-sm text-red-700 font-medium">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import XLSX Modal with File Input, SheetJS Parsing, Mandatory Validation & Preview Table */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="import-modal-title" className="font-display text-xl font-bold text-slate-900">
                  Import Data Santri dari Excel (.xlsx)
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Unggah file Excel dengan kolom wajib: <strong>Nama Santri</strong>, <strong>Kelas</strong>, dan{' '}
                  <strong>Jenis Kelamin (L/P)</strong>.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog import XLSX"
                onClick={() => setImportModalOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File Input & Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDropFile}
              className={`rounded-2xl border-2 border-dashed p-5 transition-colors ${
                dragActive
                  ? 'border-emerald-700 bg-[#F0F7F4]'
                  : 'border-slate-300 bg-[#F9FBFA] hover:border-emerald-500'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="import-students-file"
                      className="block text-base font-semibold text-slate-900 cursor-pointer"
                    >
                      {importResult
                        ? `File terpilih: ${importResult.fileName} (Sheet: ${importResult.sheetName})`
                        : 'Pilih atau seret file Excel (.xlsx / .xls) ke area ini'}
                    </label>
                    <p className="text-xs text-slate-500">
                      Kelas aktif tersedia: {classes.map((c) => c.name).join(', ') || 'Belum ada kelas — buat di Pemetaan Tugas terlebih dahulu'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadStudentTemplateXlsx(classes)}
                    className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                    <span>Unduh Template</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    id="import-students-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFilePick}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    disabled={parsingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{parsingFile ? 'Membaca...' : importResult ? 'Ganti File XLSX' : 'Pilih File XLSX'}</span>
                  </button>
                </div>
              </div>
            </div>

            {importError && (
              <div role="alert" className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Preview Table & Validation Controls */}
            {importResult && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
                    <span className="font-semibold text-slate-800">
                      Total Baris: {importResult.rows.length}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Siap Simpan: {validRows.length}</span>
                    </span>
                    {invalidRowsCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        <span>Bermasalah: {invalidRowsCount}</span>
                      </span>
                    )}
                    {duplicateRowsCount > 0 && (
                      <span className="text-amber-700 font-medium">
                        Duplikat: {duplicateRowsCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({importResult.rows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('valid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewFilter === 'valid' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Valid ({importResult.rows.filter((r) => r.isValid).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewFilter === 'invalid' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bermasalah ({invalidRowsCount})
                    </button>
                  </div>
                </div>

                {duplicateRowsCount > 0 && (
                  <label className="flex items-center gap-2.5 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 rounded"
                    />
                    <span>
                      Lewati {duplicateRowsCount} baris yang namanya sudah terdaftar di kelas yang sama
                    </span>
                  </label>
                )}

                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl min-h-[200px]">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="p-3 w-16">Baris</th>
                        <th className="p-3">Nama Santri</th>
                        <th className="p-3 w-24">L/P</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            Tidak ada baris untuk filter ini.
                          </td>
                        </tr>
                      ) : (
                        displayedPreviewRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={!row.isValid ? 'bg-red-50/60' : row.isDuplicate && skipDuplicates ? 'bg-amber-50/40' : ''}
                          >
                            <td className="p-3 tabular-nums font-mono text-xs text-slate-500">{row.rowNumber}</td>
                            <td className="p-3 font-semibold text-slate-900">{row.name || <span className="text-red-600 italic">Kosong</span>}</td>
                            <td className="p-3 font-mono">{row.gender || <span className="text-red-600 italic">-</span>}</td>
                            <td className="p-3">{row.className || <span className="text-red-600 italic">Kosong</span>}</td>
                            <td className="p-3">
                              {!row.isValid ? (
                                <span className="text-red-700 font-medium">{row.errors.join('; ')}</span>
                              ) : row.isDuplicate ? (
                                <span className="text-amber-700 font-semibold">
                                  {skipDuplicates ? 'Duplikat (dilewati)' : 'Duplikat (tetap diimport)'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Valid</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importing || validRows.length === 0}
                onClick={handleConfirmImport}
                className="min-h-[48px] px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold inline-flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {importing
                    ? 'Menyimpan...'
                    : isLiveFirestore
                    ? `Simpan ${validRows.length} Santri ke Firestore`
                    : `Simpan ${validRows.length} Santri Valid`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Data Santri?"
        description={`Santri "${deleteTarget?.name || ''}" akan dihapus dari daftar kelas ${deleteTarget?.className || ''}.`}
        confirmLabel="Ya, Hapus"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteStudent(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
