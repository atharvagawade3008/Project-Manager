import React, { useState } from 'react';
import {
  FolderGit2,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  RotateCcw,
  ArrowLeft,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  Code2,
} from 'lucide-react';
import type { Project } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { FolderDropzone } from '../components/filesystem/FolderDropzone';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdate: (id: string, data: Partial<Project>) => Promise<Project>;
  onDelete: (id: string) => Promise<void>;
  onNavigateToTab: (tab: any) => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onUpdate,
  onDelete,
  onNavigateToTab,
}) => {
  const [rootPath, setRootPath] = useState(project.rootPath || '');
  const [isUpdatingPath, setIsUpdatingPath] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const isCompleted = project.status === 'COMPLETED';

  // Marking a project complete pins its headline progress at 100% on the server,
  // so the dashboard reflects it immediately without waiting for a new scan.
  const handleToggleCompletion = async () => {
    try {
      setIsUpdatingStatus(true);
      await onUpdate(project.id, { status: isCompleted ? 'ACTIVE' : 'COMPLETED' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSavePath = async () => {
    try {
      setIsUpdatingPath(true);
      await onUpdate(project.id, { rootPath: rootPath.trim() || undefined });
    } finally {
      setIsUpdatingPath(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"? This cannot be undone.`)) {
      setDeleting(true);
      await onDelete(project.id);
      onBack();
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
        <button
          onClick={onBack}
          className="text-xs font-medium text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleCompletion}
            loading={isUpdatingStatus}
            className={
              isCompleted
                ? 'border-slate-600 text-slate-300 hover:bg-slate-800/60'
                : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40'
            }
          >
            {isCompleted ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{isCompleted ? 'Reopen Project' : 'Mark Completed'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateToTab('progress')}
            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Folder Intelligence</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateToTab('planner')}
            className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Planner</span>
          </Button>

          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>

      {/* Main Project Header Card */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                {project.category}
              </span>
              <span className="text-slate-600">•</span>
              {isCompleted ? (
                <Badge variant="success" size="sm">
                  Completed
                </Badge>
              ) : (
                <Badge
                  variant={
                    project.healthStatus === 'EXCELLENT'
                      ? 'success'
                      : project.healthStatus === 'GOOD'
                      ? 'info'
                      : 'warning'
                  }
                  size="sm"
                >
                  {project.healthStatus}
                </Badge>
              )}
              <Badge variant="default" size="sm">
                Complexity: {project.complexity}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">{project.description}</p>
          </div>

          {/* Progress metric box */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shrink-0 w-full md:w-64 space-y-2 font-mono">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Implementation</span>
              <span className="text-base font-bold text-slate-100">{project.overallProgress}%</span>
            </div>
            <ProgressBar value={project.overallProgress} size="md" />

            <div className="flex justify-between items-center text-[11px] pt-1">
              <span className="text-slate-500">Confidence</span>
              <span className="text-cyan-400 font-semibold">{project.verificationConfidence}%</span>
            </div>
          </div>
        </div>

        {/* Tech stack badges */}
        {project.techStack && project.techStack.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80">
            <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5" /> Stack:
            </span>
            {project.techStack.map((tech) => (
              <span
                key={tech}
                className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Directory Connection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-cyan-400" />
            <CardTitle>Connected Local Filesystem Folder</CardTitle>
          </div>
          <span className="text-xs font-mono text-slate-500">Folder Intelligence Engine</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <FolderDropzone
            currentPath={rootPath}
            onPathChange={setRootPath}
            onPathValidated={async (validatedPath) => {
              if (validatedPath !== project.rootPath) {
                await onUpdate(project.id, { rootPath: validatedPath });
              }
            }}
            onScanNow={() => onNavigateToTab('progress')}
          />

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
            <span>Last scanned: {project.lastScanAt ? new Date(project.lastScanAt).toLocaleString() : 'Never'}</span>
            <span>Target deadline: {project.targetDeadline ? new Date(project.targetDeadline).toLocaleDateString() : 'Unscheduled'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Objective & Deliverables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Primary Objective</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-300 leading-relaxed">
              {project.objective || 'No primary objective specified.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-300 leading-relaxed">
              {project.expectedDeliverables || 'No specific deliverables outlined.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
