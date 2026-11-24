import React from 'react';
import { cn } from './Button';

interface ProgressBarProps {
  value: number; // 0 - 100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: 'primary' | 'cyan' | 'emerald' | 'amber' | 'gradient';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  size = 'md',
  showLabel = false,
  color = 'gradient',
  className,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2.5',
  };

  const colorClasses = {
    primary: 'bg-primary-500',
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    gradient: 'bg-gradient-to-r from-[#f96d3d] via-[#ff8b5c] to-[#ffb08a]',
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>Completion</span>
          <span className="font-semibold text-slate-200">{clamped}%</span>
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-white/[0.08]', sizeClasses[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', colorClasses[color])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
