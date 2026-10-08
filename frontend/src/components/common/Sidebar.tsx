import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Files,
  Layers,
  HelpCircle,
  Settings,
  BookMarked,
  RefreshCw,
  Circle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';

export type NavTab = 'dashboard' | 'chat' | 'documents' | 'flashcards' | 'quiz' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const { activeDocuments, healthStatus, refreshHealth } = useApp();

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'documents', label: 'Library', icon: Files, badge: activeDocuments.length },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-slate-200 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              SV
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-slate-900">
                StudyVault
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Document Knowledge Assistant
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 leading-snug">
            Your documents. Verifiable answers.
          </p>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Scope Footprint */}
        <div className="mx-3 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1">
            <span>Knowledge Scope</span>
            <span className="font-mono text-slate-900">{activeDocuments.length} active</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            {activeDocuments.length > 0
              ? 'Answers are grounded in active documents.'
              : 'Link documents to ground AI answers.'}
          </p>
        </div>

        {/* Backend Connectivity Status */}
        <div className="p-3.5 border-t border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthStatus === 'connected'
                    ? 'bg-emerald-600'
                    : healthStatus === 'checking'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <div className="text-xs">
                <span className="font-medium text-slate-800">
                  {healthStatus === 'connected'
                    ? 'Backend connected'
                    : healthStatus === 'checking'
                    ? 'Checking backend...'
                    : 'Backend offline'}
                </span>
                <span className="text-slate-500 font-mono text-[10px] block">
                  127.0.0.1:8000
                </span>
              </div>
            </div>
            <button
              onClick={() => refreshHealth()}
              title="Refresh connection status"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
