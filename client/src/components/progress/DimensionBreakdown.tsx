import React from 'react';
import { CheckCircle2, Circle, MinusCircle, Layers } from 'lucide-react';
import type { AssessmentDimension, MetricGroup } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

interface DimensionBreakdownProps {
  dimensions: AssessmentDimension[];
}

const groups: Array<{ key: MetricGroup; label: string; description: string }> = [
  {
    key: 'PRODUCT',
    label: 'Product dimensions',
    description: 'What a user of the intended product can actually do and see.',
  },
  {
    key: 'TECHNICAL',
    label: 'Technical dimensions',
    description: 'How the product is implemented underneath the interface.',
  },
  {
    key: 'READINESS',
    label: 'Production readiness dimensions',
    description: 'What stands between the current build and a trustworthy release.',
  },
];

function weightedGroupScore(dimensions: AssessmentDimension[]): number | null {
  const applicable = dimensions.filter((dimension) => dimension.applicable && dimension.score !== null);
  const total = applicable.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (total <= 0) return null;
  return (
    Math.round(
      (applicable.reduce((sum, dimension) => sum + (dimension.score as number) * dimension.weight, 0) / total) * 10
    ) / 10
  );
}

export const DimensionBreakdown: React.FC<DimensionBreakdownProps> = ({ dimensions }) => {
  const excluded = dimensions.filter((dimension) => !dimension.applicable);

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupDimensions = dimensions.filter(
          (dimension) => dimension.metric === group.key && dimension.applicable
        );
        if (groupDimensions.length === 0) return null;
        const groupScore = weightedGroupScore(groupDimensions);

        return (
          <Card key={group.key}>
            <CardHeader>
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <CardTitle>{group.label}</CardTitle>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{group.description}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">Weighted</span>
                <span className="text-lg font-mono font-bold text-slate-200">{groupScore ?? 'N/A'}%</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800/80">
                {groupDimensions.map((dimension) => (
                  <div key={dimension.key} className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-100">{dimension.name}</h4>
                          <Badge variant="cyan" size="sm">
                            weight {dimension.normalizedWeight}%
                          </Badge>
                          {dimension.featureCoverage !== null && (
                            <Badge variant="purple" size="sm">
                              requirement coverage {dimension.featureCoverage}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{dimension.summary}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">
                          {dimension.checksPassed}/{dimension.checksTotal} checks passed • evidence confidence{' '}
                          {dimension.confidence}%
                          {dimension.featureCoverage !== null
                            ? ' • score = 70% structural evidence + 30% requirement coverage'
                            : ''}
                        </p>
                      </div>

                      <div className="w-full lg:w-56 shrink-0">
                        <div className="flex justify-between text-[11px] font-mono mb-1">
                          <span className="text-slate-500">Score</span>
                          <span className="text-slate-200 font-bold">{dimension.score}%</span>
                        </div>
                        <ProgressBar value={dimension.score || 0} size="md" />
                      </div>
                    </div>

                    {dimension.evidence.length > 0 && (
                      <details className="mt-3 group">
                        <summary className="cursor-pointer text-[11px] font-mono text-cyan-300 hover:text-cyan-200 select-none">
                          {dimension.evidence.filter((evidence) => evidence.satisfied).length}/
                          {dimension.evidence.length} weighted checks satisfied — inspect evidence
                        </summary>
                        <ul className="mt-2 space-y-1.5">
                          {dimension.evidence.map((evidence, index) => (
                            <li
                              key={`${dimension.key}-${index}`}
                              className="flex items-start gap-2 text-[11px] leading-relaxed"
                            >
                              {evidence.satisfied ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <span className={evidence.satisfied ? 'text-slate-300' : 'text-slate-500'}>
                                  {evidence.label}
                                </span>
                                <span className="text-slate-500"> — {evidence.detail}</span>
                                {evidence.filePath && (
                                  <span className="font-mono text-[10px] text-cyan-400/70 block truncate">
                                    {evidence.filePath}
                                  </span>
                                )}
                              </div>
                              {typeof evidence.weight === 'number' && (
                                <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-600">
                                  {evidence.weight} pts
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {excluded.length > 0 && (
        <Card className="border-slate-800/60 bg-slate-950/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MinusCircle className="w-4 h-4 text-slate-500" />
              <CardTitle className="text-slate-300">Inapplicable criteria ({excluded.length})</CardTitle>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Weights redistributed</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {excluded.map((dimension) => (
              <div key={dimension.key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                <span className="text-xs font-medium text-slate-400 sm:w-52 shrink-0">{dimension.name}</span>
                <span className="text-[11px] text-slate-500 leading-relaxed">{dimension.exclusionReason}</span>
              </div>
            ))}
            <p className="text-[10px] font-mono text-slate-600 pt-1">
              Excluded criteria do not count against the project. Remaining weights are renormalised to 100%.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
