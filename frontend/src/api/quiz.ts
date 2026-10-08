/**
 * Quiz API Service
 * Interacts with /api/quiz/*
 */

import { apiGet, apiPost } from './client.ts';
import type {
  Quiz,
  QuizGenerateRequest,
  QuizSubmitResponse,
} from '../types/index.ts';

export async function generateQuiz(payload: QuizGenerateRequest): Promise<Quiz> {
  return await apiPost<Quiz>('/api/quiz/generate', payload);
}

export async function getQuizById(quizId: string): Promise<Quiz> {
  return await apiGet<Quiz>(`/api/quiz/${quizId}`);
}

export async function submitQuiz(
  quizId: string,
  answers: Record<string, string>
): Promise<QuizSubmitResponse> {
  return await apiPost<QuizSubmitResponse>(`/api/quiz/${quizId}/submit`, { answers });
}
