import React, { useState } from 'react';
import {
  FileText,
  Globe,
  Search,
  Copy,
  Check,
  ChevronRight,
  GitCompare,
  SearchCheck,
} from 'lucide-react';
import type { ChatMessageRecord, DocumentSource } from '../../types/index.ts';
import { useApp } from '../../context/AppContext.tsx';

interface ChatMessageProps {
  message: ChatMessageRecord;
  onSelectSources?: () => void;
}

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function renderMarkdownContent(content: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listKind: "ordered" | "unordered" | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ").trim();
      blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(text, `p-${blocks.length}`)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!listKind || !listItems.length) return;
    const items = listItems.map((item, index) => (
      <li key={`li-${index}`}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>
    ));
    blocks.push(listKind === "ordered"
      ? <ol key={`ol-${blocks.length}`} className="list-decimal pl-5 space-y-1">{items}</ol>
      : <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1">{items}</ul>);
    listItems = [];
    listKind = null;
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const title = renderInlineMarkdown(heading[2], `h-${blocks.length}`);
      blocks.push(level === 1
        ? <h2 key={`h-${blocks.length}`} className="text-lg font-semibold">{title}</h2>
        : level === 2
          ? <h3 key={`h-${blocks.length}`} className="text-base font-semibold">{title}</h3>
          : <h4 key={`h-${blocks.length}`} className="font-semibold">{title}</h4>);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextKind = unordered ? "unordered" : "ordered";
      if (listKind && listKind !== nextKind) flushList();
      listKind = nextKind;
      listItems.push((unordered || ordered)![1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSelectSources }) => {
  const { openEvidence } = useApp();
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const isGrounded = message.is_grounded !== false;
  const isNotFound =
    !isUser &&
    (!isGrounded ||
      message.content.includes("I couldn't find this information in your uploaded documents") ||
      message.content.includes("I couldn't find enough information about this in your currently selected study material"));

  const documentSources: DocumentSource[] = message.document_sources || [];
  const webSources = message.web_sources || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-2xl bg-slate-900 text-white rounded-lg px-4 py-3 shadow-xs">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
          {message.mode && message.mode !== 'ask' && (
            <div className="mt-1 pt-1 border-t border-slate-700/60 text-[10px] text-slate-300 font-mono">
              Mode: {message.mode}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-6">
      <div className="w-full max-w-3xl space-y-3">
        {/* Anti-Hallucination Guarded State */}
        {isNotFound ? (
          <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                <Search className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                  Not Found in Your Documents
                </div>
                <p className="text-sm text-amber-900 leading-relaxed">
                  I couldn't find enough information about this in your currently selected study material.
                </p>
                <p className="text-xs text-amber-800/80 leading-normal">
                  To prevent factual inaccuracies, answers are strictly constrained to your linked notes. Link additional documents in Knowledge Scope, or enable Web Search.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Answer Card */
          <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-xs space-y-3 text-slate-900">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">
                  StudyVault Answer
                </span>
                {message.mode && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 capitalize">
                      {message.mode} mode
                    </span>
                  </>
                )}
                {message.fallback_used && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    deterministic fallback
                  </span>
                )}
              </div>

              <button
                onClick={handleCopy}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                title="Copy answer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Answer Content */}
            <div className="text-sm leading-relaxed text-slate-800 font-sans space-y-2">
              {renderMarkdownContent(message.content)}
            </div>

            {/* Compare mode structured view if returned */}
            {message.mode === 'compare' && message.structured_data && (
              <div className="mt-3 p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <GitCompare className="w-3.5 h-3.5 text-slate-700" />
                  <span>Comparison Breakdown</span>
                </div>
                <pre className="p-2.5 rounded bg-white border border-slate-200 font-mono text-xs overflow-x-auto text-slate-700">
                  {typeof message.structured_data === 'string'
                    ? message.structured_data
                    : JSON.stringify(message.structured_data, null, 2)}
                </pre>
              </div>
            )}

            {/* Evidence Mode Layout */}
            {message.mode === 'evidence' && documentSources.length > 0 && (
              <div className="mt-3 p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <SearchCheck className="w-3.5 h-3.5 text-slate-700" />
                  <span>Direct Source Quotes</span>
                </div>
                <div className="space-y-2">
                  {documentSources.map((src, i) => (
                    <div
                      key={i}
                      className="p-3 rounded bg-white border border-slate-200 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 truncate">{src.filename}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          Page {src.page_number} · {Math.round(src.relevance_score > 1 ? src.relevance_score : src.relevance_score * 100)}% match
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 italic">"{src.snippet}"</p>
                      <button
                        onClick={() =>
                          openEvidence({
                            documentId: src.document_id,
                            chunkId: src.chunk_id,
                            documentName: src.filename,
                            pageNumber: src.page_number,
                            snippet: src.snippet,
                            relevance: src.relevance_score,
                          })
                        }
                        className="text-[11px] text-blue-700 hover:underline font-medium inline-flex items-center gap-1 pt-1"
                      >
                        Inspect passage <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline Sources Bar */}
            {documentSources.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Supporting Passages ({documentSources.length})</span>
                  </div>
                  {onSelectSources && (
                    <button
                      onClick={onSelectSources}
                      className="text-xs text-blue-700 hover:underline font-medium"
                    >
                      View in Panel
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {documentSources.slice(0, 4).map((source, idx) => {
                    const relevancePct = Math.round(
                      source.relevance_score > 1
                        ? source.relevance_score
                        : source.relevance_score * 100
                    );

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-900 truncate">
                            {source.filename}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>Page {source.page_number}</span>
                            <span>·</span>
                            <span className="font-mono">{relevancePct}% match</span>
                          </div>
                        </div>

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
                          className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 whitespace-nowrap"
                        >
                          Evidence
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Web sources inline */}
            {webSources.length > 0 && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Web References ({webSources.length})</span>
                </div>
                <div className="space-y-1">
                  {webSources.slice(0, 2).map((web, idx) => (
                    <a
                      key={idx}
                      href={web.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-blue-700 hover:underline truncate"
                    >
                      • {web.title || web.url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
