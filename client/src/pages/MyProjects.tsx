import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';
import type { Project } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

interface MyProjectsProps {
  projects: Project[];
  loading: boolean;
  onSelectProject: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenAiPlannerModal?: () => void;
}

export const MyProjects: React.FC<MyProjectsProps> = ({
  projects,
  loading,
  onSelectProject,
  onOpenCreateModal,
  onOpenAiPlannerModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = [
    'ALL',
    'Software Development',
    'Game Development',
    'Web Application',
    'AI / ML System',
    'Mobile App',
    'CLI & Systems',
  ];

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesStatus =
      selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> Projects
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-white sm:text-[30px] flex items-center gap-2.5">
            <span>Projects</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
              {filteredProjects.length} of {projects.length}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAiPlannerModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAiPlannerModal}
              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Idea Planner</span>
            </Button>
          )}
          <Button onClick={onOpenCreateModal} variant="glow" size="sm">
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name, description..."
            className="w-full bg-[#1a1a1e] border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#1a1a1e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center bg-[#1a1a1e] border border-slate-800 p-0.5 rounded-xl">
            {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedStatus === s
                    ? 'bg-blue-950 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-[#1a1a1e] border border-slate-800 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg ${
                viewMode === 'grid' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg ${
                viewMode === 'list' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects List / Grid */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title={search ? 'No projects match your filter' : 'No projects yet'}
          description={
            search
              ? 'Try modifying your search query or clear the active category filter.'
              : 'Create your first project manually or describe an idea for the AI to structure.'
          }
          actionText={search ? 'Clear Search' : 'Create Project'}
          onAction={search ? () => setSearch('') : onOpenCreateModal}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={onSelectProject}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="p-4 rounded-xl bg-[#141417] border border-slate-800/80 hover:border-slate-700 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">
                    {project.category}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs font-semibold text-slate-100">{project.name}</span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-1">{project.description}</p>
                <p className="text-[10px] font-mono text-slate-500 truncate mt-1.5" title={project.rootPath || undefined}>
                  Folder: {project.rootPath || 'Not linked'}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="w-36">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Progress</span>
                    <span className="text-slate-200 font-bold">{project.overallProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-500 h-full rounded-full"
                      style={{ width: `${project.overallProgress}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-400 text-right">
                  <div>{project.completedTasksCount || 0} tasks done</div>
                  <div className="text-[10px] text-slate-500">
                    {project.lastScanAt
                      ? new Date(project.lastScanAt).toLocaleDateString()
                      : 'Never scanned'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
