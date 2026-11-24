import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  XCircle,
  HelpCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  FileCode2,
  ListChecks,
} from 'lucide-react';
import type { AssessmentFeature } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

interface FeatureAssessmentListProps {
  features: AssessmentFeature[];
}

type FilterKey = 'all' | 'implemented' | 'partial' | 'placeholder' | 'missing' | 'cannot_verify' | 'excluded';

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'implemented', label: 'Implemented' },
  { key: 'partial', label: 'Partial' },
  { key: 'placeholder', label: 'Placeholder' },
  { key: 'missing', label: 'Missing' },
  { key: 'cannot_verify', label: 'Cannot verify' },
  { key: 'excluded', label: 'Excluded' },
];

const statusStyles: Record<string, { label: string; variant: any; Icon: any }> = {
  IMPLEMENTED: { label: 'Implemented', variant: 'success', Icon: CheckCircle2 },
  PARTIALLY_IMPLEMENTED: { label: 'Partially implemented', variant: 'warning', Icon: AlertTriangle },
  PLACEHOLDER: { label: 'Placeholder', variant: 'info', Icon: CircleDashed },
  MISSING: { label: 'Missing', variant: 'danger', Icon: XCircle },
  CANNOT_VERIFY: { label: 'Cannot verify', variant: 'default', Icon: HelpCircle },
  NOT_APPLICABLE: { label: 'Not applicable', variant: 'default', Icon: MinusCircle },
};

const sourceStyles: Record<string, { label: string; variant: any }> = {
  ORIGINAL_PLANNED: { label: 'Planned', variant: 'purple' },
  AI_DISCOVERED: { label: 'Discovered', variant: 'cyan' },
  AI_INFERRED_MISSING: { label: 'Inferred gap', variant: 'warning' },
  USER_CONFIRMED: { label: 'User confirmed', variant: 'success' },
};

const verificationLabels: Record<string, string> = {
  VERIFIED: 'Verified',
  PARTIALLY_VERIFIED: 'Partially verified',
  UNVERIFIED: 'Unverified',
  CANNOT_VERIFY: 'Cannot verify',
  NOT_APPLICABLE: 'Not applicable',
};

function matchesFilter(feature: AssessmentFeature, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return feature.included;
    case 'implemented':
      return feature.included && feature.status === 'IMPLEMENTED';
    case 'partial':
      return feature.included && feature.status === 'PARTIALLY_IMPLEMENTED';
    case 'placeholder':
      return feature.included && feature.status === 'PLACEHOLDER';
    case 'missing':
      return feature.included && feature.status === 'MISSING';
    case 'cannot_verify':
      return feature.included && (feature.status === 'CANNOT_VERIFY' || feature.status === 'NOT_APPLICABLE');
    case 'excluded':
      return !feature.included;
    default:
      return true;
  }
}

export const FeatureAssessmentList: React.FC<FeatureAssessmentListProps> = ({ features }) => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = features.filter((feature) => matchesFilter(feature, filter));

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-cyan-400" />
            <CardTitle>Feature-level evidence</CardTitle>
          </div>
          <span className="text-[11px] font-mono text-slate-500">{features.filter((f) => f.included).length} in scope</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((entry) => {
            const count = features.filter((feature) => matchesFilter(feature, entry.key)).length;
            const active = filter === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setFilter(entry.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors ${
                  active
                    ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {entry.label} <span className={active ? 'text-cyan-500' : 'text-slate-600'}>{count}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="p-5 text-xs text-slate-500 italic">No requirements in this category.</p>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((feature, index) => {
              const key = feature.id || `${feature.name}-${index}`;
              const isExpanded = expanded === key;
              const status = statusStyles[feature.status] || statusStyles.CANNOT_VERIFY;
              const source = sourceStyles[feature.source] || sourceStyles.AI_DISCOVERED;
              const StatusIcon = status.Icon;

              return (
                <div key={key} className="p-4 hover:bg-slate-900/20 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100">{feature.name}</h4>
                        <Badge variant={status.variant} size="sm">
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                        <Badge variant={source.variant} size="sm">
                          {source.label}
                        </Badge>
                        <Badge variant="default" size="sm">
                          {feature.category || feature.dimension}
                        </Badge>
                        {!feature.included && (
                          <Badge variant="default" size="sm">
                            excluded from scoring
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{feature.expectedFunctionality}</p>

                      {feature.missingRequirements && (
                        <div className="flex items-start gap-1.5 text-[11px] font-mono text-amber-400/90 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{feature.missingRequirements}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="w-32 font-mono">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">Completion</span>
                          <span className="text-slate-200 font-bold">{feature.completion}%</span>
                        </div>
                        <ProgressBar value={feature.completion} size="sm" />
                      </div>
                      <div className="w-24 font-mono text-right">
                        <span className="text-[10px] text-slate-500 block">CONFIDENCE</span>
                        <span className="text-xs text-cyan-400 font-semibold">{feature.confidence}%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : key)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-mono"
                      >
                        <span className="hidden sm:inline">{feature.evidences.length} evidence</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-[#131316] border border-slate-800">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                            Expected functionality
                          </span>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{feature.expectedFunctionality}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[#131316] border border-slate-800">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                            Verification
                          </span>
                          <p className="text-xs text-slate-300 mt-1">
                            {verificationLabels[feature.verificationStatus] || feature.verificationStatus}
                            <span className="text-slate-500">
                              {' '}
                              • dimension {feature.dimension} • weight {feature.weight}
                            </span>
                          </p>
                        </div>
                      </div>

                      {feature.placeholderSignals.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/60">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                            Placeholder / unfinished signals
                          </span>
                          <ul className="mt-1 space-y-1">
                            {feature.placeholderSignals.slice(0, 4).map((signal, signalIndex) => (
                              <li key={signalIndex} className="text-[11px] font-mono text-amber-200/80">
                                {signal}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
                          Implementation evidence
                        </span>
                        {feature.evidences.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">
                            No source, route or content evidence was found for this requirement.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {feature.evidences.map((evidence, evidenceIndex) => (
                              <div
                                key={`${key}-ev-${evidenceIndex}`}
                                className="p-3 rounded-lg bg-[#131316] border border-slate-800 flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    <span className="font-mono text-cyan-300 font-medium truncate">
                                      {evidence.filePath}
                                    </span>
                                    {evidence.lineStart && (
                                      <span className="text-[10px] font-mono text-slate-500">
                                        line {evidence.lineStart}
                                      </span>
                                    )}
                                    {evidence.symbolOrComponent && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                        {evidence.symbolOrComponent}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-400 text-[11px] leading-relaxed">
                                    {evidence.evidenceDescription}
                                  </p>
                                </div>
                                <div className="text-right font-mono text-[10px] shrink-0">
                                  <Badge variant={evidence.status === 'FOUND' ? 'success' : 'warning'} size="sm">
                                    {evidence.status}
                                  </Badge>
                                  <span className="text-slate-500 block mt-1">{evidence.confidence}% conf</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
