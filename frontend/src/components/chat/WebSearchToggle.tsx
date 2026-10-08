import React from 'react';
import { Globe, ShieldCheck } from 'lucide-react';
import type { SourceMode } from '../../types/index.ts';

interface WebSearchToggleProps {
  sourceMode: SourceMode;
  onChangeSourceMode: (mode: SourceMode) => void;
}

export const WebSearchToggle: React.FC<WebSearchToggleProps> = ({
  sourceMode,
  onChangeSourceMode,
}) => {
  const isWebEnabled = sourceMode === 'documents_and_web' || sourceMode === 'web_only';

  const toggle = () => {
    onChangeSourceMode(isWebEnabled ? 'documents_only' : 'documents_and_web');
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
          isWebEnabled
            ? 'bg-blue-50 border-blue-200 text-blue-900'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
        title={isWebEnabled ? 'External web search enabled' : 'Document-grounded only'}
      >
        <Globe className={`w-3.5 h-3.5 ${isWebEnabled ? 'text-blue-600' : 'text-slate-400'}`} />
        <span>Web Search</span>
        <span
          className={`text-[10px] uppercase font-mono px-1 rounded ${
            isWebEnabled ? 'bg-blue-200/60 text-blue-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {isWebEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
        {isWebEnabled ? (
          <span>External web sources may be cited.</span>
        ) : (
          <>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Grounded only in your uploaded documents.</span>
          </>
        )}
      </div>
    </div>
  );
};
