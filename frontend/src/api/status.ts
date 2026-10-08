/**
 * Health & System Status API Service
 * Interacts with /api/health and /api/status
 */

import { apiGet } from './client.ts';
import type { HealthResponse, StatusResponse } from '../types/index.ts';

export async function getHealth(): Promise<HealthResponse> {
  return await apiGet<HealthResponse>('/api/health');
}

export async function getSystemStatus(): Promise<StatusResponse> {
  return await apiGet<StatusResponse>('/api/status');
}
