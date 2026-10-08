/**
 * Chat API Service
 * Interacts with /api/chat/*
 */

import { apiDelete, apiGet, apiPost, getApiBaseUrl, StudyVaultApiError } from './client.ts';
import type {
  ChatHistoryResponse,
  ChatRequest,
  ChatResponse,
  ChatStreamDonePayload,
} from '../types/index.ts';

export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  return await apiPost<ChatResponse>('/api/chat', payload);
}

export function streamChatMessage(
  payload: ChatRequest,
  onToken: (token: string) => void,
  onDone: (doneData: ChatStreamDonePayload) => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController();
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/chat/stream`;

  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = `Server error ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) errorMsg = errJson.error.message;
          else if (errJson?.detail) errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        } catch {
          // ignore parsing error
        }
        throw new StudyVaultApiError(errorMsg, 'STREAM_ERROR', response.status);
      }

      if (!response.body) {
        throw new StudyVaultApiError('No response body received from stream', 'STREAM_EMPTY', response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr) {
                try {
                  const data = JSON.parse(jsonStr);
                  if (data.type === 'token') {
                    onToken(data.text);
                  } else if (data.type === 'done') {
                    onDone(data as ChatStreamDonePayload);
                  }
                } catch {
                  // Ignore JSON parse error on malformed chunks
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Stream aborted by user
        return;
      }
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => {
    controller.abort();
  };
}

export async function getChatHistory(conversationId: string): Promise<ChatHistoryResponse> {
  return await apiGet<ChatHistoryResponse>(`/api/chat/history/${conversationId}`);
}

export async function deleteChatHistory(
  conversationId: string
): Promise<{ message: string; success: boolean }> {
  return await apiDelete<{ message: string; success: boolean }>(`/api/chat/history/${conversationId}`);
}
