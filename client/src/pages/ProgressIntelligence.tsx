import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  FolderGit2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Plus,
  History,
  Info,
  Radar,
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { AssessmentResponse, Project } from '../types';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { FolderDropzone } from '../components/filesystem/FolderDropzone';
import { AssessmentMetrics } from '../components/progress/AssessmentMetrics';
import { DimensionBreakdown } from '../components/progress/DimensionBreakdown';
import { FeatureAssessmentList } from '../components/progress/FeatureAssessmentList';
import { ScopeReviewPanel } from '../components/progress/ScopeReviewPanel';

interface ProgressIntelligenceProps {
  activeProject?: Project | null;
  onRefreshProject?: () => void | Promise<void>;
  onUpdateProject?: (id: string, data: Partial<Project>) => Promise<Project>;
}

const featureStatusSummary = (assessment: AssessmentResponse['assessment']) => {
  const counts = assessment?.scores.featureCounts;
  return [
    { label: 'Implemented', value: counts?.implemented ?? 0, className: 'text-emerald-400' },
    { label: 'Partial', value: counts?.partiallyImplemented ?? 0, className: 'text-amber-400' },
    { label: 'Placeholder', value: counts?.placeholder ?? 0, className: 'text-blue-400' },
    { label: 'Missing', value: counts?.missing ?? 0, className: 'text-rose-400' },
    { label: 'Cannot verify', value: counts?.cannotVerify ?? 0, className: 'text-slate-400' },
  ];
};

export const ProgressIntelligence: React.FC<ProgressIntelligenceProps> = ({
  activeProject,
  onRefreshProject,
  onUpdateProject,
}) => {
  const [data, setData] = useState<AssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [scanPercent, setScanPercent] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Folder / preview path state
  const [folderPathInput, setFolderPathInput] = useState(activeProject?.rootPath || '');
  const [previewUrl, setPreviewUrl] = useState('');
  const [validatingPath, setValidatingPath] = useState(false);
  const [pathValidationResult, setPathValidationResult] = useState<{ valid: boolean; message: string } | null>(null);

  const [scopeBusy, setScopeBusy] = useState(false);
  const [classificationBusy, setClassificationBusy] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setFolderPathInput(activeProject.rootPath || '');
      setData(null);
      setError(null);
      setSuccessMsg(null);
      loadAssessment(activeProject.id);
    }
  }, [activeProject?.id]);

  const loadAssessment = async (projectId: string) => {
    try {
      setLoading(true);
      const response = await api.getAssessment(projectId);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Could not load the assessment.');
    } finally {
      setLoading(false);
    }
  };

  const persistRootPath = async (rawPath: string) => {
    if (!activeProject) return;
    const path = rawPath.trim();
    if (!path || path === activeProject.rootPath) return;

    setFolderPathInput(path);
    if (onUpdateProject) {
      // App owns the project list and waits for its refresh, so the dashboard
      // card is updated before this resolves.
      await onUpdateProject(activeProject.id, { rootPath: path });
    } else {
      await api.updateProject(activeProject.id, { rootPath: path });
      await onRefreshProject?.();
    }
  };

  const handleValidatePath = async () => {
    if (!folderPathInput.trim()) {
      setPathValidationResult({ valid: false, message: 'Please enter a folder path.' });
      return;
    }
    try {
      setValidatingPath(true);
      const res = await api.validateDirectory(folderPathInput.trim());
      if (res.valid && res.resolvedPath) {
        setFolderPathInput(res.resolvedPath);
        await persistRootPath(res.resolvedPath);
        setPathValidationResult({ valid: true, message: `Valid directory (${res.resolvedPath})` });
      } else {
        setPathValidationResult({ valid: false, message: res.error || 'Invalid directory.' });
      }
    } catch (err: any) {
      setPathValidationResult({ valid: false, message: err.message || 'Validation error' });
    } finally {
      setValidatingPath(false);
    }
  };

  const handleTriggerScan = async (refreshScope = false) => {
    if (!activeProject) return;

    const pathToUse = folderPathInput.trim() || activeProject.rootPath;
    if (!pathToUse) {
      setError('Connect a local project folder before running an assessment.');
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      setScanning(true);
      setError(null);
      setSuccessMsg(null);
      setScanStage('STAGE 1: Filesystem discovery');
      setScanPercent(8);
      setScanMessage('Resolving and validating the project folder…');

      // Resolve before writing so a folder name or partially typed path can
      // never replace the linked root with a non-canonical value.
      const validation = await api.validateDirectory(pathToUse);
      if (!validation.valid || !validation.resolvedPath) {
        setError(validation.error || 'The project folder is not accessible.');
        return;
      }
      const resolvedPath = validation.resolvedPath;
      setFolderPathInput(resolvedPath);
      await persistRootPath(resolvedPath);

      setScanMessage('Indexing source files…');
      timer = setInterval(() => {
        setScanPercent((value) => Math.min(92, value + 4));
      }, 700);

      const result = await api.scanProject(activeProject.id, {
        previewUrl: previewUrl.trim() || undefined,
        refreshScope,
      });

      setScanStage('COMPLETE');
      setScanPercent(100);
      setScanMessage(`Assessed ${result.scannedFilesCount} files across the ${result.projectTypeLabel} framework.`);

      setSuccessMsg(
        `Evaluation Framework V2 complete — product ${result.productCompletion ?? 'N/A'}%, technical ${
          result.technicalCompletion ?? 'N/A'
        }%, readiness ${result.productionReadiness ?? 'N/A'}%, confidence ${result.evaluationConfidence}%.${
          result.scopeReviewRequired
            ? ' This is provisional until you review and approve the inferred scope.'
            : result.aiAssisted
            ? ' Ollama interpreted ambiguous feature evidence; final scores remain deterministic.'
            : ''
        }`
      );

      await loadAssessment(activeProject.id);
      await onRefreshProject?.();
    } catch (err: any) {
      setError(err.message || 'Assessment failed.');
    } finally {
      if (timer) clearInterval(timer);
      setScanning(false);
    }
  };

  const handleClassificationChange = async (projectType: string) => {
    if (!activeProject) return;
    try {
      setClassificationBusy(true);
      setError(null);
      await api.updateClassification(activeProject.id, projectType);
      await handleTriggerScan(false);
    } catch (err: any) {
      setError(err.message || 'Could not update classification.');
    } finally {
      setClassificationBusy(false);
    }
  };

  const handleScopeSave: React.ComponentProps<typeof ScopeReviewPanel>['onSave'] = async (payload) => {
    if (!activeProject) return;
    try {
      setScopeBusy(true);
      setError(null);
      await api.updateScope(activeProject.id, payload);
      await loadAssessment(activeProject.id);
      setSuccessMsg('Scope updated. Run a new assessment to recalculate the scores.');
    } catch (err: any) {
      setError(err.message || 'Could not update scope.');
    } finally {
      setScopeBusy(false);
    }
  };

  const handleApproveScope = async () => {
    if (!activeProject) return;
    try {
      setScopeBusy(true);
      setError(null);
      await api.approveScope(activeProject.id);
      setScopeBusy(false);
      await handleTriggerScan(false);
    } catch (err: any) {
      setError(err.message || 'Could not approve scope.');
      setScopeBusy(false);
    }
  };

  const handleConvertToTask = async (recId: string) => {
    try {
      await api.convertRecommendationToTask(recId);
      setSuccessMsg('Recommendation converted into a task.');
      if (activeProject) {
        await loadAssessment(activeProject.id);
        if (onRefreshProject) onRefreshProject();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to convert recommendation.');
    }
  };

  if (!activeProject) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="p-12 text-center text-slate-400">
          <FolderGit2 className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No Project Selected</h3>
          <p className="text-xs text-slate-500 mt-1">
            Select a project from the top bar to inspect its evidence-based progress assessment.
          </p>
        </Card>
      </div>
    );
  }

  const assessment = data?.assessment || null;
  const dimensions = assessment?.dimensions || [];
  const dimensionOptions = dimensions.map((dimension) => ({ key: dimension.key, name: dimension.name }));
  const projectTypes = data?.framework.projectTypes || [];
  const comparison = data?.comparison;

  const recommendations = (activeProject.recommendations || []).filter((recommendation) => !recommendation.isConvertedToTask);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Progress Intelligence</h1>
            <Badge variant="cyan" size="md">
              Evaluation Framework V2
            </Badge>
            {assessment && (
              <Badge variant={assessment.scopeApproved ? 'success' : 'warning'} size="md">
                {assessment.scopeApproved ? 'Definitive' : 'Provisional'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Project-aware, evidence-grounded assessment. Classification selects the evaluation framework; the backend
            computes product, technical and production-readiness scores deterministically from applicable weighted
            dimensions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {assessment && (
            <Button
              variant="outline"
              size="md"
              disabled={scanning}
              onClick={() => {
                if (
                  window.confirm(
                    'Re-detect scope from the codebase? Existing planned and user-confirmed requirements are preserved; stale AI-inferred items are excluded.'
                  )
                ) {
                  handleTriggerScan(true);
                }
              }}
            >
              <Radar className="w-4 h-4" />
              <span>Re-detect scope</span>
            </Button>
          )}
          <Button
            onClick={() => handleTriggerScan(false)}
            variant="glow"
            size="md"
            loading={scanning}
            disabled={scanning}
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Assessing…' : assessment ? 'Run new assessment' : 'Run V2 assessment'}</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Source folder & optional runtime verification */}
      <Card className="border-slate-800/90">
        <CardContent className="p-4 space-y-3">
          <FolderDropzone
            currentPath={folderPathInput}
            onPathChange={setFolderPathInput}
            onPathValidated={persistRootPath}
            onScanNow={() => handleTriggerScan(false)}
            scanning={scanning}
          />

          <div className="flex flex-col md:flex-row md:items-end gap-2 pt-2 border-t border-slate-800/60">
            <div className="flex-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                Optional preview URL for runtime verification (loopback only)
              </label>
              <input
                value={previewUrl}
                onChange={(event) => setPreviewUrl(event.target.value)}
                placeholder="http://localhost:5173"
                className="w-full bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleValidatePath} loading={validatingPath}>
              Validate folder
            </Button>
          </div>

          {pathValidationResult && (
            <p className={`text-[11px] font-mono ${pathValidationResult.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pathValidationResult.message}
            </p>
          )}

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Connected root: {activeProject.rootPath || 'None'}</span>
            <span>{activeProject.lastScanAt ? `Last assessed: ${new Date(activeProject.lastScanAt).toLocaleString()}` : 'Never assessed'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Scan progress */}
      {scanning && (
        <Card className="border-cyan-500/40 bg-gradient-to-r from-blue-950/30 to-cyan-950/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-300 font-semibold flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {scanStage}
              </span>
              <span className="text-slate-300">{scanPercent}%</span>
            </div>
            <ProgressBar value={scanPercent} size="md" color="cyan" />
            <p className="text-[11px] font-mono text-slate-400">{scanMessage}</p>
          </CardContent>
        </Card>
      )}

      {loading && !assessment && (
        <Card className="p-10 text-center text-slate-500 text-xs">Loading assessment…</Card>
      )}

      {!loading && !assessment && (
        <Card className="p-8 md:p-10">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">No V2 assessment yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The first scan classifies the project, discovers its scope, and assesses every requirement against source
              evidence. Product completion, technical completion and production readiness are reported independently —
              no single averaged score.
            </p>
            <Button variant="glow" onClick={() => handleTriggerScan(false)} loading={scanning} disabled={scanning}>
              <Sparkles className="w-4 h-4" />
              Run Evaluation Framework V2
            </Button>
            <p className="text-[10px] font-mono text-slate-600">
              Previous V1 snapshots are preserved and displayed for comparison; they are never overwritten.
            </p>
          </div>
        </Card>
      )}

      {assessment && (
        <>
          {/* Summary + feature counts */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  {assessment.summary || assessment.classification?.rationale}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-mono">
                {featureStatusSummary(assessment).map((entry) => (
                  <span key={entry.label} className="text-slate-500">
                    {entry.label}: <strong className={entry.className}>{entry.value}</strong>
                  </span>
                ))}
                <span className="text-slate-500">
                  Verified: <strong className="text-emerald-400">{assessment.scores.featureCounts.verified}</strong>
                </span>
                <span className="text-slate-600">
                  {assessment.createdAt ? new Date(assessment.createdAt).toLocaleString() : ''}
                </span>
              </div>
            </CardContent>
          </Card>

          <AssessmentMetrics
            assessment={assessment}
            comparison={
              comparison || {
                available: false,
                explanation: 'No earlier V1 snapshot exists for this project.',
              }
            }
            projectTypes={projectTypes}
            onClassificationChange={handleClassificationChange}
            savingClassification={classificationBusy}
          />

          {/* Scope review */}
          {data && (
            <ScopeReviewPanel
              scope={data.scope}
              dimensionOptions={dimensionOptions}
              onSave={handleScopeSave}
              onApprove={handleApproveScope}
              busy={scopeBusy || scanning}
            />
          )}

          <DimensionBreakdown dimensions={dimensions} />

          <FeatureAssessmentList features={assessment.features} />

          {/* Recommended next actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-cyan-400" />
                <CardTitle>Recommended next actions</CardTitle>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Ranked by evidence gaps</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.length > 0 ? (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-100">{rec.title}</h5>
                        <Badge variant={rec.priority === 'CRITICAL' ? 'danger' : 'warning'} size="sm">
                          {rec.priority}
                        </Badge>
                        <Badge variant="cyan" size="sm">
                          {rec.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{rec.explanation}</p>
                      <p className="text-[11px] font-mono text-slate-500">Action: {rec.recommendedAction}</p>
                    </div>
                    <Button
                      onClick={() => handleConvertToTask(rec.id)}
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40"
                    >
                      <Plus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Convert to task</span>
                    </Button>
                  </div>
                ))
              ) : assessment.nextActions.length > 0 ? (
                assessment.nextActions.map((action, index) => (
                  <div key={index} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-sm font-semibold text-slate-100">{action.title}</h5>
                      <Badge variant={action.priority === 'CRITICAL' ? 'danger' : 'warning'} size="sm">
                        {action.priority}
                      </Badge>
                      {action.dimension && (
                        <Badge variant="cyan" size="sm">
                          {action.dimension}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{action.explanation}</p>
                    <p className="text-[11px] font-mono text-slate-500">Action: {action.recommendedAction}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No priority gaps were identified in this assessment.</p>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <CardTitle>Assessment history</CardTitle>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Append-only</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-800">
                      <th className="py-1.5 pr-3 font-normal">Date</th>
                      <th className="py-1.5 pr-3 font-normal">Framework</th>
                      <th className="py-1.5 pr-3 font-normal">Type</th>
                      <th className="py-1.5 pr-3 font-normal">Product</th>
                      <th className="py-1.5 pr-3 font-normal">Technical</th>
                      <th className="py-1.5 pr-3 font-normal">Readiness</th>
                      <th className="py-1.5 font-normal">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.history || []).slice().reverse().map((row) => (
                      <tr key={row.id} className="border-b border-slate-800/50 text-slate-300">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                        <td className="py-1.5 pr-3">
                          <Badge variant="cyan" size="sm">
                            {row.frameworkVersion}
                          </Badge>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-400">{row.projectTypeLabel}</td>
                        <td className="py-1.5 pr-3">{row.productCompletion ?? '—'}%</td>
                        <td className="py-1.5 pr-3">{row.technicalCompletion ?? '—'}%</td>
                        <td className="py-1.5 pr-3">{row.productionReadiness ?? '—'}%</td>
                        <td className="py-1.5">{row.evaluationConfidence}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(data?.legacySnapshots.length || 0) > 0 && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-[11px] font-mono text-slate-400 hover:text-slate-200">
                    Preserved V1 snapshots ({data?.legacySnapshots.length}) — kept for audit, not directly comparable
                  </summary>
                  <div className="mt-2 space-y-1">
                    {data?.legacySnapshots.map((snapshot) => (
                      <div key={snapshot.id} className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500">
                        <Badge variant="default" size="sm">
                          {snapshot.frameworkVersion}
                        </Badge>
                        <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
                        <span>overall {snapshot.overallProgress}%</span>
                        <span>confidence {snapshot.verificationConfidence}%</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Methodology notes */}
          {assessment.notes.length > 0 && (
            <Card className="border-slate-800/60 bg-slate-950/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500" />
                  <CardTitle className="text-slate-300">How these scores were produced</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {assessment.notes.map((note, index) => (
                    <li key={index} className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                      <span className="text-slate-700 mt-0.5">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                {assessment.website?.runtime && assessment.website.runtime.checkedRoutes > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {assessment.website.runtime.successfulRoutes}/{assessment.website.runtime.checkedRoutes} routes
                    verified over HTTP at {assessment.website.runtime.baseUrl}
                  </div>
                )}
                {assessment.website?.runtime && assessment.website.runtime.failedRoutes.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 text-[11px] font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Failed routes: {assessment.website.runtime.failedRoutes.join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
