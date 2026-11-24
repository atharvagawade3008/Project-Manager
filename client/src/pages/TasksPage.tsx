import React, { useState } from 'react';
import { CheckSquare, Plus, Filter, Search, Clock, AlertCircle } from 'lucide-react';
import type { Project, Task } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

interface TasksPageProps {
  activeProject?: Project | null;
  projects: Project[];
}

export const TasksPage: React.FC<TasksPageProps> = ({ activeProject, projects }) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const tasks: Task[] = activeProject?.tasks || [];
  const filtered = filterStatus === 'ALL'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> Tasks
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-white sm:text-[30px] flex flex-wrap items-center gap-2.5">
            <span>Tasks</span>
            {activeProject && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
                {activeProject.name}
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-2 max-w-full overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.07] p-0.5 rounded-xl text-xs whitespace-nowrap">
            {['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  filterStatus === st
                    ? 'bg-blue-950 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {activeProject
                ? 'No tasks found for this filter.'
                : 'Select an active project to view and manage its tasks.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filtered.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-100 truncate">{t.title}</span>
                      <Badge
                        variant={
                          t.status === 'COMPLETED'
                            ? 'success'
                            : t.status === 'BLOCKED'
                            ? 'danger'
                            : t.status === 'IN_PROGRESS'
                            ? 'info'
                            : 'default'
                        }
                        size="sm"
                      >
                        {t.status}
                      </Badge>
                      <Badge variant={t.priority === 'CRITICAL' ? 'danger' : 'warning'} size="sm">
                        {t.priority}
                      </Badge>
                    </div>
                    {t.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400 shrink-0">
                    {t.estimatedHours && <span>{t.estimatedHours}h est</span>}
                    {t.deadline && <span>Due {new Date(t.deadline).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
