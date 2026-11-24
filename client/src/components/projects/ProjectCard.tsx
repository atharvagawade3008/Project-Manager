import React from 'react';
import {
  FolderGit2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { Project } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';

interface ProjectCardProps {
  project: Project;
  onSelect: (id: string) => void;
  onNavigateToProgress?: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect }) => {
  const healthBadge = {
    EXCELLENT: { label: 'Healthy', variant: 'success' as const },
    GOOD: { label: 'Normal', variant: 'info' as const },
    NEEDS_ATTENTION: { label: 'Needs attention', variant: 'warning' as const },
    CRITICAL: { label: 'Critical', variant: 'danger' as const },
  }[project.healthStatus] || { label: project.healthStatus, variant: 'default' as const };

  const completedTasks = project.completedTasksCount || 0;
  const pendingTasks = project.pendingTasksCount || 0;
  const totalTasks = completedTasks + pendingTasks;

  return (
    <Card className="group flex flex-col justify-between transition-colors duration-200 hover:border-white/[0.13]">
      <CardContent className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 transition-colors group-hover:text-cyan-400">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <h4 className="mt-3 truncate text-[14.5px] font-semibold text-slate-100">{project.name}</h4>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{project.category}</p>
          </div>

          {project.status === 'COMPLETED' ? (
            <Badge variant="success" size="sm">Completed</Badge>
          ) : (
            <Badge variant={healthBadge.variant} size="sm">{healthBadge.label}</Badge>
          )}
        </div>

        <p className="mt-3 line-clamp-1 text-[12px] text-slate-400">{project.description}</p>

        {/* Progress */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Progress</span>
            <span className="font-semibold text-slate-100">{project.overallProgress}%</span>
          </div>
          <ProgressBar value={project.overallProgress} size="sm" />
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500">
            <span>{completedTasks}/{totalTasks || 0} tasks done</span>
            <span>{project.verificationConfidence}% verified</span>
          </div>
        </div>

        {/* Folder */}
        <div className="mt-3 flex items-center gap-1.5 text-[10.5px] text-slate-500">
          <FolderGit2 className={`h-3 w-3 shrink-0 ${project.rootPath ? 'text-cyan-400/80' : 'text-slate-600'}`} />
          <span className="truncate" title={project.rootPath || 'No folder linked'}>
            {project.rootPath || 'No folder linked'}
          </span>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.055] pt-3">
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
            <Clock className="h-3 w-3" />
            <span>
              {project.lastScanAt
                ? new Date(project.lastScanAt).toLocaleDateString()
                : 'Not scanned'}
            </span>
          </div>

          <Button variant="ghost" size="sm" onClick={() => onSelect(project.id)} className="px-2">
            Manage
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
