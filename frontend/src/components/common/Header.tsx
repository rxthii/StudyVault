import React from 'react';
import { Menu, Plus, Upload, Layers, HelpCircle, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { NavTab } from './Sidebar.tsx';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobile: () => void;
  onNavigate: (tab: NavTab) => void;
  onNewChat?: () => void;
  accountEmail: string;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobile,
  onNavigate,
  onNewChat,
  accountEmail,
  onLogout,
}) => {
  const { activeDocuments } = useApp();

  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview & recent documents' },
    chat: { title: 'Research Chat', subtitle: 'Document-grounded inquiry' },
    documents: { title: 'Knowledge Library', subtitle: 'Uploaded study material' },
    flashcards: { title: 'Flashcards', subtitle: 'Active retrieval practice' },
    quiz: { title: 'Quiz', subtitle: 'Knowledge check' },
    settings: { title: 'Settings', subtitle: 'System connection & status' },
  };

  const current = titles[currentTab] || { title: 'StudyVault', subtitle: '' };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
      {/* Zone 1: Mobile toggle + Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <span className="hidden sm:inline text-xs text-slate-400">
            / {current.subtitle}
          </span>
        </div>
      </div>

      {/* Zone 2: Scope Context */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
        <span className="font-mono tabular-nums text-slate-700 font-medium">
          {activeDocuments.length}
        </span>
        <span>active document{activeDocuments.length === 1 ? '' : 's'} linked</span>
      </div>

      {/* Zone 3: Primary Action */}
      <div className="flex items-center gap-2">
        {currentTab === 'chat' ? (
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        ) : currentTab === 'documents' ? (
          <button
            onClick={() => {
              const fileInput = document.getElementById('vault-file-input');
              if (fileInput) fileInput.click();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Files</span>
          </button>
        ) : currentTab === 'flashcards' ? (
          <button
            onClick={() => {
              const genBtn = document.getElementById('trigger-generate-flashcards');
              if (genBtn) genBtn.click();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Generate Deck</span>
          </button>
        ) : currentTab === 'quiz' ? (
          <button
            onClick={() => {
              const genBtn = document.getElementById('trigger-generate-quiz');
              if (genBtn) genBtn.click();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Generate Quiz</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('chat')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
          >
            <span>Ask a Question</span>
          </button>
        )}
        <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
          <span className="hidden max-w-36 truncate text-xs text-slate-500 lg:block" title={accountEmail}>{accountEmail}</span>
          <button onClick={onLogout} title="Sign out" aria-label="Sign out" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
