import React from 'react';
import {
  BookOpen,
  CheckSquare,
  Square,
  Link2,
  Link2Off,
  Plus,
  Info,
  FileText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { DocumentItem } from '../../types/index.ts';

interface KnowledgeScopeProps {
  onNavigateToDocuments: () => void;
}

export const KnowledgeScope: React.FC<KnowledgeScopeProps> = ({ onNavigateToDocuments }) => {
  const {
    documents,
    activeDocuments,
    selectedScopeIds,
    toggleScopeSelection,
    selectAllScope,
    clearAllScope,
    toggleDocumentLink,
  } = useApp();

  return (
    <div className="w-full flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Knowledge Scope
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-medium">
            {selectedScopeIds.length === 0
              ? `All (${activeDocuments.length})`
              : `${selectedScopeIds.length}/${activeDocuments.length}`}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Select documents that ground answers.
        </p>

        {/* Quick select controls */}
        {activeDocuments.length > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <button
              onClick={selectAllScope}
              className="text-slate-900 hover:underline font-medium"
            >
              Select All
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={clearAllScope}
              className="text-slate-500 hover:text-slate-800"
            >
              Default (All Active)
            </button>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {documents.length === 0 ? (
          <div className="text-center py-8 px-3">
            <FileText className="w-7 h-7 text-slate-400 mx-auto mb-2" />
            <div className="text-xs font-medium text-slate-700 mb-1">No Documents Uploaded</div>
            <p className="text-[11px] text-slate-500 mb-3 leading-normal">
              Upload study files to begin asking grounded questions.
            </p>
            <button
              onClick={onNavigateToDocuments}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
          </div>
        ) : (
          documents.map((doc: DocumentItem) => {
            const isReady = doc.status === 'ready';
            const isLinked = doc.linked && isReady;
            const isSelected = selectedScopeIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                className={`p-2 rounded-md border text-xs transition-all ${
                  !isLinked
                    ? 'bg-slate-50/60 border-slate-200/60 text-slate-400 opacity-70'
                    : isSelected || selectedScopeIds.length === 0
                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => isLinked && toggleScopeSelection(doc.id)}
                    disabled={!isLinked}
                    className="mt-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 shrink-0"
                    title={isSelected ? 'Remove from scope' : 'Filter to this document'}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-slate-900" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-slate-900" title={doc.filename}>
                      {doc.filename}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                      <span className="uppercase font-mono">{doc.file_type}</span>
                      <span>·</span>
                      <span className="font-mono">{doc.chunk_count} chunks</span>
                      <span>·</span>
                      <span
                        className={
                          isLinked
                            ? 'text-emerald-700 font-medium'
                            : 'text-slate-400'
                        }
                      >
                        {isLinked ? 'Active' : 'Unlinked'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleDocumentLink(doc.id, doc.linked)}
                    title={doc.linked ? 'Unlink from retrieval' : 'Link to active retrieval'}
                    className={`p-1 rounded text-slate-400 hover:text-slate-700 transition-colors ${
                      doc.linked ? 'hover:bg-slate-200' : 'hover:bg-slate-200'
                    }`}
                  >
                    {doc.linked ? (
                      <Link2 className="w-3.5 h-3.5 text-slate-700" />
                    ) : (
                      <Link2Off className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Distinction footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700">Unlink ≠ Delete:</strong> Keeps document safely in library, but excludes it from search queries.
        </p>
      </div>
    </div>
  );
};
