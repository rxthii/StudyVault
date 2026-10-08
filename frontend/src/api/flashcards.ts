/**
 * Flashcards API Service
 * Interacts with /api/flashcards/*
 */

import { apiDelete, apiGet, apiPost } from './client.ts';
import type {
  FlashcardGenerateRequest,
  FlashcardSet,
  ReviewStatus,
} from '../types/index.ts';

export async function generateFlashcards(
  payload: FlashcardGenerateRequest
): Promise<FlashcardSet> {
  return await apiPost<FlashcardSet>('/api/flashcards/generate', payload);
}

export async function getFlashcardSets(): Promise<FlashcardSet[]> {
  return await apiGet<FlashcardSet[]>('/api/flashcards');
}

export async function getFlashcardSetById(setId: string): Promise<FlashcardSet> {
  return await apiGet<FlashcardSet>(`/api/flashcards/${setId}`);
}

export async function deleteFlashcardSet(
  setId: string
): Promise<{ message: string; success: boolean }> {
  return await apiDelete<{ message: string; success: boolean }>(`/api/flashcards/${setId}`);
}

export async function reviewFlashcard(
  cardId: string,
  status: ReviewStatus
): Promise<{ card_id: string; review_status: ReviewStatus; message: string }> {
  return await apiPost<{ card_id: string; review_status: ReviewStatus; message: string }>(
    `/api/flashcards/${cardId}/review`,
    { status }
  );
}
