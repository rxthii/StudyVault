import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Link2,
  Link2Off,
  Search,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileUp,
  Loader2,
  Info,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { uploadDocuments, deleteDocument, getDocumentContent } from '../api/documents.ts';
import type { DocumentContentResponse, DocumentItem } from '../types/index.ts';

export const DocumentsPage: React.FC = () => {
  const {
    documents,
    loadingDocuments,
    refreshDocuments,
    toggleDocumentLink,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [selectedDocContent, setSelectedDocContent] = useState<DocumentContentResponse | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const invalidFiles = files.filter(
      (f) => !f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().endsWith('.txt')
    );
    if (invalidFiles.length > 0) {
      showToast('error', 'Only PDF and TXT documents are supported.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgressText(`Uploading and chunking ${files.length} document(s)...`);
      const res = await uploadDocuments(files);

      if (res.failed_count > 0) {
        showToast(
          'error',
          `${res.failed_count} file(s) failed: ${res.documents.find((d) => d.error_message)?.error_message || 'Processing failed'}`
        );
      } else {
        showToast('success', res.message || `Processed ${files.length} files successfully.`);
      }

      await refreshDocuments();
    } catch (err: any) {
      showToast('error', err.message || 'File upload failed. Ensure backend is running.');
    } finally {
      setUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await deleteDocument(docId);
      if (res.success) {
        showToast('success', 'Document deleted permanently.');
        await refreshDocuments();
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete document.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleViewContent = async (docId: string) => {
    try {
      const content = await getDocumentContent(docId);
      setSelectedDocContent(content);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch document chunks.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterState === 'linked') return doc.linked;
    if (filterState === 'unlinked') return !doc.linked;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        id="vault-file-input"
        type="file"
        multiple
        accept=".pdf,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Knowledge Library
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage course notes, research papers, and textbook chapters.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors shadow-xs"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{uploadProgressText || 'Uploading...'}</span>
            </>
          ) : (
            <>
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload PDF / TXT</span>
            </>
          )}
        </button>
      </div>

      {/* Unlink != Delete Clarification */}
      <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <strong className="text-slate-900 font-semibold">Distinction: Unlink ≠ Delete</strong>
          <p className="text-slate-600 leading-normal">
            <strong>Unlinking</strong> leaves your document indexed in the library, but excludes it from search queries. <strong>Deleting</strong> permanently removes the file, chunks, and vector embeddings from storage.
          </p>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) {
            const files = Array.from(e.dataTransfer.files);
            if (fileInputRef.current) {
              const dt = new DataTransfer();
              files.forEach((f) => dt.items.add(f));
              fileInputRef.current.files = dt.files;
              handleFileChange({ target: fileInputRef.current } as any);
            }
          }
        }}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors bg-white ${
          uploading
            ? 'border-slate-400 bg-slate-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="max-w-md mx-auto space-y-1.5">
          <Upload className="w-5 h-5 text-slate-500 mx-auto" />
          <div className="text-xs font-semibold text-slate-900">
            {uploading ? uploadProgressText || 'Processing files...' : 'Click to upload or drag files here'}
          </div>
          <p className="text-[11px] text-slate-500">
            Accepts PDF and TXT up to 25 MB. Automatically extracts text and creates vector chunks.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-800"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200 w-full sm:w-auto">
          {(['all', 'linked', 'unlinked'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterState(tab)}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                filterState === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? `All (${documents.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {loadingDocuments ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-slate-700 mb-2" />
          <span className="text-xs">Loading library...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-10 text-center rounded-lg bg-white border border-slate-200">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <div className="text-xs font-semibold text-slate-800">No documents found</div>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No documents match "${searchQuery}".`
              : 'Your library is empty. Upload your first PDF or lecture notes.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc: DocumentItem) => {
            const isReady = doc.status === 'ready';
            const isFailed = doc.status === 'failed';
            const isProcessing = doc.status === 'processing';

            return (
              <div
                key={doc.id}
                className="p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-mono uppercase font-semibold text-[10px] text-slate-600">
                      {doc.file_type}
                    </span>

                    <div className="flex items-center gap-1 text-[11px]">
                      {isReady ? (
                        <span className="text-emerald-700 font-medium">Ready</span>
                      ) : isProcessing ? (
                        <span className="text-amber-700 font-medium">Processing...</span>
                      ) : isFailed ? (
                        <span className="text-rose-700 font-medium">Failed</span>
                      ) : (
                        <span className="text-slate-500 capitalize">{doc.status}</span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900 truncate" title={doc.filename}>
                    {doc.filename}
                  </h3>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span className="font-mono tabular-nums">{formatFileSize(doc.file_size)}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{doc.chunk_count} chunks</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>

                  {doc.error_message && (
                    <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                      {doc.error_message}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => toggleDocumentLink(doc.id, doc.linked)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      doc.linked
                        ? 'bg-emerald-50 text-emerald-800 hover:bg-slate-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={
                      doc.linked
                        ? 'Click to Unlink (preserves file, excludes from search)'
                        : 'Click to Link (includes in active retrieval)'
                    }
                  >
                    {doc.linked ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <Link2Off className="w-3.5 h-3.5" />
                        <span>Unlinked</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleViewContent(doc.id)}
                      className="p-1 text-slate-500 hover:text-slate-900 rounded"
                      title="Inspect extracted chunks"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(doc.id)}
                      className="p-1 text-slate-500 hover:text-rose-700 rounded"
                      title="Permanently delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-900">Delete Document Permanently?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This purges the file, database records, and Pinecone vectors permanently. If you only want to exclude it from future AI answers, use <strong className="text-slate-900">Unlink</strong> instead.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3.5 py-1.5 rounded text-xs font-medium text-white bg-rose-600 hover:bg-rose-500"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Chunks Modal */}
      {selectedDocContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 truncate max-w-md">
                  {selectedDocContent.filename}
                </h3>
                <div className="text-xs text-slate-500 font-mono">
                  {selectedDocContent.total_chunks} extracted vector chunks
                </div>
              </div>
              <button
                onClick={() => setSelectedDocContent(null)}
                className="p-1 text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {selectedDocContent.chunks.map((chunk, index) => (
                <div
                  key={chunk.chunk_id || index}
                  className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="font-semibold text-slate-700">Page {chunk.page_number}</span>
                    <span className="truncate max-w-xs">{chunk.chunk_id}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                    {chunk.snippet}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDocContent(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
