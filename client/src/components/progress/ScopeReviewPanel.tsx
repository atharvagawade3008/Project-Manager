import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Plus, Trash2, ClipboardList, Sparkles } from 'lucide-react';
import type { AssessmentResponse, ScopeRequirement } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ScopeReviewPanelProps {
  scope: AssessmentResponse['scope'];
  dimensionOptions: Array<{ key: string; name: string }>;
  onSave: (payload: {
    updates?: Array<{ id: string; included?: boolean; title?: string; dimension?: string }>;
    additions?: Array<{ title: string; dimension?: string }>;
    removals?: string[];
  }) => Promise<void>;
  onApprove: () => Promise<void>;
  busy: boolean;
}

const sourceGroups: Array<{ key: string; label: string; description: string; variant: any }> = [
  {
    key: 'ORIGINAL_PLANNED',
    label: 'Original planned requirements',
    description: 'Extracted from the README, objective, deliverables or task backlog.',
    variant: 'purple',
  },
  {
    key: 'AI_DISCOVERED',
    label: 'AI-discovered implemented features',
    description: 'Found in routes, endpoints and page structure. Not originally written down.',
    variant: 'cyan',
  },
  {
    key: 'AI_INFERRED_MISSING',
    label: 'AI-inferred missing features',
    description: 'Supported by concrete gaps such as broken links or forms with no handler — not invented scope.',
    variant: 'warning',
  },
  {
    key: 'USER_CONFIRMED',
    label: 'User-confirmed requirements',
    description: 'Added, edited or explicitly confirmed by you.',
    variant: 'success',
  },
];

const ScopeRow: React.FC<{
  requirement: ScopeRequirement;
  dimensionOptions: Array<{ key: string; name: string }>;
  busy: boolean;
  onSave: ScopeReviewPanelProps['onSave'];
}> = ({ requirement, dimensionOptions, busy, onSave }) => {
  const [title, setTitle] = useState(requirement.name);

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border transition-colors ${
        requirement.included
          ? 'bg-slate-900/50 border-slate-800'
          : 'bg-slate-950/50 border-slate-800/50 opacity-60'
      }`}
    >
      <input
        type="checkbox"
        checked={requirement.included}
        disabled={busy}
        onChange={(event) =>
          onSave({ updates: [{ id: requirement.id, included: event.target.checked }] })
        }
        className="w-3.5 h-3.5 accent-cyan-500 shrink-0"
        title={requirement.included ? 'Exclude from scoring' : 'Include in scoring'}
      />

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          if (title.trim() && title.trim() !== requirement.name) {
            onSave({ updates: [{ id: requirement.id, title: title.trim() }] });
          }
        }}
        disabled={busy}
        className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 text-xs text-slate-200 px-0.5 py-0.5 focus:outline-none"
      />

      <select
        value={requirement.dimension}
        disabled={busy}
        onChange={(event) =>
          onSave({ updates: [{ id: requirement.id, dimension: event.target.value }] })
        }
        className="bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      >
        {dimensionOptions.map((dimension) => (
          <option key={dimension.key} value={dimension.key}>
            {dimension.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2 shrink-0">
        {requirement.status && (
          <Badge
            variant={
              requirement.status === 'IMPLEMENTED'
                ? 'success'
                : requirement.status === 'MISSING'
                ? 'danger'
                : requirement.status === 'CANNOT_VERIFY'
                ? 'default'
                : 'warning'
            }
            size="sm"
          >
            {requirement.status.replace(/_/g, ' ').toLowerCase()}
          </Badge>
        )}
        <button
          type="button"
          disabled={busy || !requirement.included}
          onClick={() => onSave({ updates: [{ id: requirement.id, included: false }] })}
          className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-30"
          title="Remove from scope"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ScopeReviewPanel: React.FC<ScopeReviewPanelProps> = ({
  scope,
  dimensionOptions,
  onSave,
  onApprove,
  busy,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDimension, setNewDimension] = useState(dimensionOptions[0]?.key || 'functional');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await onSave({ additions: [{ title: newTitle.trim(), dimension: newDimension }] });
    setNewTitle('');
    setAdding(false);
  };

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-cyan-400" />
            <CardTitle>Project scope & requirements</CardTitle>
          </div>
          <Badge variant={scope.approvedAt ? 'success' : 'warning'} size="sm">
            {scope.approvedAt ? 'Approved' : 'Review required'}
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Assessment must be grounded in a scope you recognise. Edit titles, exclude anything that was never
          intended, or add missing requirements. Excluded items stay in history but no longer affect scores.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scope.approvedAt && (
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-200">This V2 assessment is provisional</p>
                <p className="text-[11px] text-amber-100/70 leading-relaxed">
                  Review the inferred scope below, then approve it to produce a definitive assessment.
                </p>
              </div>
            </div>
            <Button size="sm" variant="glow" onClick={onApprove} loading={busy} disabled={busy}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve scope</span>
            </Button>
          </div>
        )}

        {scope.approvedAt && (
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/50 flex items-center gap-2 text-[11px] text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Scope approved on {new Date(scope.approvedAt).toLocaleString()}. Editing scope requires a new assessment
              to update the scores.
            </span>
          </div>
        )}

        <div className="space-y-4">
          {sourceGroups.map((group) => {
            const requirements = scope.requirements.filter((requirement) => requirement.source === group.key);
            if (requirements.length === 0) return null;
            return (
              <div key={group.key} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={group.variant} size="sm">
                    {group.label}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-500">{requirements.length}</span>
                </div>
                <p className="text-[10px] text-slate-500">{group.description}</p>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {requirements.map((requirement) => (
                    <ScopeRow
                      key={requirement.id}
                      requirement={requirement}
                      dimensionOptions={dimensionOptions}
                      busy={busy}
                      onSave={onSave}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-800">
          {adding ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Requirement the AI missed…"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                autoFocus
              />
              <select
                value={newDimension}
                onChange={(event) => setNewDimension(event.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 px-2 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {dimensionOptions.map((dimension) => (
                  <option key={dimension.key} value={dimension.key}>
                    {dimension.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={handleAdd} loading={busy} disabled={busy || !newTitle.trim()}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200"
            >
              <Plus className="w-3.5 h-3.5" />
              Add a requirement
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 text-[10px] font-mono text-slate-600">
          <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            Only {scope.counts.included} of {scope.counts.total} requirements are currently included in scoring.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
