/**
 * Web Search API Service
 * Interacts with /api/search/web
 */

import { apiPost } from './client.ts';
import type { WebSearchRequest, WebSearchResponse } from '../types/index.ts';

export async function searchWeb(payload: WebSearchRequest): Promise<WebSearchResponse> {
  return await apiPost<WebSearchResponse>('/api/search/web', payload);
}
