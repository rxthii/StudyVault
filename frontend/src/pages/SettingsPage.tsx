import React, { useState } from 'react';
import {
  Server,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Globe,
  Cpu,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

export const SettingsPage: React.FC = () => {
  const {
    healthStatus,
    systemStatus,
    refreshHealth,
    apiBaseUrl,
    updateApiBaseUrl,
    resetApiBaseUrlToDefault,
    showToast,
  } = useApp();

  const [inputUrl, setInputUrl] = useState(apiBaseUrl);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    updateApiBaseUrl(inputUrl.trim());
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      await refreshHealth();
      showToast('info', 'Pinged backend health endpoint.');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Settings & System Status
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          FastAPI backend connectivity, database integrity, and vector search status.
        </p>
      </div>

      {/* Backend Connection Status Banner */}
      <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-slate-100 text-slate-700 shrink-0">
            {healthStatus === 'connected' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : healthStatus === 'checking' ? (
              <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600" />
            )}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span>
                {healthStatus === 'connected'
                  ? 'FastAPI Backend Connected'
                  : healthStatus === 'checking'
                  ? 'Verifying Backend...'
                  : 'Backend Offline'}
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                  healthStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-rose-50 text-rose-800'
                }`}
              >
                {healthStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Target address: <code className="font-mono text-slate-700">{apiBaseUrl}</code>
            </p>
          </div>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testingConnection}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shrink-0 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
          <span>Ping /api/health</span>
        </button>
      </div>

      {/* Backend Services Inventory Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Component Health (/api/status)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SQLite Database */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Database className="w-4 h-4 text-slate-600" />
                <span>Relational Database</span>
              </div>
              <span className="font-mono text-slate-600 text-[11px]">
                {systemStatus?.database?.type ?? 'SQLite'}
              </span>
            </div>
            <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Status</span>
                <span className="font-mono text-emerald-700 font-medium capitalize">
                  {systemStatus?.database?.status ?? (healthStatus === 'connected' ? 'connected' : 'offline')}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Storage</span>
                <span className="text-slate-700">Local persistent SQLite</span>
              </div>
            </div>
          </div>

          {/* Pinecone Vector Index */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>Vector Index</span>
              </div>
              <span className="font-mono text-slate-600 text-[11px]">
                {systemStatus?.pinecone?.index_name ?? 'studyvault'}
              </span>
            </div>
            <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Dimension</span>
                <span className="font-mono text-slate-700">
                  {systemStatus?.pinecone?.dimension ?? 1024}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Total Vectors</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {systemStatus?.pinecone?.total_vectors ?? '—'}
                </span>
              </div>
            </div>
          </div>

          {/* LLM Engine */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Cpu className="w-4 h-4 text-slate-600" />
                <span>Model Pipeline</span>
              </div>
              <span className="font-mono text-slate-600 text-[11px]">
                {systemStatus?.llm_configuration?.provider ?? 'OpenRouter'}
              </span>
            </div>
            <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Model</span>
                <span className="font-mono text-slate-700">
                  {systemStatus?.llm_configuration?.model ?? 'Configured in backend'}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">API Credentials</span>
                <span className="text-slate-700">Managed by server</span>
              </div>
            </div>
          </div>

          {/* Web Search Provider */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Globe className="w-4 h-4 text-slate-600" />
                <span>Search Provider</span>
              </div>
              <span className="font-mono text-slate-600 text-[11px]">
                {systemStatus?.web_search_configuration?.provider ?? 'DuckDuckGo'}
              </span>
            </div>
            <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Search Mode</span>
                <span className="text-slate-700">Off by default (grounded only)</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">External Fallback</span>
                <span className="text-slate-700">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Base URL Configuration Form */}
      <div className="p-5 rounded-lg bg-white border border-slate-200 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Server className="w-4 h-4 text-slate-600" />
            <span>FastAPI Server Address</span>
          </div>
          <button
            onClick={() => {
              resetApiBaseUrlToDefault();
              setInputUrl('http://127.0.0.1:8000');
            }}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default</span>
          </button>
        </div>

        <form onSubmit={handleSaveUrl} className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="flex-1 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-800"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shrink-0"
            >
              Update URL
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Configured in <code>.env</code> via <code>VITE_API_BASE_URL</code>.
          </p>
        </form>
      </div>

      {/* Security Architecture Statement */}
      <div className="p-4 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 leading-relaxed">
        <strong className="text-slate-900 font-semibold block mb-0.5">Security Architecture:</strong>
        This frontend does not store or process third-party API keys. Pinecone and OpenRouter credentials remain safely enclosed within your local Python FastAPI backend.
      </div>
    </div>
  );
};
