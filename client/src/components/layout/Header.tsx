import React from 'react';
import {
  FolderGit2,
  Plus,
  Server,
  ChevronDown,
  Menu,
} from 'lucide-react';
import type { Project, OllamaStatus } from '../../types';
import { Button } from '../ui/Button';
import { cn } from '../ui/Button';

interface HeaderProps {
  projects: Project[];
  activeProjectId?: string;
  onSelectProject: (id: string) => void;
  onOpenCreateModal: () => void;
  ollamaStatus: OllamaStatus | null;
  onRefreshOllama: () => void;
  onOpenOllamaModal: () => void;
  onOpenMobileNav?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateModal,
  ollamaStatus,
  onOpenOllamaModal,
  onOpenMobileNav,
}) => {
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0a0a0b]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="rounded-xl border border-white/[0.08] p-2 text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Project switcher */}
        <div className="group relative min-w-0">
          <div className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 transition-colors hover:border-white/[0.14]">
            <FolderGit2 className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="max-w-[38vw] truncate text-[12.5px] font-medium text-slate-200 sm:max-w-[220px]">
              {activeProject ? activeProject.name : 'Select project'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          </div>

          <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#151518] p-1.5 opacity-0 shadow-lift transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Projects ({projects.length})
            </div>
            <div className="max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-slate-500">No projects yet</div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                      p.id === activeProjectId
                        ? 'bg-white/[0.07] text-white'
                        : 'text-slate-300 hover:bg-white/[0.05]'
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">{p.overallProgress}%</span>
                  </button>
                ))
              )}
            </div>
            <div className="mt-1 border-t border-white/[0.06] pt-1">
              <button
                onClick={onOpenCreateModal}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-cyan-400 transition-colors hover:bg-white/[0.05]"
              >
                <Plus className="h-3.5 w-3.5" />
                New project
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenOllamaModal}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 transition-colors hover:border-white/[0.14]"
          title={ollamaStatus?.endpoint || 'Local AI runtime'}
        >
          <Server className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden text-[11px] text-slate-400 sm:inline">AI</span>
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              ollamaStatus?.online ? 'bg-emerald-400' : 'bg-rose-500'
            )}
          />
        </button>

        <Button onClick={onOpenCreateModal} variant="primary" size="sm" className="px-3">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New project</span>
        </Button>
      </div>
    </header>
  );
};
