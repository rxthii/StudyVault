import React from 'react';
import {
  FileText,
  Globe,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { DocumentSource, WebSource } from '../../types/index.ts';
import { useApp } from '../../context/AppContext.tsx';

interface SourcesPanelProps {
  documentSources: DocumentSource[];
  webSources: WebSource[];
  isGrounded?: boolean;
  onClose?: () => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  documentSources,
  webSources,
  onClose,
}) => {
  const { openEvidence } = useApp();

  const hasSources = documentSources.length > 0 || webSources.length > 0;

  return (
    <div className="w-80 flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Sources & Evidence
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {documentSources.length} document · {webSources.length} web
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 p-1 rounded"
          >
            Close
          </button>
        )}
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!hasSources ? (
          <div className="text-center py-12 px-4">
            <FileText className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <div className="text-xs font-medium text-slate-700 mb-1">No Sources Cited Yet</div>
            <p className="text-[11px] text-slate-500 leading-normal">
              When StudyVault answers a query, verified passages from your study material appear here.
            </p>
          </div>
        ) : (
          <>
            {/* DOCUMENT SOURCES */}
            {documentSources.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>Document Sources</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {documentSources.length} cited
                  </span>
                </div>

                <div className="space-y-2.5">
                  {documentSources.map((source, idx) => {
                    const relevancePct = Math.round(
                      source.relevance_score > 1
                        ? source.relevance_score
                        : source.relevance_score * 100
                    );

                    return (
                      <div
                        key={`${source.document_id}-${source.chunk_id}-${idx}`}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all space-y-2 group"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-900 truncate" title={source.filename}>
                            {source.filename}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Page {source.page_number}</span>
                            <span>·</span>
                            <span className="font-mono">{relevancePct}% relevance</span>
                          </div>
                        </div>

                        {/* Snippet */}
                        <p className="text-xs text-slate-700 leading-relaxed italic line-clamp-3 bg-white p-2 rounded border border-slate-200/80">
                          "{source.snippet}"
                        </p>

                        {/* View Evidence button */}
                        <button
                          onClick={() =>
                            openEvidence({
                              documentId: source.document_id,
                              chunkId: source.chunk_id,
                              documentName: source.filename,
                              pageNumber: source.page_number,
                              snippet: source.snippet,
                              relevance: source.relevance_score,
                            })
                          }
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Inspect Full Passage</span>
                          <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEB SOURCES */}
            {webSources.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>Web Sources</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {webSources.length} cited
                  </span>
                </div>

                <div className="space-y-2">
                  {webSources.map((web, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1"
                    >
                      <a
                        href={web.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-blue-900 hover:underline line-clamp-1 flex items-center gap-1"
                      >
                        <span className="truncate">{web.title || web.url}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                      </a>
                      <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                        {web.snippet}
                      </p>
                      <div className="text-[10px] text-slate-400 truncate font-mono">
                        {web.url}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
