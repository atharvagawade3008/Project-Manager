import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Layers,
  Calendar,
  Server,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Ban,
  Circle,
  RefreshCw,
  ListChecks,
} from 'lucide-react';
import type { Project, Task, PlanTaskStatus, OllamaStatus } from '../types';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface AiPlannerProps {
  activeProject?: Project | null;
  ollamaStatus?: OllamaStatus | null;
  onRefreshProject?: () => Promise<void> | void;
}

const STATUS_META: Record<
  PlanTaskStatus,
  { label: string; dot: string; text: string; border: string; bg: string; icon: typeof CheckCircle2 }
> = {
  COMPLETED: {
    label: 'Completed',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle2,
  },
  IN_PROGRESS: {
    label: 'In progress',
    dot: 'bg-cyan-400',
    text: 'text-cyan-300',
    border: 'border-cyan-500/25',
    bg: 'bg-cyan-500/10',
    icon: CircleDot,
  },
  BLOCKED: {
    label: 'Blocked',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    border: 'border-rose-500/25',
    bg: 'bg-rose-500/10',
    icon: Ban,
  },
  NOT_STARTED: {
    label: 'Not started',
    dot: 'bg-slate-500',
    text: 'text-slate-300',
    border: 'border-white/[0.09]',
    bg: 'bg-white/[0.04]',
    icon: Circle,
  },
};

const STATUS_ORDER: PlanTaskStatus[] = ['COMPLETED', 'IN_PROGRESS', 'BLOCKED', 'NOT_STARTED'];

const normalizeStatus = (value: string): PlanTaskStatus =>
  (['COMPLETED', 'IN_PROGRESS', 'BLOCKED', 'NOT_STARTED'].includes(value)
    ? value
    : 'NOT_STARTED') as PlanTaskStatus;

const TaskRow: React.FC<{
  task: Task;
  onChange: (taskId: string, status: PlanTaskStatus) => void;
}> = ({ task, onChange }) => {
  const status = normalizeStatus(task.status);
  const meta = STATUS_META[status];

  return (
    <div className="flex flex-col gap-2.5 border-t border-white/[0.055] py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-slate-200">{task.title}</p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
          <span
            className={`rounded-md border px-1.5 py-0.5 ${
              task.priority === 'CRITICAL'
                ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                : task.priority === 'HIGH'
                ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
                : 'border-white/[0.08] bg-white/[0.03] text-slate-400'
            }`}
          >
            {task.priority}
          </span>
          {task.estimatedHours ? <span>{task.estimatedHours}h est</span> : null}
          {task.deadline ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(task.deadline).toLocaleDateString()}
            </span>
          ) : null}
        </div>

        {task.description ? (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{task.description}</p>
        ) : null}
      </div>

      <label className="flex shrink-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        <select
          value={status}
          onChange={(e) => onChange(task.id, e.target.value as PlanTaskStatus)}
          aria-label={`Status for ${task.title}`}
          className={`rounded-lg border ${meta.border} ${meta.bg} ${meta.text} px-2 py-1 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50`}
        >
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value} className="bg-[#151518] text-slate-200">
              {STATUS_META[value].label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

export const AiPlanner: React.FC<AiPlannerProps> = ({
  activeProject,
  ollamaStatus,
  onRefreshProject,
}) => {
  const [plan, setPlan] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeProject) {
        setPlan(null);
        return;
      }
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const loaded = await api.getPlan(activeProject.id);
        if (!cancelled) setPlan(loaded);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load the project plan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  const tasks = plan?.tasks || [];
  const phases = plan?.phases || [];

  const counts = useMemo(() => {
    const base: Record<PlanTaskStatus, number> = {
      COMPLETED: 0,
      IN_PROGRESS: 0,
      BLOCKED: 0,
      NOT_STARTED: 0,
    };
    for (const task of tasks) base[normalizeStatus(task.status)] += 1;
    return base;
  }, [tasks]);

  const totalTasks = tasks.length;
  const donePercent = totalTasks > 0 ? Math.round((counts.COMPLETED / totalTasks) * 100) : 0;

  const handleGenerate = async () => {
    if (!activeProject || generating) return;

    if (phases.length > 0) {
      const confirmed = window.confirm(
        `Replace the current plan for "${activeProject.name}" with a new Ollama-generated plan?\n\n` +
          'Existing phases, modules, milestones and tasks for this project will be removed and regenerated.'
      );
      if (!confirmed) return;
    }

    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.generatePlan(activeProject.id);
      setPlan(result.project);
      setNotice(
        `Generated ${result.phases} phases and ${result.tasks} tasks with ${result.model}.` +
          (result.summary ? ` ${result.summary}` : '')
      );
      await onRefreshProject?.();
    } catch (err: any) {
      setError(err?.message || 'Plan generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: PlanTaskStatus) => {
    if (!plan) return;
    const previous = plan;
    setPlan({
      ...plan,
      tasks: plan.tasks?.map((task) => (task.id === taskId ? { ...task, status } : task)),
    });
    setError(null);
    try {
      await api.updateTaskStatus(taskId, status);
      await onRefreshProject?.();
    } catch (err: any) {
      setPlan(previous);
      setError(err?.message || 'Could not update that task.');
    }
  };

  const unassigned = tasks.filter((task) => !task.phaseId);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> AI Planner
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none text-white sm:text-[30px]">
            AI Planner
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] ${
              ollamaStatus?.online
                ? 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
            }`}
            title={ollamaStatus?.endpoint || 'Local Ollama runtime'}
          >
            <Server className="h-3.5 w-3.5" />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ollamaStatus?.online ? '#34d399' : '#fb7185' }} />
            {ollamaStatus?.online
              ? `Ollama · ${ollamaStatus.effectiveModel || ollamaStatus.activeModel}`
              : 'Ollama offline'}
          </span>

          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={!activeProject || generating || !ollamaStatus?.online}
            loading={generating}
          >
            {!generating && (phases.length > 0 ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />)}
            {phases.length > 0 ? 'Regenerate plan' : 'Generate future plan'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-[12px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && !error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-[12px] text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {!activeProject ? (
        <Card className="p-10 text-center">
          <Layers className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-3 text-[13px] text-slate-300">Select a project to plan.</p>
          <p className="mx-auto mt-1 max-w-sm text-[11.5px] text-slate-500">
            Pick a project in the top bar, then let your local Ollama model draft its phase and task hierarchy.
          </p>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          <div className="h-[86px] animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-[260px] animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : (
        <>
          {/* Snapshot */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status];
              const Icon = meta.icon;
              return (
                <div
                  key={status}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-[#121214] px-4 py-3.5"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${meta.border} ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.text}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-slate-400">{meta.label}</p>
                    <p className="text-[19px] font-semibold leading-tight text-white">{counts[status]}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress + plan meta */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-cyan-400" />
                <h2 className="text-[15px] font-semibold text-white">
                  {activeProject.name}
                  <span className="ml-2 text-[11px] font-normal text-slate-500">
                    {phases.length} phases · {totalTasks} tasks
                  </span>
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Plan completion</span>
                <span className="font-semibold text-white">{donePercent}%</span>
              </div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f96d3d] via-[#ff8b5c] to-[#ffb08a] transition-all duration-500"
                style={{ width: `${donePercent}%` }}
              />
            </div>
          </Card>

          {/* Hierarchy */}
          {phases.length === 0 ? (
            <Card className="p-10 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-cyan-400" />
              <p className="mt-3 text-[13px] text-slate-200">No plan for this project yet.</p>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
                Ollama will draft phases, modules, milestones and tasks from this project's objective, tech stack and
                latest evidence scan — with completed, in-progress, blocked and not-started work.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={handleGenerate}
                disabled={generating || !ollamaStatus?.online}
                loading={generating}
              >
                {!generating && <Sparkles className="h-3.5 w-3.5" />}
                Generate future plan
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {phases.map((phase, phaseIndex) => {
                const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
                const phaseDone = phaseTasks.filter((t) => t.status === 'COMPLETED').length;
                const phasePercent = phaseTasks.length > 0 ? Math.round((phaseDone / phaseTasks.length) * 100) : 0;

                return (
                  <Card key={phase.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold text-slate-300">
                          {String(phaseIndex + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-semibold text-white">{phase.name}</h3>
                          {phase.description && (
                            <p className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-500">{phase.description}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
                            <span className={`rounded-full border px-2 py-0.5 ${STATUS_META[normalizeStatus(phase.status)].border} ${STATUS_META[normalizeStatus(phase.status)].bg} ${STATUS_META[normalizeStatus(phase.status)].text}`}>
                              {STATUS_META[normalizeStatus(phase.status)].label}
                            </span>
                            {phase.startDate && <span>{new Date(phase.startDate).toLocaleDateString()}</span>}
                            {phase.endDate && <span>→ {new Date(phase.endDate).toLocaleDateString()}</span>}
                            <span>{phaseTasks.length} tasks</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full max-w-[180px] shrink-0">
                        <div className="mb-1 flex items-center justify-between text-[10.5px] text-slate-500">
                          <span>{phaseDone}/{phaseTasks.length}</span>
                          <span>{phasePercent}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${phasePercent}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-5">
                      {(phase.modules || []).map((module) => {
                        const moduleTasks = phaseTasks.filter((task) => task.moduleId === module.id);
                        return (
                          <div key={module.id} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[12.5px] font-medium text-slate-200">{module.name}</p>
                                {module.description && (
                                  <p className="mt-0.5 line-clamp-1 text-[10.5px] text-slate-500">{module.description}</p>
                                )}
                              </div>
                              <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                                {moduleTasks.length} tasks
                              </span>
                            </div>

                            {module.milestones && module.milestones.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {module.milestones.map((milestone) => (
                                  <span
                                    key={milestone.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400"
                                    title={milestone.description || milestone.title}
                                  >
                                    <Calendar className="h-2.5 w-2.5" />
                                    {milestone.title}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-2">
                              {moduleTasks.length === 0 ? (
                                <p className="py-2 text-[11px] text-slate-600">No tasks in this module.</p>
                              ) : (
                                moduleTasks.map((task) => (
                                  <TaskRow key={task.id} task={task} onChange={handleStatusChange} />
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {phaseTasks.length === 0 && (
                        <p className="text-[11.5px] text-slate-600">
                          Ollama did not add tasks to this phase. Regenerate to fill it in.
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}

              {unassigned.length > 0 && (
                <Card>
                  <div className="px-5 pt-5">
                    <h3 className="text-[14px] font-semibold text-white">Unassigned tasks</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Tasks that are not linked to a phase.</p>
                  </div>
                  <div className="p-5 pt-2">
                    {unassigned.map((task) => (
                      <TaskRow key={task.id} task={task} onChange={handleStatusChange} />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {generating && (
        <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
          Ollama is drafting the plan on your machine. A small local model can take one to three minutes.
        </div>
      )}
    </div>
  );
};
