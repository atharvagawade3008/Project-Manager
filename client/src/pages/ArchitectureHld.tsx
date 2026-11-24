import React, { useEffect, useState } from 'react';
import {
  Layers,
  Sparkles,
  Server,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Network,
  Workflow,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import type { Project, OllamaStatus, HldDocument } from '../types';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface ArchitectureHldProps {
  activeProject?: Project | null;
  ollamaStatus?: OllamaStatus | null;
  onRefreshProject?: () => Promise<void> | void;
}

const STATUS_COLOR: Record<string, string> = {
  implemented: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
  partial: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  planned: 'bg-white/[0.04] border-white/[0.09] text-slate-400',
};

const LayerDiagram: React.FC<{ hld: HldDocument }> = ({ hld }) => {
  const layers = hld.layers || [];
  if (layers.length === 0) return null;

  const width = 720;
  const layerHeight = 74;
  const gap = 18;
  const totalHeight = layers.length * layerHeight + (layers.length - 1) * gap;

  return (
    <svg
      viewBox={`0 0 ${width} ${totalHeight}`}
      className="w-full"
      role="img"
      aria-label="High-level architecture diagram"
    >
      {layers.map((layer, li) => {
        const y = li * (layerHeight + gap);
        const comps = layer.components || [];
        const boxWidth = Math.min(150, (width - 40) / Math.max(comps.length, 1) - 12);
        const startX = (width - comps.length * (boxWidth + 12) + 12) / 2;

        return (
          <g key={li}>
            {/* Layer band */}
            <rect
              x={8}
              y={y}
              width={width - 16}
              height={layerHeight}
              rx={14}
              fill="rgba(255,255,255,0.02)"
              stroke="rgba(255,255,255,0.06)"
            />
            <text x={20} y={y + 16} fill="#94a3b8" fontSize={10} fontFamily="ui-monospace, monospace" letterSpacing={1.2}>
              {layer.name.toUpperCase()}
            </text>

            {comps.map((comp, ci) => {
              const bx = startX + ci * (boxWidth + 12);
              const by = y + 26;
              const color =
                comp.status === 'implemented'
                  ? '#34d399'
                  : comp.status === 'partial'
                  ? '#fbbf24'
                  : '#f96d3d';
              return (
                <g key={ci}>
                  <rect
                    x={bx}
                    y={by}
                    width={boxWidth}
                    height={38}
                    rx={8}
                    fill="rgba(249,109,61,0.06)"
                    stroke={color}
                    strokeOpacity={0.5}
                  />
                  <text
                    x={bx + boxWidth / 2}
                    y={by + 15}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize={10.5}
                    fontWeight={500}
                  >
                    {comp.name.length > 16 ? comp.name.slice(0, 15) + '…' : comp.name}
                  </text>
                  <text
                    x={bx + boxWidth / 2}
                    y={by + 29}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={8.5}
                  >
                    {comp.technology.length > 18 ? comp.technology.slice(0, 17) + '…' : comp.technology}
                  </text>
                </g>
              );
            })}

            {/* Arrow to next layer */}
            {li < layers.length - 1 && (
              <g>
                <line
                  x1={width / 2}
                  y1={y + layerHeight}
                  x2={width / 2}
                  y2={y + layerHeight + gap}
                  stroke="#f96d3d"
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
              </g>
            )}
          </g>
        );
      })}

      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#f96d3d" fillOpacity={0.6} />
        </marker>
      </defs>
    </svg>
  );
};

export const ArchitectureHld: React.FC<ArchitectureHldProps> = ({
  activeProject,
  ollamaStatus,
  onRefreshProject,
}) => {
  const [hld, setHld] = useState<HldDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeProject) {
        setHld(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const loaded = await api.getHld(activeProject.id);
        if (!cancelled) setHld(loaded);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load the high-level design.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  const handleGenerate = async () => {
    if (!activeProject || generating) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.generateHld(activeProject.id);
      setHld(result.hld);
      setNotice(`Generated ${result.hld.layers.length} layers with ${result.model}.`);
      await onRefreshProject?.();
    } catch (err: any) {
      setError(err?.message || 'Design generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-wide text-slate-500">
            Pages <span className="mx-1 text-slate-700">/</span> Architecture
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-none text-white sm:text-[30px]">
            High-Level Design
          </h1>
          <p className="mt-1.5 text-[11.5px] text-slate-500">
            Ollama-generated architecture blueprint, data flows and tech decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] ${
              ollamaStatus?.online
                ? 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
            }`}
            title={ollamaStatus?.endpoint || 'Local Ollama runtime'}
          >
            <Server className="h-3.5 w-3.5" />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ollamaStatus?.online ? '#34d399' : '#fb7185' }} />
            {ollamaStatus?.online ? `Ollama · ${ollamaStatus.effectiveModel || ollamaStatus.activeModel}` : 'Ollama offline'}
          </span>

          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={!activeProject || generating || !ollamaStatus?.online}
            loading={generating}
          >
            {!generating && (hld ? <Sparkles className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />)}
            {hld ? 'Regenerate design' : 'Generate HLD'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-[12px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && !error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-[12px] text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {!activeProject ? (
        <Card className="p-10 text-center">
          <Layers className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-3 text-[13px] text-slate-300">Select a project to design.</p>
          <p className="mx-auto mt-1 max-w-sm text-[11.5px] text-slate-500">
            Pick a project in the top bar, then let your local Ollama model draft its architecture.
          </p>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          <div className="h-[120px] animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-[320px] animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : !hld ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-8 text-center">
            <Layers className="mx-auto h-6 w-6 text-cyan-400" />
            <p className="mt-3 text-[13px] text-slate-200">No high-level design for this project yet.</p>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
              Ollama will draft layered components, data flows and tech decisions from the project's objective, tech
              stack and evidence scan — rendered as a live diagram below.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={handleGenerate}
              disabled={generating || !ollamaStatus?.online}
              loading={generating}
            >
              {!generating && <Layers className="h-3.5 w-3.5" />}
              Generate HLD
            </Button>
          </Card>

          <Card className="overflow-hidden">
            <img
              src="/images/hld-architecture.png"
              alt="Example layered architecture diagram"
              className="h-full w-full object-cover"
            />
          </Card>
        </div>
      ) : (
        <>
          {/* Summary + meta */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10">
                  <Network className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-white">{activeProject.name}</h2>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{hld.summary}</p>
                </div>
              </div>
              <div className="text-right text-[10.5px] text-slate-500">
                <p>{hld.layers.length} layers · {hld.dataFlows.length} flows</p>
                {hld.generatedAt && <p>{new Date(hld.generatedAt).toLocaleString()}</p>}
                {hld.model && <p className="font-mono">{hld.model}</p>}
              </div>
            </div>
          </Card>

          {/* Live diagram */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-cyan-400" />
              <h3 className="text-[14px] font-semibold text-white">Architecture diagram</h3>
              <span className="text-[10px] text-slate-600">generated by Ollama</span>
            </div>
            <div className="overflow-x-auto rounded-xl bg-[#0a0a0b] p-3">
              <LayerDiagram hld={hld} />
            </div>
          </Card>

          {/* Layers detail */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {hld.layers.map((layer, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-white">{layer.name}</h3>
                  <span className="text-[10px] text-slate-600">{layer.components.length} components</span>
                </div>
                {layer.description && (
                  <p className="mt-1 text-[11px] text-slate-500">{layer.description}</p>
                )}
                <div className="mt-3 space-y-2">
                  {layer.components.map((comp, ci) => (
                    <div
                      key={ci}
                      className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-slate-200">{comp.name}</p>
                        <p className="mt-0.5 text-[10.5px] text-slate-500">{comp.description}</p>
                        {comp.technology && (
                          <p className="mt-1 font-mono text-[10px] text-cyan-400/80">{comp.technology}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-wide ${
                          STATUS_COLOR[comp.status] || STATUS_COLOR.planned
                        }`}
                      >
                        {comp.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Data flows + decisions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-cyan-400" />
                <h3 className="text-[13px] font-semibold text-white">Data flows</h3>
              </div>
              {hld.dataFlows.length === 0 ? (
                <p className="text-[11px] text-slate-600">No flows recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {hld.dataFlows.map((flow, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11.5px]">
                      <span className="truncate font-medium text-slate-200">{flow.from}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-cyan-400" />
                      <span className="truncate font-medium text-slate-200">{flow.to}</span>
                      {flow.label && <span className="truncate text-slate-500">— {flow.label}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan-400" />
                <h3 className="text-[13px] font-semibold text-white">Tech decisions</h3>
              </div>
              {hld.techDecisions.length === 0 ? (
                <p className="text-[11px] text-slate-600">No decisions recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {hld.techDecisions.map((d, i) => (
                    <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <p className="text-[12px] font-medium text-slate-200">{d.decision}</p>
                      {d.rationale && <p className="mt-0.5 text-[10.5px] text-slate-500">{d.rationale}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {generating && (
            <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
              Ollama is drafting the architecture. A small local model can take one to three minutes.
            </div>
          )}
        </>
      )}
    </div>
  );
};
