import { Database, AlertTriangle } from 'lucide-react';

export function FirebaseSetupGuide() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Konfigurasi Firebase Belum Tersedia
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Portal Penilaian Madrasah Diniyah Ma&apos;hadul Muta&apos;allimin I membutuhkan koneksi Cloud Firestore yang valid.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-sm text-slate-700">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>Langkah Pengaturan Firebase:</span>
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Pastikan proyek Firebase sudah diaktifkan dan memiliki Cloud Firestore serta Firebase Authentication (Google Sign-In).</li>
            <li>Pastikan berkas <code className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">firebase-applet-config.json</code> berisi <code className="font-mono">projectId</code>, <code className="font-mono">apiKey</code>, dan <code className="font-mono">firestoreDatabaseId</code> yang sah.</li>
            <li>Deploy aturan keamanan <code className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">firestore.rules</code> agar akses ustaz dan admin terlindungi.</li>
            <li>Muat ulang halaman setelah konfigurasi tersedia.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
