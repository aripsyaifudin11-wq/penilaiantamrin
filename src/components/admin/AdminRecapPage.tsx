import { useMemo, useState } from 'react';
import { Download, Eye, FileSpreadsheet, FileText, Table2, X } from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import { exportRecapMatrixXlsx } from '../../services/excelService';
import { downloadRecapPdf } from '../../services/pdfService';
import { buildRecapMatrix } from '../../utils/grading';
import { LogoMark } from '../common/LogoMark';

export function AdminRecapPage() {
  const {
    classes,
    subjects,
    students,
    assignments,
    gradesByAssignmentId,
    periods,
    settings,
  } = usePortal();

  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [selectedYear, setSelectedYear] = useState(settings.academicYear);
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    settings.activePeriodId || periods[0]?.id || ''
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const availableYears = useMemo(() => {
    const set = new Set<string>(settings.academicYear ? [settings.academicYear] : []);
    periods.forEach((p) => {
      if (p.academicYear) set.add(p.academicYear);
    });
    return Array.from(set);
  }, [periods, settings.academicYear]);

  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => !selectedYear || p.academicYear === selectedYear);
  }, [periods, selectedYear]);

  const activePeriod = useMemo(() => {
    return (
      periods.find((p) => p.id === selectedPeriodId) ||
      filteredPeriods[0] ||
      periods[0]
    );
  }, [filteredPeriods, periods, selectedPeriodId]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0],
    [classes, selectedClassId]
  );

  const matrix = useMemo(() => {
    if (!selectedClass) {
      return { subjects: [], rows: [], paperFormat: 'a4' as const };
    }
    const classStudents = students.filter((s) => s.classId === selectedClass.id && s.isActive);
    const classSubjects = subjects.filter(
      (sub) => sub.isActive && (sub.classIds.length === 0 || sub.classIds.includes(selectedClass.id))
    );
    const classAssignments = assignments.filter(
      (a) =>
        a.classId === selectedClass.id &&
        (!activePeriod || a.periodId === activePeriod.id)
    );
    return buildRecapMatrix(
      classStudents,
      classSubjects,
      classAssignments,
      gradesByAssignmentId,
      false // Unsubmitted scores remain '-' (never 0)
    );
  }, [activePeriod, assignments, gradesByAssignmentId, selectedClass, students, subjects]);

  const handleExportPdf = async () => {
    if (!selectedClass) return;
    setExportingPdf(true);
    try {
      await downloadRecapPdf({
        settings,
        className: selectedClass.name,
        academicYear: activePeriod?.academicYear || settings.academicYear,
        semester: activePeriod?.semester || settings.semester,
        periodName: activePeriod?.name || 'Penilaian Semester',
        matrix,
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportXlsx = async () => {
    if (!selectedClass) return;
    setExportingXlsx(true);
    try {
      await exportRecapMatrixXlsx({
        settings,
        className: selectedClass.name,
        academicYear: activePeriod?.academicYear || settings.academicYear,
        semester: activePeriod?.semester || settings.semester,
        periodName: activePeriod?.name || 'Penilaian Semester',
        matrix,
      });
    } finally {
      setExportingXlsx(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
            Rekap Nilai Matriks Santri
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Matriks nilai per kelas &amp; periode. Nilai yang belum dikirim ditampilkan sebagai tanda strip (-), bukan nol.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={!selectedClass || matrix.rows.length === 0}
            onClick={() => setPreviewOpen(true)}
            className="min-h-[46px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4 text-emerald-700" />
            <span>Preview Laporan</span>
          </button>

          <button
            type="button"
            disabled={exportingXlsx || !selectedClass || matrix.rows.length === 0}
            onClick={handleExportXlsx}
            className="min-h-[46px] px-4 rounded-xl border border-emerald-700/30 bg-[#F0F7F4] hover:bg-emerald-100 disabled:opacity-50 text-emerald-900 font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>{exportingXlsx ? 'Membuat XLSX...' : 'Export XLSX'}</span>
          </button>

          <button
            type="button"
            disabled={exportingPdf || !selectedClass || matrix.rows.length === 0}
            onClick={handleExportPdf}
            className="min-h-[46px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold text-sm inline-flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>
              {exportingPdf
                ? 'Membuat PDF...'
                : `Export PDF (${matrix.paperFormat.toUpperCase()} Landscape)`}
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="recap-class" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Filter Kelas
          </label>
          <select
            id="recap-class"
            value={selectedClass?.id || ''}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm"
          >
            {classes.length === 0 && <option value="">Belum ada kelas</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="recap-year" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Tahun Pelajaran
          </label>
          <select
            id="recap-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm"
          >
            {availableYears.length === 0 && <option value="">Semua Tahun</option>}
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="recap-period" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Semester / Periode
          </label>
          <select
            id="recap-period"
            value={activePeriod?.id || ''}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm"
          >
            {filteredPeriods.length === 0 && <option value="">Belum ada periode</option>}
            {filteredPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.semester})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {!selectedClass || matrix.rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Table2 className="w-6 h-6" />
            </div>
            <p className="font-display text-lg font-bold text-slate-900">Data Matriks Belum Tersedia</p>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Pastikan kelas, santri, mata pelajaran aktif, dan tugas penilaian sudah disiapkan agar matriks rekap nilai tampil di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#064E3B] text-white text-xs font-bold tracking-wider">
                  <th className="py-3.5 px-4 text-center w-12">NO</th>
                  <th className="py-3.5 px-4 min-w-[200px]">NAMA SANTRI</th>
                  {matrix.subjects.map((sub) => (
                    <th key={sub.id} className="py-3.5 px-3 text-center whitespace-nowrap">
                      {sub.name.toUpperCase()}
                    </th>
                  ))}
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">RATA-RATA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matrix.rows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-[#F6F8F7] transition-colors">
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                      {row.no}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{row.studentName}</td>
                    {matrix.subjects.map((sub) => {
                      const val = row.scoresBySubjectId[sub.id];
                      return (
                        <td
                          key={sub.id}
                          className={`py-3 px-3 text-center font-mono tabular-nums ${
                            val === null ? 'text-slate-400' : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {val === null ? '-' : val}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-center font-mono tabular-nums font-bold text-emerald-800">
                      {row.average === null ? '-' : row.average}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal Before Download */}
      {previewOpen && selectedClass && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Preview Laporan Rekap Nilai ({matrix.paperFormat.toUpperCase()} Landscape)
                </h2>
                <p className="text-xs text-slate-500">
                  Periksa tata letak kop madrasah, tabel nilai, dan tanda tangan sebelum mengunduh.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup preview"
                onClick={() => setPreviewOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-300 rounded-2xl p-6 bg-white space-y-6">
              {/* KOP Madrasah Preview */}
              <div className="flex items-center gap-4 border-b-2 border-emerald-800 pb-4">
                <LogoMark src={settings.logoUrl} alt={settings.schoolName} sizeClass="w-16 h-16" framed />
                <div className="flex-1 text-center">
                  <p className="font-display text-lg font-bold text-emerald-900 uppercase">
                    {settings.schoolName}
                  </p>
                  {settings.reportHeader && (
                    <p className="text-xs font-medium text-slate-700">{settings.reportHeader}</p>
                  )}
                  {settings.address && (
                    <p className="text-xs text-slate-600">{settings.address}</p>
                  )}
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="font-display font-bold text-slate-900">REKAPITULASI NILAI HASIL BELAJAR SANTRI</p>
                <p className="text-sm text-slate-700">
                  Kelas: <strong>{selectedClass.name}</strong> · Tahun Pelajaran:{' '}
                  <strong>{activePeriod?.academicYear || settings.academicYear}</strong> · Semester:{' '}
                  <strong>{activePeriod?.semester || settings.semester}</strong>
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-[#064E3B] text-white">
                      <th className="border border-slate-300 p-2 text-center">NO</th>
                      <th className="border border-slate-300 p-2 text-left">NAMA SANTRI</th>
                      {matrix.subjects.map((s) => (
                        <th key={s.id} className="border border-slate-300 p-2 text-center">
                          {s.name.toUpperCase()}
                        </th>
                      ))}
                      <th className="border border-slate-300 p-2 text-center">RATA-RATA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((r) => (
                      <tr key={r.studentId}>
                        <td className="border border-slate-300 p-2 text-center tabular-nums">{r.no}</td>
                        <td className="border border-slate-300 p-2 font-medium">{r.studentName}</td>
                        {matrix.subjects.map((s) => {
                          const v = r.scoresBySubjectId[s.id];
                          return (
                            <td key={s.id} className="border border-slate-300 p-2 text-center font-mono tabular-nums">
                              {v === null ? '-' : v}
                            </td>
                          );
                        })}
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold tabular-nums">
                          {r.average === null ? '-' : r.average}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4">
                <div className="text-left text-sm w-64">
                  <p>Kepala Madrasah,</p>
                  <div className="h-14" />
                  <p className="font-bold text-slate-900">
                    {settings.headmasterName || 'Kepala Madrasah Diniyah'}
                  </p>
                  {settings.headmasterNip && (
                    <p className="text-xs text-slate-600">NIP. {settings.headmasterNip}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleExportXlsx}
                className="min-h-[48px] px-5 rounded-xl border border-emerald-700/30 text-emerald-900 bg-[#F0F7F4] hover:bg-emerald-100 font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download XLSX</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="min-h-[48px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
