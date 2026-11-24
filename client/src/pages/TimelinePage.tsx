import React from 'react';
import { Calendar, Clock, Milestone, ArrowRight } from 'lucide-react';
import type { Project } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

interface TimelinePageProps {
  activeProject?: Project | null;
}

export const TimelinePage: React.FC<TimelinePageProps> = ({ activeProject }) => {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="pb-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> Timeline
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-white sm:text-[30px]">
            Timeline
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <CardTitle>
              {activeProject ? `Roadmap: ${activeProject.name}` : 'Select a Project'}
            </CardTitle>
          </div>
          {activeProject?.targetDeadline && (
            <span className="text-xs font-mono text-slate-400">
              Deadline: {new Date(activeProject.targetDeadline).toLocaleDateString()}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {!activeProject ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select a project to inspect its roadmap timeline and phases.
            </div>
          ) : (
            <div className="space-y-6">
              {activeProject.phases && activeProject.phases.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
                  {activeProject.phases.map((ph, idx) => (
                    <div key={ph.id} className="relative">
                      <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-cyan-500 border-4 border-[#141417]" />
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-200">
                            Phase {idx + 1}: {ph.name}
                          </h4>
                          <span className="text-[10px] font-mono text-cyan-400 uppercase">
                            {ph.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{ph.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No timeline phases defined for this project yet. Use AI Project Planner to generate them.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
