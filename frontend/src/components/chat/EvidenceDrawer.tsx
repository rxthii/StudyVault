import React, { useEffect, useState } from 'react';
import { X, FileText, CheckCircle2, Loader2, BookOpen } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { getSourceChunk } from '../../api/sources.ts';
import { getDocumentPage } from '../../api/documents.ts';
import type { DocumentPageResponse, SourceChunkDetail } from '../../types/index.ts';

export const EvidenceDrawer: React.FC = () => {
  const { activeEvidence, closeEvidence } = useApp();
  const [loading, setLoading] = useState<boolean>(false);
  const [chunkDetail, setChunkDetail] = useState<SourceChunkDetail | null>(null);
  const [pageData, setPageData] = useState<DocumentPageResponse | null>(null);
  const [viewMode, setViewMode] = useState<'snippet' | 'full_page'>('snippet');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEvidence) {
      setChunkDetail(null);
      setPageData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadEvidence = async () => {
      try {
        const promises: [Promise<any>, Promise<any>] = [
          getSourceChunk(activeEvidence.documentId, activeEvidence.chunkId).catch(() => null),
          activeEvidence.pageNumber !== undefined
            ? getDocumentPage(activeEvidence.documentId, activeEvidence.pageNumber).catch(() => null)
            : Promise.resolve(null),
        ];

        const [chunkRes, pageRes] = await Promise.all(promises);

        if (isMounted) {
          setChunkDetail(chunkRes);
          setPageData(pageRes);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unable to load chunk details from server.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEvidence();

    return () => {
      isMounted = false;
    };
  }, [activeEvidence]);

  if (!activeEvidence) return null;

  const relevancePct = activeEvidence.relevance !== undefined
    ? Math.round(activeEvidence.relevance > 1 ? activeEvidence.relevance : activeEvidence.relevance * 100)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={closeEvidence}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-slate-100 text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-md">
                  {activeEvidence.documentName || 'Document Citation'}
                </h3>
                {relevancePct !== null && (
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                    {relevancePct}% match
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Page {activeEvidence.pageNumber ?? 1} · Chunk {activeEvidence.chunkId}
              </div>
            </div>
          </div>
          <button
            onClick={closeEvidence}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-slate-200 text-xs">
          <span className="text-slate-600 font-medium">Inspection View:</span>
          <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-md">
            <button
              onClick={() => setViewMode('snippet')}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                viewMode === 'snippet'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exact Passage
            </button>
            <button
              onClick={() => setViewMode('full_page')}
              disabled={!pageData}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                viewMode === 'full_page'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
              }`}
            >
              Surrounding Page
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-slate-700 mb-2" />
              <span className="text-xs">Fetching passage details from server...</span>
            </div>
          ) : viewMode === 'snippet' ? (
            <div className="space-y-3">
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed font-sans select-text">
                <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Grounded Text Snippet
                </div>
                <p className="whitespace-pre-wrap">
                  {chunkDetail?.snippet || activeEvidence.snippet || 'No snippet text available.'}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-100 border border-slate-200 text-xs text-slate-600 leading-normal">
                This exact text chunk was retrieved from vector storage to ground the response.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Page {pageData?.page_number} Content</span>
                <span className="font-mono">{pageData?.chunk_count} chunk(s)</span>
              </div>
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap select-text">
                {pageData?.content || 'No page content available.'}
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-2.5 border-t border-slate-100 bg-white">
          <button
            onClick={closeEvidence}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
