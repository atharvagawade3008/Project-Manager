import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { FolderProjectAnalysis, Project } from '../../types';
import {
  Folder,
  Sparkles,
  AlertCircle,
  FolderOpen,
  UploadCloud,
  CheckCircle2,
  ScanSearch,
} from 'lucide-react';
import { api } from '../../api/client';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  onCreate: (data: Partial<Project>) => Promise<Project>;
}

const emptyForm = {
  name: '',
  description: '',
  category: 'Software Development',
  objective: '',
  expectedDeliverables: '',
  techStackInput: '',
  targetDeadline: '',
  complexity: 'Medium' as 'Low' | 'Medium' | 'High' | 'Very High',
  rootPath: '',
};

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onCreate,
}) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<FolderProjectAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const analysisRequestRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      analysisRequestRef.current += 1;
      setFormData(emptyForm);
      setAnalysis(null);
      setAnalysisError(null);
      setError(null);
      setLoading(false);
      setAnalysisLoading(false);
    }
  }, [isOpen]);

  const analyzeFolder = async (rawPath: string) => {
    const path = rawPath.trim();
    if (!path) {
      setAnalysisError('Choose a project folder first.');
      return;
    }

    const requestId = ++analysisRequestRef.current;
    try {
      setAnalysisLoading(true);
      setAnalysisError(null);
      const result = await api.analyzeProjectFolder(path);
      if (requestId !== analysisRequestRef.current) return;

      setAnalysis(result);
      setFormData((prev) => ({
        ...prev,
        name: result.name || prev.name,
        description: result.description || prev.description,
        category: result.category || prev.category,
        objective: result.objective || prev.objective,
        expectedDeliverables: result.expectedDeliverables || prev.expectedDeliverables,
        techStackInput: result.techStack.join(', ') || prev.techStackInput,
        complexity: result.complexity || prev.complexity,
        rootPath: result.rootPath,
      }));
    } catch (err: any) {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(null);
      setAnalysisError(err.message || 'Could not analyze this folder. You can still fill the form manually.');
    } finally {
      if (requestId === analysisRequestRef.current) setAnalysisLoading(false);
    }
  };

  const handleBrowse = async () => {
    try {
      setAnalysisError(null);
      const res = await api.openNativeFolderPicker();
      if (res.selectedPath && !res.cancelled) {
        setFormData((prev) => ({ ...prev, rootPath: res.selectedPath! }));
        await analyzeFolder(res.selectedPath);
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Could not open the folder picker.');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const item = e.dataTransfer.items?.[0];
    const entry = item && (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
    if (entry?.isDirectory) {
      setFormData((prev) => ({ ...prev, rootPath: entry.name }));
      await analyzeFolder(entry.name);
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const filePath = (file as any).path as string | undefined;
    if (filePath) {
      const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
      if (dir) {
        setFormData((prev) => ({ ...prev, rootPath: dir }));
        await analyzeFolder(dir);
        return;
      }
    }
    if (file.name) {
      setFormData((prev) => ({ ...prev, rootPath: file.name }));
      await analyzeFolder(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) {
      setError('Project name and description are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let rootPath = formData.rootPath.trim() || null;
      if (rootPath) {
        const validation = await api.validateDirectory(rootPath);
        if (!validation.valid || !validation.resolvedPath) {
          setError(validation.error || 'The selected project folder is not accessible.');
          return;
        }
        rootPath = validation.resolvedPath;
      }

      const techStack = formData.techStackInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await onCreate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        objective: formData.objective.trim(),
        expectedDeliverables: formData.expectedDeliverables.trim(),
        techStack,
        targetDeadline: formData.targetDeadline ? formData.targetDeadline : null,
        complexity: formData.complexity,
        rootPath,
      });

      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const update = (patch: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      description="Start with a local project folder and let local AI prefill the plan."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Folder-first project setup */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/25'
              : 'border-cyan-900/60 bg-cyan-950/10'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {isDragging ? 'Drop the folder to analyze it' : 'Select your project folder'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Name, description, category, tech stack and complexity are filled from the repository by local AI.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBrowse}
              disabled={analysisLoading}
              className="shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse Folder</span>
            </Button>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#131316] border border-slate-800 focus-within:border-cyan-500 rounded-lg px-3 py-2">
              <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={formData.rootPath}
                onChange={(e) => {
                  update({ rootPath: e.target.value });
                  setAnalysis(null);
                  setAnalysisError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void analyzeFolder(formData.rootPath);
                  }
                }}
                placeholder="C:\\Users\\...\\my-project (or drop a folder here)"
                className="w-full bg-transparent text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void analyzeFolder(formData.rootPath)}
              loading={analysisLoading}
              disabled={!formData.rootPath.trim()}
              className="shrink-0"
            >
              <ScanSearch className="w-3.5 h-3.5 text-cyan-400" />
              <span>Analyze & Auto-fill</span>
            </Button>
          </div>

          {analysisLoading && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-cyan-300 font-mono">
              <UploadCloud className="w-3.5 h-3.5 animate-pulse" />
              <span>Reading repository structure and consulting local AI…</span>
            </div>
          )}

          {analysisError && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {analysis && !analysisLoading && (
            <div className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/15 p-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Folder analyzed
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-mono text-slate-300">{analysis.projectType.label}</span>
                <span className="font-mono text-slate-500">{analysis.projectType.confidence}% confidence</span>
                <span className="font-mono text-slate-500">{analysis.filesScanned} files</span>
                <span className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded-full border border-cyan-800/60 text-cyan-300">
                  {analysis.aiUsed ? 'AI PREFILL' : 'METADATA PREFILL'}
                </span>
              </div>
              {analysis.aiMessage && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{analysis.aiMessage}</p>
              )}
              <p className="text-[10px] text-slate-500">
                Review and edit any field below before creating the project.
              </p>
            </div>
          )}
        </div>

        {/* Project Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Navi Mumbai 3D Engine"
              className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => update({ category: e.target.value })}
              className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
            >
              <option value="Software Development">Software Development</option>
              <option value="Game Development">Game Development</option>
              <option value="Web Application">Web Application</option>
              <option value="AI / ML System">AI / ML System</option>
              <option value="Mobile App">Mobile App</option>
              <option value="CLI & Systems">CLI & Systems</option>
              <option value="Non-Software Project">Non-Software Project</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
            Description *
          </label>
          <textarea
            required
            rows={2}
            value={formData.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Auto-filled from your README, package metadata and source structure…"
            className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
          />
        </div>

        {/* Objective & Tech Stack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Primary Objective
            </label>
            <input
              type="text"
              value={formData.objective}
              onChange={(e) => update({ objective: e.target.value })}
              placeholder="e.g. Ship alpha prototype with vehicle physics"
              className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Tech Stack (comma separated)
            </label>
            <input
              type="text"
              value={formData.techStackInput}
              onChange={(e) => update({ techStackInput: e.target.value })}
              placeholder="React, TypeScript, Three.js, Express"
              className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Deliverables & Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Expected Deliverables
            </label>
            <input
              type="text"
              value={formData.expectedDeliverables}
              onChange={(e) => update({ expectedDeliverables: e.target.value })}
              placeholder="e.g. Core app, API integration, deployable build"
              className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
              Target Deadline
            </label>
            <input
              type="date"
              value={formData.targetDeadline}
              onChange={(e) => update({ targetDeadline: e.target.value })}
              className="w-full bg-[#131316] border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Complexity */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
            Project Complexity
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['Low', 'Medium', 'High', 'Very High'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => update({ complexity: lvl })}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  formData.complexity === lvl
                    ? 'bg-blue-950 text-cyan-300 border-cyan-500/50'
                    : 'bg-[#131316] text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="glow" size="sm" loading={loading} disabled={analysisLoading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};