import React from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Sparkles,
  Cpu,
  CheckSquare,
  Calendar,
  BarChart3,
  Bot,
  Settings,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '../ui/Button';

export type NavItem =
  | 'overview'
  | 'projects'
  | 'planner'
  | 'progress'
  | 'tasks'
  | 'timeline'
  | 'analytics'
  | 'assistant'
  | 'architecture'
  | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  setCurrentTab: (tab: NavItem) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  activeProjectName?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  activeProjectName,
  mobileOpen = false,
  onCloseMobile,
}) => {
  // Labels stay visible inside the mobile drawer even when the desktop rail is collapsed.
  const isCollapsed = collapsed && !mobileOpen;

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'My Projects', icon: FolderGit2 },
    { id: 'planner', label: 'AI Planner', icon: Sparkles },
    { id: 'progress', label: 'Progress Intelligence', icon: Cpu },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
    { id: 'architecture', label: 'Architecture', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-40 bg-black/65 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
      />

      <aside
        data-open={mobileOpen ? 'true' : 'false'}
        className={cn(
          'nav-drawer fixed inset-y-0 left-0 z-50 flex h-screen w-[270px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0e0e10] transition-transform duration-300 ease-out',
          'lg:sticky lg:top-0 lg:z-30',
          collapsed ? 'lg:w-[84px]' : 'lg:w-[270px]'
        )}
      >
        {/* Brand */}
        <div className="flex h-auto items-center justify-between gap-3 px-5 pt-6 pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              <img src="/favicon.svg" alt="Project OS logo" className="h-9 w-9" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold tracking-tight text-white">
                  Project<span className="text-cyan-400">OS</span>
                </div>
                <div className="truncate text-[10.5px] text-slate-500">Local project intelligence</div>
              </div>
            )}
          </div>

          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white lg:block"
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Active project */}
        {activeProjectName && !isCollapsed && (
          <div className="mx-3 mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Active project</div>
            <div className="mt-1 truncate text-[12.5px] font-medium text-slate-100">{activeProjectName}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id as NavItem)}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-[13px] px-3 py-2.5 text-[13.5px] transition-all duration-150',
                  isActive
                    ? 'bg-white/[0.07] font-medium text-white'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                  )}
                />
                {!isCollapsed && (
                  <span className="flex-1 truncate text-left">{item.label}</span>
                )}
                {!isCollapsed && item.isFuture && (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                    soon
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-cyan-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Private local runtime</span>
            </div>
            <div className="mt-1 text-[10.5px] text-slate-600">Project OS · v1.0.0</div>
          </div>
        )}
      </aside>
    </>
  );
};
