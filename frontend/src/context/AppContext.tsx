/**
 * AppContext
 * Global application state for StudyVault
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { DocumentItem, StatusResponse } from '../types/index.ts';
import { getDocuments, linkDocument } from '../api/documents.ts';
import { getHealth, getSystemStatus } from '../api/status.ts';
import { getApiBaseUrl, setApiBaseUrl as saveApiBaseUrl, resetApiBaseUrl as clearApiBaseUrl } from '../api/client.ts';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface EvidenceViewerState {
  documentId: string;
  chunkId: string;
  documentName?: string;
  pageNumber?: number;
  snippet?: string;
  relevance?: number;
}

interface AppContextType {
  documents: DocumentItem[];
  activeDocuments: DocumentItem[];
  selectedScopeIds: string[];
  loadingDocuments: boolean;
  refreshDocuments: () => Promise<void>;
  toggleDocumentLink: (documentId: string, currentLinked: boolean) => Promise<boolean>;
  toggleScopeSelection: (documentId: string) => void;
  selectAllScope: () => void;
  clearAllScope: () => void;
  
  healthStatus: 'connected' | 'offline' | 'checking';
  systemStatus: StatusResponse | null;
  refreshHealth: () => Promise<void>;
  
  apiBaseUrl: string;
  updateApiBaseUrl: (newUrl: string) => void;
  resetApiBaseUrlToDefault: () => void;
  
  activeEvidence: EvidenceViewerState | null;
  openEvidence: (state: EvidenceViewerState) => void;
  closeEvidence: () => void;
  
  toast: ToastMessage | null;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  dismissToast: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(true);
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [healthStatus, setHealthStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [systemStatus, setSystemStatus] = useState<StatusResponse | null>(null);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(getApiBaseUrl());
  const [activeEvidence, setActiveEvidence] = useState<EvidenceViewerState | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      setHealthStatus('checking');
      await getHealth();
      setHealthStatus('connected');
      try {
        const status = await getSystemStatus();
        setSystemStatus(status);
      } catch {
        // System status optional if health is ok
      }
    } catch {
      setHealthStatus('offline');
      setSystemStatus(null);
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err: any) {
      // Don't show toast if simply offline on first mount
      if (healthStatus === 'connected') {
        showToast('error', err.message || 'Failed to fetch documents.');
      }
    } finally {
      setLoadingDocuments(false);
    }
  }, [healthStatus, showToast]);

  useEffect(() => {
    refreshHealth();
    refreshDocuments();
  }, [refreshHealth, refreshDocuments]);

  // Periodic health check every 25 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshHealth();
    }, 25000);
    return () => clearInterval(interval);
  }, [refreshHealth]);

  const activeDocuments = useMemo(() => {
    return documents.filter((doc) => doc.linked && doc.status === 'ready');
  }, [documents]);

  const toggleDocumentLink = useCallback(async (documentId: string, currentLinked: boolean): Promise<boolean> => {
    try {
      const nextLinked = !currentLinked;
      await linkDocument(documentId, nextLinked);
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, linked: nextLinked } : d))
      );
      showToast(
        'success',
        nextLinked
          ? 'Document linked to active knowledge scope.'
          : 'Document unlinked (excluded from retrieval, safe in library).'
      );
      return true;
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update document link status.');
      return false;
    }
  }, [showToast]);

  const toggleScopeSelection = useCallback((documentId: string) => {
    setSelectedScopeIds((prev) => {
      if (prev.includes(documentId)) {
        return prev.filter((id) => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  }, []);

  const selectAllScope = useCallback(() => {
    setSelectedScopeIds(activeDocuments.map((d) => d.id));
  }, [activeDocuments]);

  const clearAllScope = useCallback(() => {
    setSelectedScopeIds([]);
  }, []);

  const updateApiBaseUrl = useCallback((newUrl: string) => {
    saveApiBaseUrl(newUrl);
    setApiBaseUrlState(newUrl);
    showToast('info', `API Base URL updated to ${newUrl}`);
    refreshHealth();
    refreshDocuments();
  }, [showToast, refreshHealth, refreshDocuments]);

  const resetApiBaseUrlToDefault = useCallback(() => {
    clearApiBaseUrl();
    const def = getApiBaseUrl();
    setApiBaseUrlState(def);
    showToast('info', `API Base URL reset to default (${def})`);
    refreshHealth();
    refreshDocuments();
  }, [showToast, refreshHealth, refreshDocuments]);

  const openEvidence = useCallback((state: EvidenceViewerState) => {
    setActiveEvidence(state);
  }, []);

  const closeEvidence = useCallback(() => {
    setActiveEvidence(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        documents,
        activeDocuments,
        selectedScopeIds,
        loadingDocuments,
        refreshDocuments,
        toggleDocumentLink,
        toggleScopeSelection,
        selectAllScope,
        clearAllScope,
        healthStatus,
        systemStatus,
        refreshHealth,
        apiBaseUrl,
        updateApiBaseUrl,
        resetApiBaseUrlToDefault,
        activeEvidence,
        openEvidence,
        closeEvidence,
        toast,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
