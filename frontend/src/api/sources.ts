/**
 * Sources & Citations API Service
 * Interacts with /api/sources/*
 */

import { apiGet } from './client.ts';
import type { SourceChunkDetail } from '../types/index.ts';

export async function getSourceChunk(
  documentId: string,
  chunkId: string
): Promise<SourceChunkDetail> {
  return await apiGet<SourceChunkDetail>(`/api/sources/${documentId}/${chunkId}`);
}
