import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { usePortal } from '../../services/portalContext';

export function ToastContainer() {
  const { toasts, dismissToast } = usePortal();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 z-[60] flex flex-col gap-3 max-w-md w-[calc(100%-2rem)] pointer-events-none"
    >
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />,
          error: <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />,
          warning: <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />,
          info: <Info className="w-6 h-6 text-slate-600 shrink-0" />,
        };
        const borderMap = {
          success: 'border-emerald-200 bg-white',
          error: 'border-red-200 bg-white',
          warning: 'border-amber-200 bg-white',
          info: 'border-slate-200 bg-white',
        };

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg ${borderMap[toast.type]}`}
          >
            {iconMap[toast.type]}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-base">{toast.title}</p>
              {toast.message && (
                <p className="text-sm text-slate-600 mt-0.5">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              aria-label={`Tutup notifikasi ${toast.title}`}
              onClick={() => dismissToast(toast.id)}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
