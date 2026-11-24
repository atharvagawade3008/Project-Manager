import React from 'react';
import { cn } from './Button';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  size = 'md',
  ...props
}) => {
  const variants = {
    default: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 rounded-full border',
    md: 'text-[11px] px-2.5 py-1 rounded-full border font-medium',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
