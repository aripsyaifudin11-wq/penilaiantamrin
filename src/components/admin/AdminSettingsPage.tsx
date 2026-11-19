import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Plus, Save, Upload } from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import type { SemesterType } from '../../types/portal';
import { LogoMark } from '../common/LogoMark';

export function AdminSettingsPage() {
  const {
    settings,
    saveSettings,
    uploadLogoFile,
    periods,
    createPeriod,
    updatePeriod,
    notify,
  } = usePortal();

  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [address, setAddress] = useState(settings.address);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [reportHeader, setReportHeader] = useState(settings.reportHeader);
  const [headmasterName, setHeadmasterName] = useState(settings.headmasterName);
  const [headmasterNip, setHeadmasterNip] = useState(settings.headmasterNip);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [semester, setSemester] = useState<SemesterType>(settings.semester);
  const [allowUstazReopenRequest, setAllowUstazReopenRequest] = useState(
    settings.allowUstazReopenRequest
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync controlled fields when Firestore settings load
  useEffect(() => {
    setSchoolName(settings.schoolName);
    setAddress(settings.address);
    setLogoUrl(settings.logoUrl);
    setReportHeader(settings.reportHeader);
    setHeadmasterName(settings.headmasterName);
    setHeadmasterNip(settings.headmasterNip);
    setAcademicYear(settings.academicYear);
    setSemester(settings.semester);
    setAllowUstazReopenRequest(settings.allowUstazReopenRequest);
  }, [settings]);

  // New period form
  const [perName, setPerName] = useState('');
  const [perYear, setPerYear] = useState(settings.academicYear);
  const [perSemester, setPerSemester] = useState<SemesterType>(settings.semester);
  const [perStart, setPerStart] = useState(new Date().toISOString().slice(0, 10));
  const [perEnd, setPerEnd] = useState(new Date().toISOString().slice(0, 10));
  const [perAllowReopen, setPerAllowReopen] = useState(true);
  const [addingPeriod, setAddingPeriod] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveSettings({
        schoolName: schoolName.trim(),
        address: address.trim(),
        logoUrl: logoUrl.trim(),
        reportHeader: reportHeader.trim(),
        headmasterName: headmasterName.trim(),
        headmasterNip: headmasterNip.trim(),
        academicYear: academicYear.trim(),
        semester,
        allowUstazReopenRequest,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogoFile(file);
      setLogoUrl(url);
      notify('success', 'Logo Diunggah', 'Klik Simpan Pengaturan untuk menerapkan logo baru.');
    } catch (err) {
      notify('error', 'Upload Logo Gagal', err instanceof Error ? err.message : 'Gagal unggah.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perName.trim()) return;
    setAddingPeriod(true);
    try {
      await createPeriod({
        name: perName.trim(),
        academicYear: perYear.trim(),
        semester: perSemester,
        startDate: perStart,
        endDate: perEnd,
        isActive: periods.length === 0,
        allowReopen: perAllowReopen,
      });
      setPerName('');
    } finally {
      setAddingPeriod(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
          Pengaturan Portal &amp; Periode
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Konfigurasi identitas madrasah, kop laporan PDF, kepala madrasah, dan periode penilaian.
        </p>
      </div>

      {/* School Identity & Report Header Form */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      >
        <h2 className="font-display text-xl font-bold text-slate-900">
          Identitas Madrasah &amp; Kop Laporan
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-[#F6F8F7] border border-slate-200/90">
          <LogoMark src={logoUrl} alt={schoolName} sizeClass="w-16 h-16" framed />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">Logo Madrasah</p>
            <label className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>{uploadingLogo ? 'Mengunggah...' : 'Unggah Logo Baru'}</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="set-school-name" className="block text-sm font-semibold text-slate-800 mb-1">
              Nama Madrasah
            </label>
            <input
              id="set-school-name"
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="set-address" className="block text-sm font-semibold text-slate-800 mb-1">
              Alamat Madrasah
            </label>
            <input
              id="set-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Jl. Pesantren No. 12, Kecamatan..."
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="set-kop" className="block text-sm font-semibold text-slate-800 mb-1">
              Kop Laporan PDF
            </label>
            <input
              id="set-kop"
              type="text"
              value={reportHeader}
              onChange={(e) => setReportHeader(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="set-headmaster" className="block text-sm font-semibold text-slate-800 mb-1">
              Nama Kepala Madrasah
            </label>
            <input
              id="set-headmaster"
              type="text"
              value={headmasterName}
              onChange={(e) => setHeadmasterName(e.target.value)}
              placeholder="Nama lengkap kepala madrasah"
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="set-nip" className="block text-sm font-semibold text-slate-800 mb-1">
              NIP Kepala Madrasah (opsional)
            </label>
            <input
              id="set-nip"
              type="text"
              value={headmasterNip}
              onChange={(e) => setHeadmasterNip(e.target.value)}
              placeholder="Opsional"
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="set-year" className="block text-sm font-semibold text-slate-800 mb-1">
              Tahun Pelajaran (YYYY/YYYY)
            </label>
            <input
              id="set-year"
              type="text"
              pattern="[0-9]{4}/[0-9]{4}"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="set-semester" className="block text-sm font-semibold text-slate-800 mb-1">
              Semester Aktif
            </label>
            <select
              id="set-semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value as SemesterType)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={allowUstazReopenRequest}
            onChange={(e) => setAllowUstazReopenRequest(e.target.checked)}
            className="w-5 h-5 accent-emerald-700"
          />
          <span className="text-sm font-medium text-slate-800">
            Izinkan Admin membuka kembali tugas yang sudah dikunci (dengan alasan wajib dicatat)
          </span>
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingSettings}
            className="min-h-[50px] px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-base inline-flex items-center gap-2 transition-colors"
          >
            <Save className="w-5 h-5" />
            <span>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>

      {/* Grading Periods Management */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-700" />
          <h2 className="font-display text-xl font-bold text-slate-900">Pengelolaan Periode Penilaian</h2>
        </div>

        <form onSubmit={handleAddPeriod} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#F6F8F7] border border-slate-200/90">
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="per-name" className="block text-xs font-semibold text-slate-600 mb-1">
              Nama Periode Penilaian Baru
            </label>
            <input
              id="per-name"
              type="text"
              required
              value={perName}
              onChange={(e) => setPerName(e.target.value)}
              placeholder="Contoh: Penilaian Akhir Semester Ganjil"
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>
          <div>
            <label htmlFor="per-year" className="block text-xs font-semibold text-slate-600 mb-1">
              Tahun Pelajaran
            </label>
            <input
              id="per-year"
              type="text"
              pattern="[0-9]{4}/[0-9]{4}"
              value={perYear}
              onChange={(e) => setPerYear(e.target.value)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="per-start" className="block text-xs font-semibold text-slate-600 mb-1">
              Tanggal Mulai Pengisian
            </label>
            <input
              id="per-start"
              type="date"
              value={perStart}
              onChange={(e) => setPerStart(e.target.value)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
            />
          </div>
          <div>
            <label htmlFor="per-end" className="block text-xs font-semibold text-slate-600 mb-1">
              Batas Akhir Pengisian
            </label>
            <input
              id="per-end"
              type="date"
              value={perEnd}
              onChange={(e) => setPerEnd(e.target.value)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
            />
          </div>
          <div>
            <label htmlFor="per-sem" className="block text-xs font-semibold text-slate-600 mb-1">
              Semester
            </label>
            <select
              id="per-sem"
              value={perSemester}
              onChange={(e) => setPerSemester(e.target.value as SemesterType)}
              className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={perAllowReopen}
              onChange={(e) => setPerAllowReopen(e.target.checked)}
              className="w-4 h-4 accent-emerald-700"
            />
            <span>Izinkan buka ulang tugas</span>
          </label>
          <div className="flex justify-end items-end">
            <button
              type="submit"
              disabled={addingPeriod}
              className="w-full min-h-[46px] px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{addingPeriod ? 'Menambah...' : 'Tambah Periode'}</span>
            </button>
          </div>
        </form>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl">
          {periods.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">Belum ada periode penilaian.</p>
          ) : (
            periods.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900 text-base">{p.name}</p>
                  <p className="text-sm text-slate-600 tabular-nums">
                    {p.academicYear} · Semester {p.semester} · {p.startDate} s/d {p.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800 px-3 py-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Periode Aktif</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updatePeriod(p.id, { isActive: true })}
                      className="min-h-[44px] px-4 rounded-xl border border-emerald-700 text-emerald-800 hover:bg-emerald-50 font-semibold text-sm"
                    >
                      Jadikan Aktif
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
