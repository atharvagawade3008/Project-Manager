import { OllamaService } from '../../ollama/ollama.service.js';
import { normalizeAiFeatureUpdates, round1 } from './scoring.js';
import { AssessmentPayload, FeatureAssessment } from './types.js';

export interface AiRefinementResult {
  features: FeatureAssessment[];
  applied: number;
  error?: string;
}

function extractJson(text: string): any | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const objectStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');
  let start = -1;
  let open = '';
  let close = '';

  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
    start = objectStart;
    open = '{';
    close = '}';
  } else if (arrayStart >= 0) {
    start = arrayStart;
    open = '[';
    close = ']';
  }
  if (start < 0) return null;

  const end = cleaned.lastIndexOf(close);
  if (end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Ask the local model to interpret ambiguous feature evidence. The model can
 * change evidence classification, but the backend clamps completion to the
 * status band and rejects upgrades lacking corroborating evidence.
 */
export async function refineFeaturesWithOllama(
  projectName: string,
  projectTypeLabel: string,
  features: FeatureAssessment[]
): Promise<AiRefinementResult> {
  const candidates = features
    .filter(
      (f) =>
        f.included &&
        f.evidences.length > 0 &&
        ['PARTIALLY_IMPLEMENTED', 'PLACEHOLDER', 'MISSING', 'CANNOT_VERIFY'].includes(f.status)
    )
    .slice(0, 10);

  if (candidates.length === 0) return { features, applied: 0 };

  let online = false;
  try {
    online = (await OllamaService.checkStatus()).online;
  } catch {
    online = false;
  }
  if (!online) return { features, applied: 0 };

  const payload = candidates.map((f) => ({
    id: f.id,
    title: f.name,
    expected: f.expectedFunctionality.slice(0, 240),
    status: f.status,
    completion: f.completion,
    files: f.evidences.slice(0, 3).map((e) => ({
      path: e.filePath,
      evidence: e.evidenceDescription.slice(0, 240),
    })),
    missing: f.missingRequirements,
  }));

  const prompt = `You are an evidence interpreter for a project progress assessment.
Project: "${projectName}" (${projectTypeLabel}).

For each requirement below you are given the implementation evidence that was found by static analysis. Re-evaluate ONLY from that evidence. Do not invent files or behaviour.

Allowed statuses:
- IMPLEMENTED: substantive, wired implementation evidence exists.
- PARTIALLY_IMPLEMENTED: some real implementation exists but key behaviour is missing or unfinished.
- PLACEHOLDER: only a stub, empty handler, route without content, TODO or placeholder exists.
- MISSING: no implementation evidence.
- CANNOT_VERIFY: evidence exists but cannot be inspected (binary/external).
- NOT_APPLICABLE: the requirement does not apply to this project.

Rules:
- A button or route existing is not proof it works.
- Existing tests are useful but their absence must NOT make an implemented feature incomplete.
- Estimate completion inside the band for the status: IMPLEMENTED 75-90, PARTIALLY_IMPLEMENTED 30-70, PLACEHOLDER 5-25, MISSING 0-5.
- Confidence is 0-100 and reflects the strength of the cited evidence.

Return strict JSON only, no markdown, in this shape:
{"features":[{"id":"...","status":"IMPLEMENTED","completion":82,"confidence":78,"missing":"short remaining gap or empty string"}]}

Requirements:
${JSON.stringify(payload, null, 2)}`;

  try {
    const response = await OllamaService.generate(prompt);
    const parsed = extractJson(response);
    const updates: any[] = Array.isArray(parsed) ? parsed : parsed?.features;
    if (!Array.isArray(updates) || updates.length === 0) {
      return { features, applied: 0, error: 'Model returned no usable JSON feature updates.' };
    }

    const normalized = normalizeAiFeatureUpdates(features, updates);
    return {
      features: normalized.features,
      applied: normalized.applied,
    };
  } catch (error: any) {
    return { features, applied: 0, error: error?.message || 'Ollama interpretation failed.' };
  }
}

/**
 * Narrative synthesis only. The model never receives the ability to change the
 * computed scores: the numbers below are inputs, not outputs.
 */
export async function generateAssessmentNarrative(payload: AssessmentPayload): Promise<string | null> {
  try {
    const status = await OllamaService.checkStatus();
    if (!status.online) return null;

    const dimensions = payload.dimensions
      .filter((d) => d.applicable)
      .map((d) => `- ${d.name} (${d.metric}): ${d.score}% — ${d.summary}`)
      .join('\n');
    const gaps = payload.features
      .filter((f) => f.included && ['MISSING', 'PLACEHOLDER', 'PARTIALLY_IMPLEMENTED'].includes(f.status))
      .slice(0, 6)
      .map((f) => `- ${f.name}: ${f.status} — ${f.missingRequirements || ''}`)
      .join('\n');

    const prompt = `You are Project OS Progress Intelligence. Write exactly three sentences summarising this evidence-based assessment.

Project: ${payload.projectTypeLabel}
Product completion: ${payload.scores.productCompletion ?? 'n/a'}%
Technical completion: ${payload.scores.technicalCompletion ?? 'n/a'}%
Production readiness: ${payload.scores.productionReadiness ?? 'n/a'}%
Evaluation confidence: ${payload.scores.evaluationConfidence}%
Requirements: ${payload.features.length} assessed, ${payload.scores.featureCounts.missing} missing, ${payload.scores.featureCounts.partiallyImplemented} partial, ${payload.scores.featureCounts.placeholder} placeholder.

Dimension scores:
${dimensions}

Largest gaps:
${gaps || '- none detected'}

Do not invent facts, do not change the given percentages, and do not claim visual or runtime verification beyond HTTP checks.`;

    const text = (await OllamaService.generate(prompt)).trim();
    if (!text) return null;
    return text.replace(/\s+/g, ' ').slice(0, 900);
  } catch {
    return null;
  }
}

export function roundConfidence(value: number): number {
  return round1(value);
}
