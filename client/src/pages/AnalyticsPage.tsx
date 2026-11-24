import React from 'react';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart as RechartsPie,
  Pie,
} from 'recharts';
import type { Project } from '../types';
import { Card } from '../components/ui/Card';

interface AnalyticsPageProps {
  projects: Project[];
}

const ACCENT = '#f96d3d';
const MUTED = '#d9d9de';
const COLORS = ['#f96d3d', '#ff8b5c', '#d9d9de', '#8e8e98', '#56565f', '#ffb08a'];

const panelTitle = 'text-[15px] font-semibold text-white';

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ projects }) => {
  const short = (name: string) => (name.length > 12 ? `${name.slice(0, 12)}…` : name);

  const trendData = projects.map((p) => ({
    name: short(p.name),
    progress: p.overallProgress,
    confidence: p.verificationConfidence,
  }));

  const categoryCounts: Record<string, number> = {};
  for (const p of projects) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  const tooltipStyle = {
    background: '#1b1b1f',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12,
    fontSize: 11,
  } as const;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <div className="text-[11px] tracking-wide text-slate-500">
          Pages <span className="mx-1 text-slate-700">/</span> Analytics
        </div>
        <h1 className="mt-1.5 text-[26px] font-semibold leading-none text-white sm:text-[30px]">Analytics</h1>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <h2 className={panelTitle}>Completion vs verification</h2>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} /> Completion
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: MUTED }} /> Verification
            </span>
          </div>
        </div>

        <div className="h-[260px] w-full px-2 py-4 sm:h-[300px]">
          {trendData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">No projects to chart yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6e6e78', fontSize: 10 }} dy={8} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={44} tick={{ fill: '#56565f', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ededf0' }} cursor={{ stroke: 'rgba(255,255,255,0.14)', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="progress" name="Completion" stroke={ACCENT} strokeWidth={2.4} fill="url(#analyticsFill)" activeDot={{ r: 4, fill: ACCENT, stroke: '#0a0a0b', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="confidence" name="Verification" stroke={MUTED} strokeWidth={2} fill="transparent" activeDot={{ r: 3.5, fill: MUTED, stroke: '#0a0a0b', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <h2 className={panelTitle}>Per-project scores</h2>
          </div>
          <div className="h-[260px] w-full px-2 py-4">
            {trendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">No projects to chart yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} barGap={4} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6e6e78', fontSize: 10 }} dy={6} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={42} tick={{ fill: '#56565f', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ededf0' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="progress" name="Completion" fill={ACCENT} radius={[6, 6, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="confidence" name="Verification" fill="#3f3f47" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
            <PieChart className="h-4 w-4 text-cyan-400" />
            <h2 className={panelTitle}>Projects by category</h2>
          </div>
          <div className="h-[260px] w-full px-2 py-4">
            {categoryData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">No projects to chart yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={84}
                    paddingAngle={3}
                    stroke="none"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#ededf0' }} />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
