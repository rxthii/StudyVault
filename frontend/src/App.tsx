/**
 * StudyVault — Smart Document Knowledge Assistant
 * Frontend Application Root
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Sidebar, type NavTab } from './components/common/Sidebar.tsx';
import { Header } from './components/common/Header.tsx';
import { Toast } from './components/common/Toast.tsx';
import { EvidenceDrawer } from './components/chat/EvidenceDrawer.tsx';

import { DashboardPage } from './pages/DashboardPage.tsx';
import { ChatPage } from './pages/ChatPage.tsx';
import { DocumentsPage } from './pages/DocumentsPage.tsx';
import { FlashcardsPage } from './pages/FlashcardsPage.tsx';
import { QuizPage } from './pages/QuizPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { AuthPage } from './components/AuthPage.tsx';
import { getCurrentUser, type AccountUser } from './api/auth.ts';
import { clearAccessToken, getAccessToken } from './api/client.ts';

function MainLayout({ user, onLogout }: { user: AccountUser; onLogout: () => void }) {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [chatKey, setChatKey] = useState<number>(1);

  const handleNewChat = () => {
    setCurrentTab('chat');
    setChatKey((k) => k + 1);
  };

  const handleAskQueryFromDashboard = (query: string) => {
    setCurrentTab('chat');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Persistent Desktop Sidebar / Collapsible Mobile Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <Header
          currentTab={currentTab}
          onOpenMobile={() => setMobileMenuOpen(true)}
          onNavigate={setCurrentTab}
          onNewChat={handleNewChat}
          accountEmail={user.email}
          onLogout={onLogout}
        />

        <main className="flex-1 min-w-0">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentTab}
              onAskQuery={handleAskQueryFromDashboard}
            />
          )}

          {currentTab === 'chat' && (
            <ChatPage
              key={chatKey}
              onNavigateToDocuments={() => setCurrentTab('documents')}
            />
          )}

          {currentTab === 'documents' && <DocumentsPage />}

          {currentTab === 'flashcards' && <FlashcardsPage />}

          {currentTab === 'quiz' && <QuizPage />}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Evidence & Source Citation Inspection Drawer */}
      <EvidenceDrawer />

      {/* Global Toast Notifications */}
      <Toast />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setCheckingSession(false);
      return;
    }
    getCurrentUser()
      .then(setUser)
      .catch(() => { clearAccessToken(); setUser(null); })
      .finally(() => setCheckingSession(false));
  }, []);

  const logout = () => {
    clearAccessToken();
    setUser(null);
  };

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading your StudyVault account…</div>;
  }
  if (!user) return <AuthPage onAuthenticated={setUser} />;

  return (
    <AppProvider key={user.id}>
      <MainLayout user={user} onLogout={logout} />
    </AppProvider>
  );
}
