import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  StopCircle,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { KnowledgeScope } from '../components/chat/KnowledgeScope.tsx';
import { ModeSelector } from '../components/chat/ModeSelector.tsx';
import { WebSearchToggle } from '../components/chat/WebSearchToggle.tsx';
import { SourcesPanel } from '../components/chat/SourcesPanel.tsx';
import { ChatMessage } from '../components/chat/ChatMessage.tsx';
import { streamChatMessage, sendChatMessage } from '../api/chat.ts';
import type {
  ChatMessageRecord,
  ChatMode,
  DocumentSource,
  ExplanationStyle,
  SourceMode,
  WebSource,
} from '../types/index.ts';

interface ChatPageProps {
  onNavigateToDocuments: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onNavigateToDocuments }) => {
  const { activeDocuments, selectedScopeIds, healthStatus, showToast } = useApp();

  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<ChatMode>('ask');
  const [sourceMode, setSourceMode] = useState<SourceMode>('documents_only');
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>('normal');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState<boolean>(true);
  const [activeSources, setActiveSources] = useState<{
    document_sources: DocumentSource[];
    web_sources: WebSource[];
    is_grounded: boolean;
  }>({
    document_sources: [],
    web_sources: [],
    is_grounded: true,
  });

  const abortStreamRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewChat = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }
    setConversationId(null);
    setMessages([]);
    setActiveSources({ document_sources: [], web_sources: [], is_grounded: true });
    setIsLoading(false);
    showToast('info', 'Started a new session.');
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputText.trim();
    if (!query || isLoading) return;

    if (activeDocuments.length === 0 && sourceMode === 'documents_only') {
      showToast('error', 'No active documents! Link documents or enable Web Search.');
    }

    const userMsg: ChatMessageRecord = {
      id: `user-${Date.now()}`,
      conversation_id: conversationId || '',
      role: 'user',
      content: query,
      mode: currentMode,
      source_mode: sourceMode,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    const docIds = selectedScopeIds.length > 0 ? selectedScopeIds : null;

    const assistantId = `asst-${Date.now()}`;
    const initialAssistantMsg: ChatMessageRecord = {
      id: assistantId,
      conversation_id: conversationId || '',
      role: 'assistant',
      content: '',
      mode: currentMode,
      source_mode: sourceMode,
      document_sources: [],
      web_sources: [],
      is_grounded: true,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    const requestPayload = {
      query,
      conversation_id: conversationId,
      mode: currentMode,
      document_ids: docIds,
      source_mode: sourceMode,
      explanation_style: explanationStyle,
    };

    const stopStream = streamChatMessage(
      requestPayload,
      (token: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          )
        );
      },
      (doneData) => {
        setIsLoading(false);
        abortStreamRef.current = null;
        if (doneData.conversation_id) {
          setConversationId(doneData.conversation_id);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  is_grounded: doneData.is_grounded,
                  document_sources: doneData.document_sources || [],
                  web_sources: doneData.web_sources || [],
                  fallback_used: doneData.fallback_used,
                  structured_data: doneData.structured_data,
                }
              : m
          )
        );
        setActiveSources({
          document_sources: doneData.document_sources || [],
          web_sources: doneData.web_sources || [],
          is_grounded: doneData.is_grounded,
        });
      },
      async (err) => {
        abortStreamRef.current = null;
        try {
          const fallbackRes = await sendChatMessage(requestPayload);
          setIsLoading(false);
          if (fallbackRes.conversation_id) {
            setConversationId(fallbackRes.conversation_id);
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: fallbackRes.answer,
                    is_grounded: fallbackRes.is_grounded,
                    document_sources: fallbackRes.document_sources || [],
                    web_sources: fallbackRes.web_sources || [],
                    fallback_used: fallbackRes.fallback_used,
                    structured_data: fallbackRes.structured_data,
                  }
                : m
            )
          );
          setActiveSources({
            document_sources: fallbackRes.document_sources || [],
            web_sources: fallbackRes.web_sources || [],
            is_grounded: fallbackRes.is_grounded,
          });
        } catch (postErr: any) {
          setIsLoading(false);
          const errorMsg =
            healthStatus === 'offline'
              ? "Unable to reach the backend. Ensure FastAPI server is running at http://127.0.0.1:8000."
              : postErr.message || 'Error generating response.';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: errorMsg,
                    is_grounded: false,
                  }
                : m
            )
          );
          showToast('error', errorMsg);
        }
      }
    );

    abortStreamRef.current = stopStream;
  };

  const handleStopGeneration = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
      setIsLoading(false);
      showToast('info', 'Generation stopped.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden bg-slate-50">
      {/* LEFT: Knowledge Scope */}
      <div className="hidden lg:block w-64 shrink-0 h-full">
        <KnowledgeScope onNavigateToDocuments={onNavigateToDocuments} />
      </div>

      {/* CENTER: Primary Conversation Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50">
        {/* Top Chat Subheader */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WebSearchToggle
              sourceMode={sourceMode}
              onChangeSourceMode={setSourceMode}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSourcesPanel(!showSourcesPanel)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors"
            >
              {showSourcesPanel ? (
                <>
                  <PanelRightClose className="w-3.5 h-3.5" />
                  <span>Hide Sources</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  <span>Sources ({activeSources.document_sources.length})</span>
                </>
              )}
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>New Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight mb-1">
                Ask Questions Grounded in Your Documents
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Answers cite the exact page number and text snippet from your uploaded material.
              </p>

              {/* Suggested Questions */}
              <div className="w-full space-y-2 text-left">
                {[
                  'What are the core concepts outlined in my active notes?',
                  'Explain electromagnetic induction simply with step-by-step points.',
                  'Summarize the experimental methodology and findings.',
                  'Find supporting evidence and exact quotes for key definitions.',
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(sample);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="w-full text-left p-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs text-slate-700 transition-all flex items-center justify-between group shadow-xs"
                  >
                    <span>{sample}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSelectSources={() => setShowSourcesPanel(true)}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Chat Input & Controls Bar */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-2.5">
          {/* Mode Selector */}
          <ModeSelector
            currentMode={currentMode}
            onChangeMode={setCurrentMode}
            explanationStyle={explanationStyle}
            onChangeExplanationStyle={setExplanationStyle}
          />

          {/* Input Box */}
          <div className="relative flex items-end gap-2 bg-slate-50 rounded-lg border border-slate-300 focus-within:border-slate-800 focus-within:ring-1 focus-within:ring-slate-800 transition-all p-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentMode === 'compare'
                  ? 'Ask to compare concepts across your documents...'
                  : currentMode === 'evidence'
                  ? 'Query for citations, quotes, and direct evidence...'
                  : currentMode === 'summarize'
                  ? 'What study materials or chapters would you like summarized?'
                  : 'Ask a question about your documents...'
              }
              rows={1}
              className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden resize-none max-h-32 px-1.5 py-1 leading-normal"
            />

            <div className="flex items-center gap-1.5 shrink-0">
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-1.5 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
                  title="Stop generating"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className="p-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                  title="Send message (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
            <span>Press Enter to send, Shift+Enter for newline</span>
            {conversationId && (
              <span className="font-mono text-[10px] text-slate-500">
                Session {conversationId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Sources Panel */}
      {showSourcesPanel && (
        <div className="hidden md:block shrink-0 h-full">
          <SourcesPanel
            documentSources={activeSources.document_sources}
            webSources={activeSources.web_sources}
            isGrounded={activeSources.is_grounded}
            onClose={() => setShowSourcesPanel(false)}
          />
        </div>
      )}
    </div>
  );
};
