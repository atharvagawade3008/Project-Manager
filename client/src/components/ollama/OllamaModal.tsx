import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { OllamaStatus } from '../../types';
import { Server, RefreshCw, CheckCircle2, AlertCircle, Save, ExternalLink } from 'lucide-react';

interface OllamaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ollamaStatus: OllamaStatus | null;
  onRefresh: () => void;
  onSave: (endpoint: string, model: string) => Promise<void>;
}

export const OllamaModal: React.FC<OllamaModalProps> = ({
  isOpen,
  onClose,
  ollamaStatus,
  onRefresh,
  onSave,
}) => {
  const [endpoint, setEndpoint] = useState(ollamaStatus?.endpoint || 'http://127.0.0.1:11434');
  const [activeModel, setActiveModel] = useState(ollamaStatus?.activeModel || 'qwen2.5-coder:latest');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setFeedback(null);
      await onSave(endpoint.trim(), activeModel.trim());
      setFeedback('Ollama connection verified.');
    } catch (err: any) {
      setFeedback(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Local Ollama AI Runtime"
      description="Connect to your locally running Ollama instance for planning and filesystem intelligence."
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Status indicator */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Server className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-200">Runtime Status</span>
          </div>
          {ollamaStatus?.online ? (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Online ({ollamaStatus.availableModels.length} models)</span>
            </span>
          ) : (
            <span className="text-xs font-mono text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Offline</span>
            </span>
          )}
        </div>

        {feedback && (
          <div className="p-2.5 rounded-lg text-xs bg-slate-900 border border-cyan-800 text-cyan-300">
            {feedback}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
            Endpoint URL
          </label>
          <input
            type="text"
            required
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
            Model Name
          </label>
          <input
            type="text"
            required
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>

        {/* Available detected models */}
        {ollamaStatus?.availableModels && ollamaStatus.availableModels.length > 0 && (
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-1.5">
              Select Installed Model:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {ollamaStatus.availableModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveModel(m)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    activeModel === m
                      ? 'bg-blue-950 text-cyan-300 border-cyan-500'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Offline tips */}
        {!ollamaStatus?.online && (
          <div className="text-[11px] text-slate-400 p-3 rounded-lg bg-slate-900/40 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-300 block">How to start Ollama:</span>
            <p>1. Open Windows Terminal or Command Prompt.</p>
            <p>2. Run <code className="text-cyan-400">ollama serve</code>.</p>
            <p>3. Pull a model: <code className="text-cyan-400">ollama run qwen2.5-coder:7b</code>.</p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Test Ping</span>
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" variant="glow" size="sm" loading={loading}>
              <Save className="w-3.5 h-3.5" />
              <span>Save & Connect</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
