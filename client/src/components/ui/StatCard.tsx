import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './Button';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accentColor?: 'blue' | 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'cyan',
}) => {
  const iconTint = {
    blue: 'text-slate-200',
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    purple: 'text-cyan-300',
    rose: 'text-rose-400',
  };

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-white/[0.065] bg-[#121214] px-4 py-4 sm:px-5 shadow-card transition-colors duration-200 hover:border-white/[0.12]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
        <Icon className={cn('h-[18px] w-[18px]', iconTint[accentColor] || 'text-slate-200')} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-slate-400">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[22px] font-semibold leading-tight tracking-tight text-white">{value}</span>
          {subtitle && <span className="truncate text-[11px] text-slate-500">{subtitle}</span>}
        </div>
        {trend && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            <span className={trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}>{trend.value}</span>
            <span className="text-slate-600">vs last scan</span>
          </div>
        )}
      </div>
    </div>
  );
};
