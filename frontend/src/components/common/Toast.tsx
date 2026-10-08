import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';

export const Toast: React.FC = () => {
  const { toast, dismissToast } = useApp();

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 text-white shadow-lg text-xs">
        <div className="shrink-0 mt-0.5">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <Info className="w-4 h-4 text-blue-400" />
          )}
        </div>

        <div className="flex-1 leading-normal text-slate-200">
          {toast.message}
        </div>

        <button
          onClick={dismissToast}
          className="shrink-0 p-0.5 text-slate-400 hover:text-white rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
