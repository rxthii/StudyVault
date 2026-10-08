/**
 * Centralized API Client for StudyVault
 * Communicates with the FastAPI backend at http://127.0.0.1:8000
 */

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const ACCESS_TOKEN_KEY = 'studyvault_access_token';

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY); } catch { return null; }
}

export function setAccessToken(token: string): void {
  try { localStorage.setItem(ACCESS_TOKEN_KEY, token); } catch { /* Ignore storage issues */ }
}

export function clearAccessToken(): void {
  try { localStorage.removeItem(ACCESS_TOKEN_KEY); } catch { /* Ignore storage issues */ }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class StudyVaultApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'StudyVaultApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function getApiBaseUrl(): string {
  try {
    const saved = localStorage.getItem('studyvault_api_base_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // Fall back to default if localStorage is disabled
  }
  return DEFAULT_BASE_URL.replace(/\/+$/, '');
}

export function setApiBaseUrl(url: string): void {
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (cleaned) {
      localStorage.setItem('studyvault_api_base_url', cleaned);
    } else {
      localStorage.removeItem('studyvault_api_base_url');
    }
  } catch {
    // Ignore storage issues
  }
}

export function resetApiBaseUrl(): void {
  try {
    localStorage.removeItem('studyvault_api_base_url');
  } catch {
    // Ignore storage issues
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (data && typeof data === 'object') {
      if (data.error) {
        throw new StudyVaultApiError(
          data.error.message || `Request failed with code ${data.error.code}`,
          data.error.code || 'API_ERROR',
          response.status,
          data.error.details
        );
      }
      if (data.detail) {
        const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        throw new StudyVaultApiError(msg, 'VALIDATION_ERROR', response.status, data.detail);
      }
    }

    throw new StudyVaultApiError(
      `Server returned ${response.status} ${response.statusText}`,
      'HTTP_ERROR',
      response.status
    );
  }

  return data as T;
}

export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...authHeaders(),
      },
    });
    return await handleResponse<T>(response);
  } catch (err: any) {
    if (err instanceof StudyVaultApiError) throw err;
    throw new StudyVaultApiError(
      err.message || 'Unable to connect to StudyVault backend. Verify the FastAPI server is running.',
      'NETWORK_ERROR',
      0
    );
  }
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return await handleResponse<T>(response);
  } catch (err: any) {
    if (err instanceof StudyVaultApiError) throw err;
    throw new StudyVaultApiError(
      err.message || 'Unable to connect to StudyVault backend.',
      'NETWORK_ERROR',
      0
    );
  }
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    return await handleResponse<T>(response);
  } catch (err: any) {
    if (err instanceof StudyVaultApiError) throw err;
    throw new StudyVaultApiError(
      err.message || 'Unable to connect to StudyVault backend.',
      'NETWORK_ERROR',
      0
    );
  }
}

export async function apiDelete<T>(path: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...authHeaders(),
      },
    });
    return await handleResponse<T>(response);
  } catch (err: any) {
    if (err instanceof StudyVaultApiError) throw err;
    throw new StudyVaultApiError(
      err.message || 'Unable to connect to StudyVault backend.',
      'NETWORK_ERROR',
      0
    );
  }
}

export async function apiUploadFiles<T>(path: string, files: File[]): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      // Notice: don't set Content-Type header when sending FormData; browser will set multipart boundary
      headers: {
        'Accept': 'application/json',
        ...authHeaders(),
      },
      body: formData,
    });
    return await handleResponse<T>(response);
  } catch (err: any) {
    if (err instanceof StudyVaultApiError) throw err;
    throw new StudyVaultApiError(
      err.message || 'File upload failed. Ensure the server is online.',
      'NETWORK_ERROR',
      0
    );
  }
}
