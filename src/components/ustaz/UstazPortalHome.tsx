import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Database,
  KeyRound,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import { LogoMark } from '../common/LogoMark';

interface UstazPortalHomeProps {
  onSuccessLogin: () => void;
  onOpenAdminLogin?: () => void;
}

export function UstazPortalHome({ onSuccessLogin, onOpenAdminLogin }: UstazPortalHomeProps) {
  const {
    settings,
    ustazList,
    ustazSession,
    verifyUstazPin,
    isLiveFirestore,
    loginWithGoogle,
    isLoadingData,
  } = usePortal();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUstaz, setSelectedUstaz] = useState<{ id: string; name: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeUstazList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ustazList
      .filter((u) => u.isActive)
      .filter((u) => (!q ? true : u.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [ustazList, searchQuery]);

  const totalRegisteredUstaz = useMemo(
    () => ustazList.filter((u) => u.isActive).length,
    [ustazList]
  );

  const handleSelectCard = (u: { id: string; name: string }) => {
    if (ustazSession && ustazSession.ustazId === u.id) {
      onSuccessLogin();
      return;
    }
    setSelectedUstaz(u);
    setPinInput('');
    setPinError('');
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUstaz) return;
    setSubmitting(true);
    setPinError('');
    const result = await verifyUstazPin(selectedUstaz.id, pinInput);
    setSubmitting(false);
    if (!result.ok) {
      setPinError(result.error || 'PIN akses tidak sesuai.');
      return;
    }
    setSelectedUstaz(null);
    onSuccessLogin();
  };

  const appendDigit = (digit: string) => {
    if (pinInput.length < 8) {
      setPinInput((prev) => prev + digit);
      setPinError('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Firestore Connection Notice (clean, zero dummy hints) */}
      {!isLiveFirestore && (
        <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">Penyimpanan Lokal Aktif:</span>{' '}
            Hubungkan akun Google Admin untuk menyinkronkan data asli dengan Cloud Firestore.
          </p>
          <button
            type="button"
            onClick={loginWithGoogle}
            className="min-h-[44px] px-4 rounded-xl border border-emerald-700/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-sm inline-flex items-center justify-center gap-2 shrink-0 transition-colors whitespace-nowrap"
          >
            <Database className="w-4 h-4 text-emerald-700" />
            <span>Hubungkan Firestore</span>
          </button>
        </div>
      )}

      {/* Architectural Madrasah Identity Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-[#064E3B] text-white p-6 sm:p-10 shadow-sm">
        {/* Crisp Islamic 8-Point Geometric Star Lattice Accent (subtle, architectural) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 240 240"
          className="pointer-events-none absolute -right-8 -top-8 w-64 h-64 sm:w-80 sm:h-80 text-[#E5C97B]/12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <rect x="45" y="45" width="150" height="150" />
          <rect x="45" y="45" width="150" height="150" transform="rotate(45 120 120)" />
          <circle cx="120" cy="120" r="95" />
          <circle cx="120" cy="120" r="56" />
          <rect x="78" y="78" width="84" height="84" />
          <rect x="78" y="78" width="84" height="84" transform="rotate(45 120 120)" />
        </svg>

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="shrink-0">
            <LogoMark
              src={settings.logoUrl}
              alt={settings.schoolName}
              sizeClass="w-22 h-22 sm:w-24 sm:h-24"
              framed
            />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-sm sm:text-base font-semibold text-[#F1D98A] tracking-wide">
              {settings.schoolName}
            </p>
            <h1 className="font-display text-2xl sm:text-[34px] font-bold text-white leading-tight tracking-tight">
              Selamat Datang di Portal Penilaian
            </h1>
            <p className="text-base sm:text-lg text-emerald-50/90 max-w-2xl leading-relaxed">
              Pilih nama Anda di bawah ini, masukkan PIN akses, lalu isi nilai santri langkah demi langkah.
            </p>
            <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-sm text-emerald-100/85 tabular-nums">
              <span>Tahun Pelajaran {settings.academicYear}</span>
              <span aria-hidden="true">·</span>
              <span>Semester {settings.semester}</span>
              <span aria-hidden="true">·</span>
              <span>{totalRegisteredUstaz} Ustaz Terdaftar</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <label htmlFor="cari-ustaz" className="block text-base font-semibold text-slate-900 mb-2.5">
          Cari Nama Ustaz / Ustadzah
        </label>
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="cari-ustaz"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ketik nama Anda di sini..."
            className="w-full min-h-[56px] pl-12 pr-12 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </section>

      {/* Ustaz Cards Directory or Clean Empty State */}
      <section aria-label="Daftar nama ustaz">
        {isLoadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-white border border-slate-200/80 animate-pulse p-6"
              />
            ))}
          </div>
        ) : totalRegisteredUstaz === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)] space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[#F0F7F4] border border-emerald-200/80 text-emerald-800 flex items-center justify-center mx-auto">
              <User className="w-8 h-8" />
            </div>
            <div className="max-w-lg mx-auto space-y-2">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Belum Ada Data Ustaz Terdaftar
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Portal ini dalam keadaan bersih tanpa data dummy. Silakan masuk sebagai Admin untuk menambahkan daftar ustaz, kelas, santri, dan mata pelajaran.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              {onOpenAdminLogin && (
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="min-h-[52px] px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors shadow-xs w-full sm:w-auto"
                >
                  <Shield className="w-5 h-5 text-[#E5C97B]" />
                  <span>Masuk Panel Admin</span>
                </button>
              )}
              {!isLiveFirestore && (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="min-h-[52px] px-6 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                >
                  <Database className="w-5 h-5 text-emerald-700" />
                  <span>Hubungkan Google Firestore</span>
                </button>
              )}
            </div>
          </div>
        ) : activeUstazList.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
            <User className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 mb-1">
                Nama Ustaz Tidak Ditemukan
              </h2>
              <p className="text-base text-slate-600">
                Tidak ada nama ustaz yang cocok dengan &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm"
            >
              Tampilkan Semua Ustaz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeUstazList.map((u) => {
              const isCurrentSession = ustazSession?.ustazId === u.id;
              return (
                <div
                  key={u.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] hover:border-emerald-500/60 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#F0F7F4] border border-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0">
                      <User className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-bold text-slate-900 leading-snug">
                        {u.name}
                      </h2>
                      <p
                        className={`text-sm mt-1 ${
                          isCurrentSession ? 'font-semibold text-emerald-800' : 'text-slate-500'
                        }`}
                      >
                        {isCurrentSession ? 'Sesi aktif di perangkat ini' : 'Pengampu Madrasah Diniyah'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={isCurrentSession ? `Lanjutkan tugas ${u.name}` : `Masuk sebagai ${u.name}`}
                    onClick={() => handleSelectCard(u)}
                    className="w-full min-h-[54px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white font-semibold text-lg inline-flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    <span>{isCurrentSession ? 'Lanjutkan Tugas' : 'Masuk'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Elderly-Friendly PIN Modal */}
      {selectedUstaz && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] border border-emerald-200/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h2 id="pin-modal-title" className="font-display text-xl font-bold text-slate-900">
                    Masukkan PIN Akses
                  </h2>
                  <p className="text-base text-slate-600">{selectedUstaz.name}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog PIN"
                onClick={() => setSelectedUstaz(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label htmlFor="ustaz-pin-input" className="block text-base font-semibold text-slate-800 mb-2">
                  PIN Angka dari Admin
                </label>
                <input
                  id="ustaz-pin-input"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setPinInput(digits);
                    setPinError('');
                  }}
                  placeholder="••••"
                  className="w-full min-h-[60px] px-4 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-center font-mono text-2xl tracking-[0.45em] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {/* Large Touch Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => appendDigit(d)}
                    className="min-h-[54px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-emerald-50 text-xl font-bold text-slate-800 tabular-nums transition-colors"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPinInput('')}
                  className="min-h-[54px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600"
                >
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={() => appendDigit('0')}
                  className="min-h-[54px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xl font-bold text-slate-800 tabular-nums"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput((p) => p.slice(0, -1))}
                  className="min-h-[54px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600"
                >
                  Mundur
                </button>
              </div>

              {pinError && (
                <div role="alert" className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUstaz(null)}
                  className="flex-1 min-h-[54px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || pinInput.length < 4}
                  className="flex-1 min-h-[54px] rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold text-base"
                >
                  {submitting ? 'Memeriksa...' : 'Buka Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
