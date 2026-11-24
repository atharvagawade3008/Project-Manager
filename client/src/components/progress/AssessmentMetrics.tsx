import React, { useEffect, useState } from 'react';
import {
  Target,
  Wrench,
  Rocket,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import type { AssessmentResponse, ProjectAssessment } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

interface AssessmentMetricsProps {
  assessment: ProjectAssessment;
  comparison: AssessmentResponse['comparison'];
  projectTypes: Array<{ value: string; label: string }>;
  onClassificationChange: (projectType: string) => Promise<void>;
  savingClassification?: boolean;
}

const metricDefinitions = [
  {
    key: 'productCompletion' as const,
    label: 'Product Completion',
    hint: 'Completeness of the intended user-facing product',
    icon: Target,
    color: 'gradient' as const,
    valueClass: 'text-slate-100',
  },
  {
    key: 'technicalCompletion' as const,
    label: 'Technical Completion',
    hint: 'Underlying technical requirements and architecture',
    icon: Wrench,
    color: 'cyan' as const,
    valueClass: 'text-cyan-400',
  },
  {
    key: 'productionReadiness' as const,
    label: 'Production Readiness',
    hint: 'Testing, reliability, security, accessibility, deployment',
    icon: Rocket,
    color: 'amber' as const,
    valueClass: 'text-amber-400',
  },
];

export const AssessmentMetrics: React.FC<AssessmentMetricsProps> = ({
  assessment,
  comparison,
  projectTypes,
  onClassificationChange,
  savingClassification = false,
}) => {
  const [selectedType, setSelectedType] = useState(assessment.projectType);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    setSelectedType(assessment.projectType);
  }, [assessment.projectType]);

  const counts = assessment.scores?.featureCounts || ({} as any);

  const handleApply = async () => {
    await onClassificationChange(selectedType);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metricDefinitions.map((definition) => {
          const value = assessment[definition.key] as number | null;
          const Icon = definition.icon;
          return (
            <Card key={definition.key} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{definition.label}</span>
                <Icon className="w-4 h-4 text-slate-500" />
              </div>
              <div className={`text-3xl font-bold font-mono mt-2 mb-2 ${definition.valueClass}`}>
                {value === null || value === undefined ? 'N/A' : `${value}%`}
              </div>
              <ProgressBar value={value || 0} size="md" color={definition.color} />
              <span className="text-[10px] font-mono text-slate-500 mt-2 block leading-relaxed">{definition.hint}</span>
            </Card>
          );
        })}

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Evaluation Confidence</span>
            <ShieldCheck className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-2 mb-2">
            {assessment.evaluationConfidence}%
          </div>
          <ProgressBar value={assessment.evaluationConfidence} size="md" color="emerald" />
          <span className="text-[10px] font-mono text-slate-500 mt-2 block leading-relaxed">
            {assessment.scopeApproved ? 'Scope approved' : 'Provisional — scope not approved'} •{' '}
            {counts.verified || 0} verified • {counts.applicable || 0} applicable
          </span>
        </Card>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <span>These three metrics are independent and are never averaged into a single score.</span>
        <span>
          {assessment.projectTypeLabel} • Framework {assessment.frameworkVersion}
          {assessment.aiAssisted ? ' • AI-assisted evidence interpretation' : ''}
        </span>
      </div>

      {comparison.available && comparison.previous && (
        <Card className="border-amber-800/60 bg-amber-950/20">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-amber-200">Methodology change, not development progress</span>
                <Badge variant="warning" size="sm">
                  V1 → V2
                </Badge>
              </div>
              <p className="text-xs text-amber-100/80 leading-relaxed">{comparison.explanation}</p>
              <div className="flex flex-wrap gap-4 pt-1 text-[11px] font-mono text-amber-200/90">
                <span>
                  Previous V1 overall: <strong>{comparison.previous.overallProgress}%</strong>
                </span>
                <span>
                  Current V2 product: <strong>{assessment.productCompletion ?? 'N/A'}%</strong>
                </span>
                <span className="text-amber-200/60">
                  {new Date(comparison.previous.createdAt).toLocaleString()} • {comparison.previous.frameworkVersion}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <CardTitle>Project classification</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={assessment.projectTypeSource === 'USER' ? 'purple' : 'cyan'} size="sm">
              {assessment.projectTypeSource === 'USER' ? 'User-corrected' : 'Automatic'}
            </Badge>
            <span className="text-[11px] font-mono text-slate-500">{assessment.classificationConfidence}% confidence</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">{assessment.classification?.rationale}</p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as any)}
              className="flex-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {projectTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleApply}
              loading={savingClassification}
              disabled={savingClassification || selectedType === assessment.projectType}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Apply & re-assess</span>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowEvidence((value) => !value)}
            className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEvidence ? 'rotate-180' : ''}`} />
            {assessment.classification?.evidence?.length || 0} classification signal(s)
          </button>

          {showEvidence && (
            <ul className="space-y-1.5 pt-1">
              {(assessment.classification?.evidence || []).map((signal, index) => (
                <li key={index} className="flex items-start gap-2 text-[11px] text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          )}

          {assessment.classification?.alternatives?.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Alternatives</span>
              {assessment.classification.alternatives.slice(1, 4).map((alternative) => (
                <Badge key={alternative.projectType} variant="default" size="sm">
                  {alternative.label} · {alternative.score}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
