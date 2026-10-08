import React, { useState, useEffect } from 'react';
import {
  Files,
  MessageSquare,
  Layers,
  HelpCircle,
  Upload,
  ArrowRight,
  Search,
  Database,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import type { NavTab } from '../components/common/Sidebar.tsx';
import { getRetrievalStats } from '../api/retrieval.ts';
import { getFlashcardSets } from '../api/flashcards.ts';
import type { RetrievalStatsResponse } from '../types/index.ts';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
  onAskQuery: (query: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onAskQuery }) => {
  const { documents, activeDocuments } = useApp();
  const [quickQuery, setQuickQuery] = useState('');
  const [retrievalStats, setRetrievalStats] = useState<RetrievalStatsResponse | null>(null);
  const [decksCount, setDecksCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const [statsRes, flashcardsRes] = await Promise.all([
          getRetrievalStats().catch(() => null),
          getFlashcardSets().catch(() => []),
        ]);
        if (isMounted) {
          if (statsRes) setRetrievalStats(statsRes);
          if (flashcardsRes) setDecksCount(flashcardsRes.length);
        }
      } catch {
        // Ignore optional stats errors
      }
    };
    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    onAskQuery(quickQuery.trim());
    onNavigate('chat');
  };

  const recentDocs = documents.slice(0, 5);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Title & Research Question Box */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            StudyVault
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Your documents. Your knowledge. Verifiable answers.
          </p>
        </div>

        {/* Clean, tactile query bar */}
        <form onSubmit={handleQuickSearch} className="max-w-2xl">
          <div className="relative flex items-center bg-white rounded-lg border border-slate-300 shadow-xs focus-within:border-slate-800 focus-within:ring-1 focus-within:ring-slate-800 transition-all p-1">
            <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search or ask anything from your active documents..."
              className="w-full bg-transparent border-0 px-3 py-1.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shrink-0 flex items-center gap-1"
            >
              <span>Ask</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quick Actions
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate('documents')}
            className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-left transition-all shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium w-full">
              <span>Library</span>
              <Upload className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-900 mt-1.5 truncate w-full">
              Upload Documents
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate w-full">
              Add PDF & TXT study files
            </div>
          </button>

          <button
            onClick={() => onNavigate('chat')}
            className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-left transition-all shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium w-full">
              <span>Research</span>
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-900 mt-1.5 truncate w-full">
              Ask StudyVault
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate w-full">
              Inquire with verified citations
            </div>
          </button>

          <button
            onClick={() => onNavigate('flashcards')}
            className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-left transition-all shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium w-full">
              <span>Active Recall</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-900 mt-1.5 truncate w-full">
              Generate Flashcards
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate w-full">
              Spaced retrieval practice
            </div>
          </button>

          <button
            onClick={() => onNavigate('quiz')}
            className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-left transition-all shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium w-full">
              <span>Evaluation</span>
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-900 mt-1.5 truncate w-full">
              Take a Quiz
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate w-full">
              Self-test against materials
            </div>
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Documents</div>
          <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
            {documents.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Stored in library</div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Active Documents</div>
          <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
            {activeDocuments.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Linked to retrieval</div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Vector Passages</div>
          <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
            {retrievalStats?.total_vector_count ?? (documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0))}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Indexed in Pinecone</div>
        </div>

        <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Flashcard Sets</div>
          <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
            {decksCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Decks generated</div>
        </div>
      </div>

      {/* Recently Added Documents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recently Added Documents
          </h3>
          <button
            onClick={() => onNavigate('documents')}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            View all ({documents.length})
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <div className="p-8 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-500">
            No documents uploaded yet. Upload lecture notes or PDFs to get started.
          </div>
        ) : (
          <div className="rounded-lg bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-[10px] font-mono text-slate-600 uppercase font-semibold shrink-0">
                    {doc.file_type}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {doc.filename}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{doc.chunk_count} chunks</span>
                      <span>·</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span
                    className={`font-medium ${
                      doc.linked ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {doc.linked ? 'Active' : 'Unlinked'}
                  </span>
                  <button
                    onClick={() => onNavigate('chat')}
                    className="text-slate-500 hover:text-slate-900 p-1"
                    title="Ask question"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
