import React from 'react';
import {
  HelpCircle,
  BookOpen,
  FileText,
  GitCompare,
  SearchCheck,
  GraduationCap,
} from 'lucide-react';
import type { ChatMode, ExplanationStyle } from '../../types/index.ts';

interface ModeSelectorProps {
  currentMode: ChatMode;
  onChangeMode: (mode: ChatMode) => void;
  explanationStyle: ExplanationStyle;
  onChangeExplanationStyle: (style: ExplanationStyle) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onChangeMode,
  explanationStyle,
  onChangeExplanationStyle,
}) => {
  const modes: Array<{
    id: ChatMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'ask', label: 'Ask', icon: HelpCircle },
    { id: 'explain', label: 'Explain', icon: BookOpen },
    { id: 'summarize', label: 'Summarize', icon: FileText },
    { id: 'compare', label: 'Compare', icon: GitCompare },
    { id: 'evidence', label: 'Find Evidence', icon: SearchCheck },
    { id: 'quiz', label: 'Quiz', icon: GraduationCap },
  ];

  return (
    <div className="space-y-2">
      {/* Horizontal clean mode tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => onChangeMode(mode.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-selector for explain mode style */}
      {currentMode === 'explain' && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Explanation Depth:</span>
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-md">
            {(['normal', 'simple', 'step_by_step'] as ExplanationStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => onChangeExplanationStyle(style)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                  explanationStyle === style
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {style.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
