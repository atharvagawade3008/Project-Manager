import type { FileMetadata } from '../../filesystem/filesystem.service.js';
import { SourceCorpus } from './corpus.js';
import { DimensionEvidenceItem, DimensionPartial, ProjectSignals } from './types.js';

export interface Check {
  label: string;
  detail: string;
  ratio: number; // 0..1
  weight: number;
  filePath?: string;
}

export function check(
  label: string,
  detail: string,
  satisfiedOrRatio: boolean | number,
  weight: number,
  filePath?: string
): Check {
  const ratio = typeof satisfiedOrRatio === 'boolean' ? (satisfiedOrRatio ? 1 : 0) : Math.max(0, Math.min(1, satisfiedOrRatio));
  return { label, detail, ratio, weight, filePath };
}

export function ratio(value: number, target: number): number {
  if (target <= 0) return 1;
  return Math.max(0, Math.min(1, value / target));
}

export function scoreChecks(
  checks: Check[],
  options: { confidenceBase?: number; summary: string; cap?: number; fileLimit?: number } = {
    summary: '',
  }
): DimensionPartial {
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weighted = checks.reduce((sum, c) => sum + c.ratio * c.weight, 0);
  const rawScore = totalWeight > 0 ? (weighted / totalWeight) * 100 : 0;
  const score = Math.min(options.cap ?? 100, Math.round(rawScore * 10) / 10);
  const passed = checks.filter((c) => c.ratio >= 0.75).length;
  const partial = checks.filter((c) => c.ratio > 0 && c.ratio < 0.75).length;
  const evidence: DimensionEvidenceItem[] = checks.map((c) => ({
    label: c.label,
    detail: c.detail,
    satisfied: c.ratio >= 0.75,
    filePath: c.filePath,
    weight: c.weight,
  }));

  const confidenceBase = options.confidenceBase ?? 76;
  const confidence = Math.min(
    96,
    Math.max(35, confidenceBase + (passed / Math.max(1, checks.length)) * 10 + (partial / Math.max(1, checks.length)) * 4)
  );

  return {
    score,
    confidence: Math.round(confidence * 10) / 10,
    summary: options.summary,
    evidence,
    fileRefs: Array.from(new Set(checks.map((c) => c.filePath).filter((f): f is string => Boolean(f)))).slice(
      0,
      options.fileLimit ?? 15
    ),
    checksPassed: passed,
    checksTotal: checks.length,
  };
}

export function filesMatching(signals: ProjectSignals, pattern: RegExp): FileMetadata[] {
  return signals.files.filter((f) => pattern.test(f.relativePath));
}

export function contentMatching(corpus: SourceCorpus, pattern: RegExp): Array<{ file: FileMetadata; content: string }> {
  return corpus.readAll().filter((e) => pattern.test(e.content));
}

export function anyContentMatching(corpus: SourceCorpus, pattern: RegExp): { file: FileMetadata; content: string } | null {
  return contentMatching(corpus, pattern)[0] || null;
}

export function countContentOccurrences(corpus: SourceCorpus, pattern: RegExp): number {
  if (!pattern.global) pattern = new RegExp(pattern.source, pattern.flags + 'g');
  let total = 0;
  for (const { content } of corpus.readAll()) {
    let match: RegExpExecArray | null;
    let perFile = 0;
    while ((match = pattern.exec(content)) !== null && perFile < 30) {
      total += 1;
      perFile += 1;
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }
  }
  return total;
}

export function dimensionForRequirements(
  requirements: Array<{ dimension: string; included: boolean; title: string }>,
  key: string
): number {
  return requirements.filter((r) => r.included && r.dimension === key).length;
}

export function sourceFileCount(signals: ProjectSignals): number {
  return signals.sourceFiles.length;
}

export function totalSourceLines(signals: ProjectSignals): number {
  return signals.files
    .filter((f) => f.fileCategory === 'SOURCE')
    .reduce((sum, f) => sum + f.linesOfCode, 0);
}

export function placeholderMarkers(corpus: SourceCorpus): number {
  return countContentOccurrences(
    corpus,
    /\b(?:TODO|FIXME)\b|\bnot implemented\b|\bcoming soon\b|\blorem ipsum\b|\bplaceholder (?:page|content|section|text|implementation|component|screen)\b|\bstub implementation\b/gi
  );
}

export function substantiveSourceFiles(signals: ProjectSignals, minLines = 30): FileMetadata[] {
  return signals.files.filter((f) => f.fileCategory === 'SOURCE' && f.linesOfCode >= minLines);
}

export function testFilesFor(signals: ProjectSignals): string[] {
  return signals.testFiles;
}
