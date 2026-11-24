import React, { useState } from 'react';
import {
  Server,
  Cpu,
  RefreshCw,
  FolderLock,
  Save,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Database,
  ExternalLink,
} from 'lucide-react';
import type { OllamaStatus, SystemSettings } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface SettingsPageProps {
  ollamaStatus: OllamaStatus | null;
  settings: SystemSettings | null;
  onRefreshOllama: () => void;
  onSaveOllamaSettings: (endpoint: string, model: string) => Promise<void>;
  onSaveSystemSettings: (settings: Partial<SystemSettings>) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  ollamaStatus,
  settings,
  onRefreshOllama,
  onSaveOllamaSettings,
  onSaveSystemSettings,
}) => {
  const [endpoint, setEndpoint] = useState(
    ollamaStatus?.endpoint || settings?.ollama_endpoint || 'http://127.0.0.1:11434'
  );
  const [selectedModel, setSelectedModel] = useState(
    ollamaStatus?.activeModel || settings?.ollama_default_model || 'qwen2.5-coder:latest'
  );
  const [exclusions, setExclusions] = useState(
    settings?.scan_exclusions || 'node_modules, .git, dist, build, coverage, .next, vendor, cache'
  );

  const [savingOllama, setSavingOllama] = useState(false);
  const [savingExclusions, setSavingExclusions] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSaveOllama = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingOllama(true);
      setMessage(null);
      await onSaveOllamaSettings(endpoint.trim(), selectedModel.trim());
      setMessage({ text: 'Ollama settings updated and connection tested.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update Ollama settings', type: 'error' });
    } finally {
      setSavingOllama(false);
    }
  };

  const handleSaveExclusions = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingExclusions(true);
      setMessage(null);
      await onSaveSystemSettings({ scan_exclusions: exclusions });
      setMessage({ text: 'Filesystem scan exclusions updated.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update exclusions', type: 'error' });
    } finally {
      setSavingExclusions(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800/80 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <span>System Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure local Ollama AI endpoints, model discovery, security exclusions, and database storage.
          </p>
        </div>

        <Button onClick={onRefreshOllama} variant="outline" size="sm">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Connection</span>
        </Button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-800 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Ollama Runtime Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <CardTitle>Ollama Local AI Runtime</CardTitle>
          </div>
          {ollamaStatus?.online ? (
            <Badge variant="success" size="sm">
              Online & Connected
            </Badge>
          ) : (
            <Badge variant="danger" size="sm">
              Disconnected
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveOllama} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Ollama Local API Endpoint
                </label>
                <input
                  type="text"
                  required
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Default Ollama port is 11434. No cloud API or keys required.
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Active Model Name
                </label>
                <input
                  type="text"
                  required
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="e.g. qwen2.5-coder:7b"
                  className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Recommended: Qwen2.5-Coder, Qwen3, DeepSeek-Coder.
                </span>
              </div>
            </div>

            {/* Disconnected Guidance Banner */}
            {!ollamaStatus?.online && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/50 text-xs text-amber-300/90 space-y-2">
                <div className="font-semibold flex items-center gap-2 text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Ollama is not running locally</span>
                </div>
                <p>
                  To use AI Project Planning and Folder Intelligence, ensure Ollama is installed and running on your machine:
                </p>
                <div className="p-2 rounded bg-black/60 font-mono text-[11px] text-cyan-300">
                  ollama serve
                </div>
                <p className="text-[11px] text-slate-400">
                  To pull the recommended coding model, open PowerShell and run: <code className="text-cyan-400">ollama run qwen2.5-coder:7b</code>
                </p>
              </div>
            )}

            {/* Detected Models List */}
            {ollamaStatus?.availableModels && ollamaStatus.availableModels.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-xs font-mono text-slate-400 block mb-2">
                  Installed Local Models ({ollamaStatus.availableModels.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {ollamaStatus.availableModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedModel(m)}
                      className={`text-xs font-mono px-2.5 py-1 rounded-md border transition-colors ${
                        selectedModel === m
                          ? 'bg-blue-950 text-cyan-300 border-cyan-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="glow" size="sm" loading={savingOllama}>
                <Save className="w-3.5 h-3.5" />
                <span>Save & Test Connection</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filesystem Scan Security & Exclusions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderLock className="w-4 h-4 text-emerald-400" />
            <CardTitle>Filesystem Security & Default Exclusions</CardTitle>
          </div>
          <Badge variant="success" size="sm">
            Local Only • Safe Guarded
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveExclusions} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                Default Directory and File Exclusions
              </label>
              <textarea
                rows={3}
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="node_modules, .git, dist, build, coverage, .next, vendor, cache"
                className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Comma-separated directories and patterns. Secret files (.env, credentials, pem, keys) and heavy binaries are strictly ignored by default.
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Security Invariants:</span>
              <p>• Canonical path validation prevents directory traversal.</p>
              <p>• File contents are parsed read-only in memory; no file is ever modified, deleted, or executed.</p>
              <p>• No external cloud telemetry or third-party API data transmission.</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="secondary" size="sm" loading={savingExclusions}>
                <Save className="w-3.5 h-3.5" />
                <span>Save Exclusions</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Database & Environment Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            <CardTitle>Storage & Local Environment</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 block">DATABASE ENGINE</span>
              <span className="text-slate-200 font-semibold mt-1 block">SQLite + Prisma ORM</span>
              <span className="text-[10px] text-emerald-400">File: dev.db (Active)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 block">HOST OS</span>
              <span className="text-slate-200 font-semibold mt-1 block">Windows</span>
              <span className="text-[10px] text-cyan-400">Native Filesystem Driver</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 block">RUNTIME FOOTPRINT</span>
              <span className="text-slate-200 font-semibold mt-1 block">Node.js + React Vite</span>
              <span className="text-[10px] text-slate-400">Zero cloud dependencies</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
