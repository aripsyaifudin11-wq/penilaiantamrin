import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Database, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import { LogoMark } from '../common/LogoMark';

interface AdminLoginPageProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminLoginPage({ onSuccess, onCancel }: AdminLoginPageProps) {
  const {
    settings,
    adminSession,
    loginAdminWithPassword,
    changeAdminPassword,
    loginWithGoogle,
    isLiveFirestore,
  } = usePortal();

  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requirePasswordChange = Boolean(adminSession?.mustChangePassword);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await loginAdminWithPassword(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Login gagal.');
      return;
    }
    if (!res.mustChange) {
      onSuccess();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setError('Konfirmasi password baru tidak sama.');
      return;
    }
    setLoading(true);
    const res = await changeAdminPassword(newPassword);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Gagal mengganti password.');
      return;
    }
    onSuccess();
  };

  const handleGoogleAdminLogin = async () => {
    await loginWithGoogle();
    onSuccess();
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10">
      <button
        type="button"
        onClick={onCancel}
        className="mb-5 min-h-[44px] px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm inline-flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Portal Ustaz</span>
      </button>

      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-[#064E3B] text-white p-6 sm:p-7 flex flex-col items-center text-center space-y-3">
          <LogoMark src={settings.logoUrl} alt={settings.schoolName} sizeClass="w-16 h-16" framed />
          <div>
            <p className="text-xs font-semibold text-[#F1D98A] tracking-wide">
              Administrasi Madrasah
            </p>
            <h1 className="font-display text-2xl font-bold text-white mt-1">
              {requirePasswordChange ? 'Wajib Ganti Password Admin' : 'Login Administrator'}
            </h1>
            <p className="text-sm text-emerald-50/85 mt-1 max-w-xs mx-auto">
              {requirePasswordChange
                ? 'Ganti password awal instalasi terlebih dahulu sebelum mengakses dashboard.'
                : 'Masuk untuk mengelola santri, ustaz, mata pelajaran, pemetaan, dan rekap nilai.'}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {requirePasswordChange ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="admin-new-pass" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Password Baru (minimal 6 karakter)
                </label>
                <input
                  id="admin-new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Masukkan password baru"
                  className="w-full min-h-[50px] px-4 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label htmlFor="admin-confirm-pass" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Ulangi Password Baru
                </label>
                <input
                  id="admin-confirm-pass"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Ketik ulang password baru"
                  className="w-full min-h-[50px] px-4 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[52px] rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>{loading ? 'Menyimpan...' : 'Simpan Password & Masuk'}</span>
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {!isLiveFirestore && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleGoogleAdminLogin}
                    className="w-full min-h-[52px] px-4 rounded-xl border border-emerald-700/30 bg-[#F0F7F4] hover:bg-emerald-100 text-emerald-950 font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <Database className="w-5 h-5 text-emerald-700" />
                    <span>Masuk dengan Google (Firestore Live)</span>
                  </button>
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200" />
                    <span className="shrink mx-3 text-xs font-medium text-slate-400">
                      atau gunakan password admin
                    </span>
                    <div className="flex-grow border-t border-slate-200" />
                  </div>
                </div>
              )}

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label htmlFor="admin-password-input" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Password Administrator
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="admin-password-input"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="Masukkan password admin"
                      className="w-full min-h-[52px] pl-11 pr-4 rounded-xl border border-slate-300 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </div>

                {error && (
                  <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[52px] rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <KeyRound className="w-5 h-5" />
                  <span>{loading ? 'Memverifikasi...' : 'Masuk Dashboard Admin'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
