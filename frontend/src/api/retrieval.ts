/**
 * Retrieval API Service
 * Interacts with /api/retrieval/*
 */

import { apiGet, apiPost } from './client.ts';
import type {
  RetrievalSearchRequest,
  RetrievalSearchResponse,
  RetrievalStatsResponse,
} from '../types/index.ts';

export async function searchRetrieval(
  payload: RetrievalSearchRequest
): Promise<RetrievalSearchResponse> {
  return await apiPost<RetrievalSearchResponse>('/api/retrieval/search', payload);
}

export async function getRetrievalStats(): Promise<RetrievalStatsResponse> {
  return await apiGet<RetrievalStatsResponse>('/api/retrieval/stats');
}
