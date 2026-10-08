/**
 * Documents API Service
 * Interacts with /api/documents/*
 */

import { apiDelete, apiGet, apiPatch, apiUploadFiles } from './client.ts';
import type {
  DocumentContentResponse,
  DocumentItem,
  DocumentPageResponse,
  UploadResponse,
} from '../types/index.ts';

export async function uploadDocuments(files: File[]): Promise<UploadResponse> {
  return await apiUploadFiles<UploadResponse>('/api/documents/upload', files);
}

export async function getDocuments(filters?: { linked?: boolean; status?: string }): Promise<DocumentItem[]> {
  return await apiGet<DocumentItem[]>('/api/documents', filters);
}

export async function getDocumentById(documentId: string): Promise<DocumentItem> {
  return await apiGet<DocumentItem>(`/api/documents/${documentId}`);
}

export async function getDocumentContent(documentId: string): Promise<DocumentContentResponse> {
  return await apiGet<DocumentContentResponse>(`/api/documents/${documentId}/content`);
}

export async function linkDocument(
  documentId: string,
  linked: boolean
): Promise<{ document_id: string; linked: boolean; message: string }> {
  return await apiPatch<{ document_id: string; linked: boolean; message: string }>(
    `/api/documents/${documentId}/link`,
    { linked }
  );
}

export async function deleteDocument(
  documentId: string
): Promise<{ message: string; success: boolean }> {
  return await apiDelete<{ message: string; success: boolean }>(`/api/documents/${documentId}`);
}

export async function getDocumentPage(
  documentId: string,
  pageNumber: number
): Promise<DocumentPageResponse> {
  return await apiGet<DocumentPageResponse>(`/api/documents/${documentId}/page/${pageNumber}`);
}
