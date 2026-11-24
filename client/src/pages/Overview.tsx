import React, { useMemo } from 'react';
import {
  FolderGit2,
  TrendingUp,
  ListTodo,
  ArrowRight,
  ArrowUpRight,
  Check,
  Sparkles,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { Project, OverviewData } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';

interface OverviewProps {
  overviewData: OverviewData | null;
  projects: Project[];
  loading: boolean;
  onSelectProject: (id: string) => void;
  onOpenCreateModal: () => void;
  onNavigateToTab: (tab: any) => void;
}

const ACCENT = '#f96d3d';
const MUTED_LINE = '#d9d9de';

const shortName = (name: string, max = 9) =>
  name.length > max ? `${name.slice(0, max).trim()}…` : name;

/** Chart tooltip shared by both trend charts — dark chip, orange values. */
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.09] bg-[#1b1b1f] px-3 py-2 shadow-lift">
      {label && (
        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      )}
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-[11px] text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color || entry.stroke }} />
          <span>{entry.name}</span>
          <span className="ml-auto font-semibold text-white">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
};

export const Overview: React.FC<OverviewProps> = ({
  overviewData,
  projects,
  loading,
  onSelectProject,
  onOpenCreateModal,
  onNavigateToTab,
}) => {
  const stats = overviewData?.stats;

  const trendData = useMemo(
    () =>
      projects.map((p) => ({
        name: shortName(p.name),
        progress: Math.round(p.overallProgress),
        confidence: Math.round(p.verificationConfidence),
      })),
    [projects]
  );

  const activityData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        key: d.toISOString().slice(0, 10),
        name: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        events: 0,
      };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const act of overviewData?.recentActivities || []) {
      const day = byKey.get(new Date(act.createdAt).toISOString().slice(0, 10));
      if (day) day.events += 1;
    }
    return days;
  }, [overviewData?.recentActivities]);

  const statusData = useMemo(() => {
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const active = projects.filter((p) => p.status === 'ACTIVE').length;
    const other = Math.max(projects.length - completed - active, 0);
    return [
      { name: 'Completed', value: completed, color: ACCENT },
      { name: 'Active', value: active, color: MUTED_LINE },
      { name: 'Other', value: other, color: '#4a4a52' },
    ].filter((s) => s.value > 0);
  }, [projects]);

  const avgCompletion = stats?.averageCompletion ?? 0;
  const avgConfidence = stats?.averageConfidence ?? 0;

  if (loading && !overviewData) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-9 w-52 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[86px] animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="h-[320px] animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Page heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> Dashboard
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none text-white sm:text-[30px]">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onNavigateToTab('analytics')}>
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Analytics</span>
          </Button>
          <Button variant="primary" size="sm" onClick={onOpenCreateModal}>
            New project
          </Button>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Total projects"
          value={stats?.totalProjects ?? projects.length}
          subtitle={`${stats?.activeProjects ?? 0} active`}
          icon={FolderGit2}
          accentColor="cyan"
        />
        <StatCard
          title="Average completion"
          value={`${avgCompletion}%`}
          subtitle={`${stats?.completedProjects ?? 0} completed`}
          icon={TrendingUp}
          accentColor="cyan"
        />
        <StatCard
          title="Open tasks"
          value={stats?.totalPendingTasks ?? 0}
          subtitle={`${stats?.overdueTasks ?? 0} overdue`}
          icon={ListTodo}
          accentColor={stats?.overdueTasks ? 'amber' : 'blue'}
        />
      </div>

      {/* Portfolio chart + status split */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.12em] text-slate-400">
                  <FolderGit2 className="h-3 w-3" />
                  Portfolio
                </span>

                <div className="mt-4 flex flex-wrap items-end gap-2.5">
                  <span className="text-[34px] font-semibold leading-none text-white">{avgCompletion}%</span>
                  <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-[11px] font-medium text-cyan-300">
                    <ArrowUpRight className="mr-0.5 inline h-3 w-3" />
                    {avgConfidence}% verified
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    {avgCompletion >= 80 ? 'Nearly there' : avgCompletion >= 40 ? 'On track' : 'Early build'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>{projects.length} projects tracked</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
                    Completion
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: MUTED_LINE }} />
                    Verification
                  </span>
                </div>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>

            <div className="h-[210px] w-full sm:h-[240px]">
              {trendData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  Add a project to populate the portfolio trend.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#6e6e78', fontSize: 10 }}
                      dy={8}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tick={{ fill: '#56565f', fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.14)', strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="progress"
                      name="Completion"
                      stroke={ACCENT}
                      strokeWidth={2.4}
                      fill="url(#progressFill)"
                      activeDot={{ r: 4, fill: ACCENT, stroke: '#0a0a0b', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="confidence"
                      name="Verification"
                      stroke={MUTED_LINE}
                      strokeWidth={2}
                      fill="transparent"
                      strokeDasharray="0"
                      activeDot={{ r: 3.5, fill: MUTED_LINE, stroke: '#0a0a0b', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-white">Project status</h2>
              <Badge variant="cyan" size="sm">{projects.length} total</Badge>
            </div>

            <div className="relative mt-2 h-[170px] w-full">
              {statusData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">No projects yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={74}
                        paddingAngle={3}
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#1b1b1f',
                          border: '1px solid rgba(255,255,255,0.09)',
                          borderRadius: 12,
                          fontSize: 11,
                        }}
                        itemStyle={{ color: '#ededf0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[24px] font-semibold leading-none text-white">{projects.length}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">Projects</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-auto space-y-2.5 pt-3">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
                    {entry.name}
                  </span>
                  <span className="font-medium text-slate-200">{entry.value}</span>
                </div>
              ))}
              {statusData.length === 0 && (
                <p className="text-[11.5px] leading-relaxed text-slate-500">
                  Create your first project to see the status split.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Projects + tasks */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <h2 className="text-[15px] font-semibold text-white">Projects</h2>
            <button
              onClick={() => onNavigateToTab('projects')}
              className="flex items-center gap-1 text-[11.5px] text-slate-400 transition-colors hover:text-white"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={FolderGit2}
                title="No projects yet"
                description="Create a project manually or generate a roadmap with the AI planner."
                actionText="Create project"
                onAction={onOpenCreateModal}
              />
            </div>
          ) : (
            <div className="mt-1 divide-y divide-white/[0.055] px-2 pb-2 sm:px-3">
              {projects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.035]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 group-hover:text-cyan-400">
                    <FolderGit2 className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-slate-100">{project.name}</span>
                      {project.status === 'COMPLETED' && (
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-300">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={project.overallProgress} size="sm" className="max-w-[220px]" />
                      <span className="shrink-0 text-[10.5px] text-slate-500">{project.overallProgress}%</span>
                    </div>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="text-[11px] text-slate-400">{project.completedTasksCount ?? 0} done</div>
                    <div className="text-[10px] text-slate-600">{project.category}</div>
                  </div>

                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-white">Needs attention</h2>
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
                {overviewData?.attentionTasks?.length || 0}
              </span>
            </div>
            <button
              onClick={() => onNavigateToTab('tasks')}
              className="text-[11px] text-slate-500 transition-colors hover:text-white"
            >
              All tasks
            </button>
          </div>

          <div className="mt-2 space-y-1 px-2 pb-3 sm:px-3">
            {!overviewData?.attentionTasks || overviewData.attentionTasks.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11.5px] text-slate-500">
                Nothing blocked. Everything looks healthy.
              </p>
            ) : (
              overviewData.attentionTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.035]">
                  <span
                    className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-[5px] border ${
                      task.priority === 'CRITICAL'
                        ? 'border-cyan-500/70 bg-cyan-500/25'
                        : 'border-white/20'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-slate-200">{task.title}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                      <span className="truncate">{task.project?.name}</span>
                      {task.deadline && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="shrink-0">{new Date(task.deadline).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Activity + recommendations */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between px-5 pt-5 sm:px-6">
            <div>
              <h2 className="text-[15px] font-semibold text-white">Activity</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Events across the last 7 days</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="h-[170px] w-full px-2 pb-3 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 6, right: 12, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6e6e78', fontSize: 10 }} dy={6} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: '#56565f', fontSize: 10 }} />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.14)', strokeDasharray: '4 4' }}
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-white/[0.09] bg-[#1b1b1f] px-3 py-2 text-[11px] shadow-lift">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
                        <div className="mt-0.5 font-semibold text-white">{payload[0].value} events</div>
                      </div>
                    ) : null
                  }
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke={ACCENT}
                  strokeWidth={2.2}
                  fill="url(#activityFill)"
                  activeDot={{ r: 4, fill: ACCENT, stroke: '#0a0a0b', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h2 className="text-[15px] font-semibold text-white">Next actions</h2>
            </div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">AI</span>
          </div>

          <div className="mt-2 divide-y divide-white/[0.055] px-2 pb-2 sm:px-3">
            {!overviewData?.latestRecommendations || overviewData.latestRecommendations.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11.5px] text-slate-500">
                Scan a project folder to generate recommendations.
              </p>
            ) : (
              overviewData.latestRecommendations.slice(0, 4).map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 rounded-xl px-2.5 py-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                    <Sparkles className="h-3 w-3 text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-slate-200">{rec.title}</p>
                    <p className="mt-0.5 truncate text-[10.5px] text-slate-500">{rec.project?.name}</p>
                  </div>
                  <Badge variant={rec.priority === 'CRITICAL' ? 'danger' : 'default'} size="sm">
                    {rec.priority}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
