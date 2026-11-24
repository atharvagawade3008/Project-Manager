import prisma from '../../db.js';
import { OllamaService } from '../ollama/ollama.service.js';

export const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;
export type PlanTaskStatus = (typeof TASK_STATUSES)[number];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type PlanPriority = (typeof PRIORITIES)[number];

const LIMITS = { phases: 6, modules: 6, milestones: 4, tasks: 8 };

interface DraftTask {
  title: string;
  description: string;
  priority: PlanPriority;
  status: PlanTaskStatus;
  estimatedHours: number | null;
  deadline: Date | null;
}

interface DraftMilestone {
  title: string;
  description: string;
  targetDate: Date | null;
}

interface DraftModule {
  name: string;
  description: string;
  milestones: DraftMilestone[];
  tasks: DraftTask[];
}

interface DraftPhase {
  name: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
  modules: DraftModule[];
}

interface PlanDraft {
  summary: string;
  phases: DraftPhase[];
}

function httpError(message: string, status = 400) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Small models sometimes echo the schema placeholders verbatim.
    if (/^(\.\.\.|…|YYYY-MM-DD|<[^>]*>)$/i.test(trimmed)) return fallback;
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  // Dates in the model output are plain calendar days; avoid timezone drift.
  const iso = value.trim().match(/^\d{4}-\d{2}-\d{2}$/) ? `${value.trim()}T12:00:00.000Z` : value.trim();
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeTaskStatus(value: unknown): PlanTaskStatus {
  const raw = text(value).toUpperCase().replace(/[\s-]+/g, '_');
  if (/^(COMPLETE|COMPLETED|DONE|FINISHED)$/.test(raw)) return 'COMPLETED';
  if (/^(IN_PROGRESS|INPROGRESS|STARTED|DOING|ACTIVE|WIP)$/.test(raw)) return 'IN_PROGRESS';
  if (/^(BLOCKED|BLOCKER|ON_HOLD|WAITING|STUCK)$/.test(raw)) return 'BLOCKED';
  return 'NOT_STARTED';
}

function normalizePriority(value: unknown): PlanPriority {
  const raw = text(value).toUpperCase();
  if ((PRIORITIES as readonly string[]).includes(raw)) return raw as PlanPriority;
  if (raw === 'URGENT') return 'CRITICAL';
  if (raw === 'NORMAL') return 'MEDIUM';
  return 'MEDIUM';
}

function normalizeHours(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number.parseFloat(text(value));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(Math.round(num * 10) / 10, 200);
}

/** Models occasionally wrap JSON in prose or fences — dig the object out. */
function extractJsonObject(raw: string): any {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw httpError('Ollama did not return a plan it could parse. Try generating again.', 502);
  }

  const slice = body.slice(start, end + 1);
  const candidates = [slice, slice.replace(/,\s*([}\]])/g, '$1')];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the repaired candidate */
    }
  }

  throw httpError('Ollama returned an incomplete plan. Try again, or select a larger local model.', 502);
}

export function parsePlanDraft(raw: string): PlanDraft {
  const parsed = extractJsonObject(raw);
  const phasesRaw = asArray(parsed.phases);

  if (phasesRaw.length === 0) {
    throw httpError('Ollama returned a plan without phases. Try generating again.', 502);
  }

  const phases: DraftPhase[] = phasesRaw.slice(0, LIMITS.phases).map((phase: any, index: number) => {
    const modulesRaw = asArray(phase?.modules);
    const modules: DraftModule[] = (modulesRaw.length > 0 ? modulesRaw : [{ name: 'Core work' }])
      .slice(0, LIMITS.modules)
      .map((mod: any) => {
        const tasksRaw = asArray(mod?.tasks);
        return {
          name: text(mod?.name, `Module ${index + 1}`) || `Module ${index + 1}`,
          description: text(mod?.description),
          milestones: asArray(mod?.milestones)
            .slice(0, LIMITS.milestones)
            .map((ms: any) => ({
              title: text(typeof ms === 'string' ? ms : ms?.title),
              description: text(typeof ms === 'string' ? '' : ms?.description),
              targetDate: parseDate(typeof ms === 'string' ? null : ms?.targetDate),
            }))
            .filter((ms) => ms.title.length > 0),
          tasks: tasksRaw
            .slice(0, LIMITS.tasks)
            .map((task: any) => ({
              title: text(typeof task === 'string' ? task : task?.title),
              description: text(typeof task === 'string' ? '' : task?.description),
              priority: normalizePriority(task?.priority),
              status: normalizeTaskStatus(task?.status),
              estimatedHours: normalizeHours(task?.estimatedHours),
              deadline: parseDate(task?.deadline),
            }))
            .filter((task) => task.title.length > 0),
        };
      })
      .filter((mod) => mod.tasks.length > 0 || mod.milestones.length > 0 || mod.name.length > 0);

    return {
      name: text(phase?.name, `Phase ${index + 1}`) || `Phase ${index + 1}`,
      description: text(phase?.description),
      startDate: parseDate(phase?.startDate),
      endDate: parseDate(phase?.endDate),
      modules,
    };
  });

  return {
    summary: text(parsed.summary),
    phases,
  };
}

/**
 * Only structural failures are worth a second (slow) local generation pass —
 * a partially varied status mix is still a valid plan the user can edit.
 */
function planIssues(draft: PlanDraft): string[] {
  const issues: string[] = [];
  const taskCount = draft.phases.reduce((sum, p) => sum + p.modules.reduce((s, m) => s + m.tasks.length, 0), 0);

  if (draft.phases.length < 3) {
    issues.push(`The plan has ${draft.phases.length} phase(s) but exactly 3 phases are required.`);
  }
  if (taskCount < 6) {
    issues.push(`The plan has only ${taskCount} tasks; at least 6 concrete tasks are required.`);
  }

  return issues;
}

function phaseStatus(tasks: Array<{ status: string }>): string {
  if (tasks.length === 0) return 'NOT_STARTED';
  if (tasks.every((t) => t.status === 'COMPLETED')) return 'COMPLETED';
  if (tasks.some((t) => t.status === 'COMPLETED' || t.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function formatDate(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : 'unscheduled';
}

export class AiService {
  /** Full project hierarchy used by the planner view. */
  public static async getPlan(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        phases: { orderBy: { orderIndex: 'asc' }, include: { modules: { orderBy: { orderIndex: 'asc' }, include: { milestones: true } } } },
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!project) throw httpError('Project not found', 404);
    return project;
  }

  public static async generatePlan(projectId: string, options: { replace?: boolean } = {}) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        phases: { orderBy: { orderIndex: 'asc' } },
        tasks: { orderBy: { orderIndex: 'asc' } },
        assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        recommendations: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!project) throw httpError('Project not found', 404);

    const status = await OllamaService.checkStatus();
    if (!status.online) {
      throw httpError(
        `Ollama is not responding at ${status.endpoint}. Start it with "ollama serve" and try again.`,
        503
      );
    }

    let techStack: string[] = [];
    try {
      techStack = JSON.parse(project.techStack);
    } catch {
      techStack = [];
    }

    const assessment = project.assessments[0];
    const scopedFeatures = assessment
      ? parseJsonArray(assessment.featuresJson)
          .filter((f: any) => f?.included !== false && f?.name)
          .slice(0, 12)
          .map((f: any) => `- ${f.name} (${f.status || 'unknown'})`)
      : [];

    const taskSummary = TASK_STATUSES.map(
      (s) => `${s}: ${project.tasks.filter((t) => t.status === s).length}`
    ).join(', ');

    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 84);
    const deadline = project.targetDeadline ? formatDate(project.targetDeadline) : formatDate(horizon);

    const context = [
      `Project name: ${project.name}`,
      `Category: ${project.category} | Complexity: ${project.complexity}`,
      `Status: ${project.status} | Headline progress: ${project.overallProgress}% | Verification confidence: ${project.verificationConfidence}%`,
      `Description: ${project.description || 'none'}`,
      `Objective: ${project.objective || 'none'}`,
      `Expected deliverables: ${project.expectedDeliverables || 'none'}`,
      `Tech stack: ${techStack.length ? techStack.join(', ') : 'not recorded'}`,
      `Dates: today is ${today}, target deadline is ${deadline}`,
      `Existing phases: ${project.phases.length ? project.phases.map((p) => `${p.name} [${p.status}]`).join(', ') : 'none'}`,
      `Existing tasks by status: ${taskSummary}`,
      assessment
        ? `Latest assessment: product ${assessment.productCompletion ?? 0}%, technical ${assessment.technicalCompletion ?? 0}%, readiness ${assessment.productionReadiness ?? 0}%`
        : 'Latest assessment: none yet',
    ];

    if (scopedFeatures.length > 0) {
      context.push(`Known features (from the latest evidence scan):\n${scopedFeatures.join('\n')}`);
    }
    if (project.recommendations.length > 0) {
      context.push(
        `Recent AI recommendations:\n${project.recommendations
          .map((r) => `- ${r.title}: ${r.recommendedAction || r.explanation}`)
          .join('\n')}`
      );
    }

    const systemPrompt = [
      'You are a meticulous senior software project planner.',
      'You turn a project brief and its current evidence into a realistic forward-looking execution plan.',
      'You always answer with a single valid JSON object and never with prose, markdown or comments.',
    ].join(' ');

    const prompt = `Design the forward-looking execution plan for this project.

${context.join('\n')}

Return ONLY a JSON object with exactly this shape:
{
  "summary": "one or two sentences on where the project stands and what the plan focuses on",
  "phases": [
    {
      "name": "Phase name",
      "description": "what this phase delivers",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "modules": [
        {
          "name": "Module name",
          "description": "what this module covers",
          "milestones": [
            { "title": "Milestone title", "description": "exit criteria", "targetDate": "YYYY-MM-DD" }
          ],
          "tasks": [
            {
              "title": "Concrete engineering task",
              "description": "what to do and how it is verified",
              "priority": "LOW | MEDIUM | HIGH | CRITICAL",
              "status": "NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETED",
              "estimatedHours": 4,
              "deadline": "YYYY-MM-DD"
            }
          ]
        }
      ]
    }
  ]
}

Hard requirements (a plan that breaks these is rejected):
- Return exactly 3 phases, ordered from current work to long-term future work.
- Every phase has exactly 2 modules. Every module has exactly 1 milestone and 2 tasks. That means 12 tasks in total.
- Statuses must be honest for this project: use "COMPLETED" only for work the context shows is already implemented or verified; use "IN_PROGRESS" for at most 3 tasks that continue current work; use "BLOCKED" when a task needs an external decision, credential, asset or dependency, and name that blocker in its description; use "NOT_STARTED" for all remaining future work.
- Continue the real project: keep the naming and intent of existing phases where they exist, do not restart finished work.
- Phase startDate/endDate and task deadlines must be chronological, start on or after ${today}, and finish on or before ${deadline}. Nothing may be dated before ${today}.
- Tasks must be specific and verifiable, never generic advice or placeholder text. Keep every description under 20 words so the JSON stays compact.

Output schema (keep these exact keys; every value is a placeholder you must replace with real project content, never copy it):
{"summary":"...","phases":[{"name":"...","description":"...","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","modules":[{"name":"...","description":"...","milestones":[{"title":"...","description":"...","targetDate":"YYYY-MM-DD"}],"tasks":[{"title":"...","description":"...","priority":"HIGH","status":"IN_PROGRESS","estimatedHours":4,"deadline":"YYYY-MM-DD"}]}]}]}`;

    let raw: string;
    let model: string;
    try {
      const result = await OllamaService.generateDetailed(prompt, undefined, systemPrompt, {
        timeoutMs: 300000,
        json: true,
      });
      raw = result.text;
      model = result.model;
    } catch (err: any) {
      throw httpError(
        `Ollama could not generate the plan: ${err?.message || 'request failed'}. Check that the local model is running.`,
        502
      );
    }

    let draft = parsePlanDraft(raw);

    // Small local models often return a minimal plan. Ask once more with the
    // exact rule violations so the hierarchy is usable before it is saved.
    const issues = planIssues(draft);
    if (issues.length > 0) {
      const retryPrompt = `${prompt}

Your previous answer was rejected for these reasons:
- ${issues.join('\n- ')}

Return the complete corrected JSON object now. Follow every hard requirement, keep valid JSON, and do not explain anything.`;
      try {
        const retry = await OllamaService.generateDetailed(retryPrompt, undefined, systemPrompt, {
          timeoutMs: 300000,
          json: true,
        });
        const retried = parsePlanDraft(retry.text);
        if (planIssues(retried).length <= issues.length) {
          draft = retried;
          model = retry.model;
        }
      } catch {
        // Keep the first draft when the retry cannot produce valid JSON.
      }
    }

    const replace = options.replace !== false;

    await prisma.$transaction(async (tx) => {
      if (replace) {
        await tx.task.deleteMany({ where: { projectId } });
        await tx.milestone.deleteMany({ where: { projectId } });
        await tx.projectModule.deleteMany({ where: { projectId } });
        await tx.projectPhase.deleteMany({ where: { projectId } });
      }

      let taskOrder = 0;

      for (const [phaseIndex, phase] of draft.phases.entries()) {
        const phaseTasks = phase.modules.flatMap((m) => m.tasks);
        const createdPhase = await tx.projectPhase.create({
          data: {
            projectId,
            name: phase.name,
            description: phase.description,
            orderIndex: phaseIndex,
            startDate: phase.startDate,
            endDate: phase.endDate,
            status: phaseStatus(phaseTasks),
          },
        });

        for (const [moduleIndex, module] of phase.modules.entries()) {
          const createdModule = await tx.projectModule.create({
            data: {
              projectId,
              phaseId: createdPhase.id,
              name: module.name,
              description: module.description,
              orderIndex: moduleIndex,
            },
          });

          const milestones: Array<{ id: string }> = [];
          for (const milestone of module.milestones) {
            milestones.push(
              await tx.milestone.create({
                data: {
                  projectId,
                  moduleId: createdModule.id,
                  title: milestone.title,
                  description: milestone.description,
                  targetDate: milestone.targetDate,
                },
              })
            );
          }

          for (const [taskIndex, task] of module.tasks.entries()) {
            const milestone = milestones.length > 0 ? milestones[taskIndex % milestones.length] : null;
            await tx.task.create({
              data: {
                projectId,
                phaseId: createdPhase.id,
                moduleId: createdModule.id,
                milestoneId: milestone?.id ?? null,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                estimatedHours: task.estimatedHours,
                deadline: task.deadline ?? phase.endDate ?? project.targetDeadline ?? null,
                orderIndex: taskOrder++,
              },
            });
          }
        }
      }
    });

    const taskCount = draft.phases.reduce(
      (sum, phase) => sum + phase.modules.reduce((s, m) => s + m.tasks.length, 0),
      0
    );

    await prisma.projectActivity.create({
      data: {
        projectId,
        type: 'PLAN_GENERATED',
        description: `Ollama generated a ${draft.phases.length}-phase plan with ${taskCount} tasks using ${model}.`,
        metadata: JSON.stringify({ model, phases: draft.phases.length, tasks: taskCount, replace }),
      },
    });

    return {
      project: await this.getPlan(projectId),
      model,
      summary: draft.summary,
      phases: draft.phases.length,
      tasks: taskCount,
    };
  }

  public static async updateTaskStatus(taskId: string, status: string) {
    const normalized = normalizeTaskStatus(status);
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw httpError('Task not found', 404);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { status: normalized },
    });

    await prisma.projectActivity.create({
      data: {
        projectId: task.projectId,
        type: 'TASK_STATUS_CHANGED',
        description: `Task "${task.title}" moved to ${normalized.replace('_', ' ').toLowerCase()}.`,
        metadata: JSON.stringify({ taskId, from: task.status, to: normalized }),
      },
    });

    // Phase status follows its tasks so the timeline and planner agree.
    if (task.phaseId) {
      const phaseTasks = await prisma.task.findMany({
        where: { phaseId: task.phaseId },
        select: { status: true },
      });
      await prisma.projectPhase.update({
        where: { id: task.phaseId },
        data: { status: phaseStatus(phaseTasks) },
      });
    }

    return updated;
  }

  public static async getAssistantHistory(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw httpError('Project not found', 404);

    const messages = await prisma.aIConversation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: 60,
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  public static async chat(projectId: string, message: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        phases: { orderBy: { orderIndex: 'asc' }, include: { modules: true } },
        tasks: { orderBy: { orderIndex: 'asc' } },
        assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        recommendations: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!project) throw httpError('Project not found', 404);

    const status = await OllamaService.checkStatus();
    if (!status.online) {
      throw httpError(
        `Ollama is not responding at ${status.endpoint}. Start it with "ollama serve" to use the assistant.`,
        503
      );
    }

    let techStack: string[] = [];
    try {
      techStack = JSON.parse(project.techStack);
    } catch {
      techStack = [];
    }

    const counts = TASK_STATUSES.map(
      (s) => `${s.replace('_', ' ').toLowerCase()}: ${project.tasks.filter((t) => t.status === s).length}`
    ).join(', ');

    const upcoming = project.tasks
      .filter((t) => t.status !== 'COMPLETED')
      .slice(0, 8)
      .map((t) => `- [${t.status}] ${t.title}${t.deadline ? ` (due ${formatDate(t.deadline)})` : ''}`);

    const blocked = project.tasks.filter((t) => t.status === 'BLOCKED').slice(0, 5);

    const assessment = project.assessments[0];
    let nextActions: string[] = [];
    if (assessment) {
      nextActions = parseJsonArray(assessment.nextActionsJson)
        .slice(0, 4)
        .map((a: any) => `- ${a.title}: ${a.recommendedAction || a.explanation || ''}`);
    }

    const context = [
      `Project: ${project.name}`,
      `Category: ${project.category} | Complexity: ${project.complexity} | Status: ${project.status}`,
      `Headline progress: ${project.overallProgress}% | Verification confidence: ${project.verificationConfidence}%`,
      `Description: ${project.description || 'none'}`,
      `Objective: ${project.objective || 'none'}`,
      `Deliverables: ${project.expectedDeliverables || 'none'}`,
      `Tech stack: ${techStack.length ? techStack.join(', ') : 'not recorded'}`,
      `Root folder: ${project.rootPath || 'not linked'} | Last scan: ${project.lastScanAt ? project.lastScanAt.toISOString().slice(0, 10) : 'never'}`,
      `Phases: ${project.phases.length ? project.phases.map((p) => `${p.name} [${p.status}]`).join(', ') : 'none yet'}`,
      `Task counts — ${counts}`,
      upcoming.length ? `Open tasks:\n${upcoming.join('\n')}` : 'Open tasks: none',
      blocked.length ? `Blocked tasks:\n${blocked.map((t) => `- ${t.title}: ${t.description || 'no reason recorded'}`).join('\n')}` : 'Blocked tasks: none',
      assessment
        ? `Assessment: product ${assessment.productCompletion ?? 0}%, technical ${assessment.technicalCompletion ?? 0}%, readiness ${assessment.productionReadiness ?? 0}%, confidence ${assessment.evaluationConfidence ?? 0}%`
        : 'Assessment: no evidence scan yet',
      nextActions.length ? `Recommended next actions:\n${nextActions.join('\n')}` : '',
    ].filter(Boolean);

    const systemPrompt = [
      'You are Project OS Assistant, a pragmatic senior engineer embedded in the user\'s local project workspace.',
      'Answer only from the supplied project context; never invent files, metrics or completed work.',
      'Be concise: short paragraphs or bullet points, no preamble, no repetition of the question.',
      'When the context lacks an answer, say what data is missing and which action (for example a folder scan) would provide it.',
    ].join(' ');

    const prompt = `PROJECT CONTEXT\n${context.join('\n')}\n\nUSER QUESTION\n${message}\n\nAnswer as the project assistant.`;

    await prisma.aIConversation.create({
      data: { projectId, role: 'USER', content: message },
    });

    let reply = '';
    let model = status.activeModel;
    try {
      const result = await OllamaService.generateDetailed(prompt, undefined, systemPrompt, {
        timeoutMs: 120000,
      });
      reply = result.text.trim();
      model = result.model;
    } catch (err: any) {
      throw httpError(
        `Ollama could not answer: ${err?.message || 'request failed'}. Check the local model and try again.`,
        502
      );
    }

    if (!reply) {
      reply = 'The local model returned an empty answer. Try rephrasing the question.';
    }

    await prisma.aIConversation.create({
      data: { projectId, role: 'ASSISTANT', content: reply },
    });

    return { reply, model };
  }

  /** Persisted HLD is stored as the latest HLD_GENERATED activity (no schema change). */
  public static async getHld(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw httpError('Project not found', 404);

    const activity = await prisma.projectActivity.findFirst({
      where: { projectId, type: 'HLD_GENERATED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!activity?.metadata) return null;

    try {
      const parsed = JSON.parse(activity.metadata);
      return {
        summary: text(parsed.summary),
        layers: Array.isArray(parsed.layers) ? parsed.layers : [],
        dataFlows: Array.isArray(parsed.dataFlows) ? parsed.dataFlows : [],
        techDecisions: Array.isArray(parsed.techDecisions) ? parsed.techDecisions : [],
        mermaid: text(parsed.mermaid),
        model: text(parsed.model),
        generatedAt: activity.createdAt,
      };
    } catch {
      return null;
    }
  }

  public static async generateHld(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
        assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        scannedFiles: { take: 1 },
      },
    });

    if (!project) throw httpError('Project not found', 404);

    const status = await OllamaService.checkStatus();
    if (!status.online) {
      throw httpError(
        `Ollama is not responding at ${status.endpoint}. Start it with "ollama serve" to generate the design.`,
        503
      );
    }

    let techStack: string[] = [];
    try {
      techStack = JSON.parse(project.techStack);
    } catch {
      techStack = [];
    }

    const assessment = project.assessments[0];
    const featureLines = assessment
      ? parseJsonArray(assessment.featuresJson)
          .filter((f: any) => f?.name)
          .slice(0, 14)
          .map((f: any) => `- ${f.name} (${f.status || 'unknown'})`)
      : [];

    const taskCounts = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']
      .map((s) => `${s}: ${project.tasks.filter((t) => t.status === s).length}`)
      .join(', ');

    const context = [
      `Project name: ${project.name}`,
      `Category: ${project.category} | Complexity: ${project.complexity} | Status: ${project.status}`,
      `Headline progress: ${project.overallProgress}% | Verification confidence: ${project.verificationConfidence}%`,
      `Description: ${project.description || 'none'}`,
      `Objective: ${project.objective || 'none'}`,
      `Expected deliverables: ${project.expectedDeliverables || 'none'}`,
      `Tech stack: ${techStack.length ? techStack.join(', ') : 'not recorded'}`,
      `Root folder: ${project.rootPath || 'not linked'} | Scanned files: ${project.scannedFiles.length ? 'yes' : 'none'}`,
      `Task counts — ${taskCounts}`,
      assessment
        ? `Assessment: product ${assessment.productCompletion ?? 0}%, technical ${assessment.technicalCompletion ?? 0}%, readiness ${assessment.productionReadiness ?? 0}%`
        : 'Assessment: no evidence scan yet',
    ];

    if (featureLines.length > 0) {
      context.push(`Known features:\n${featureLines.join('\n')}`);
    }

    const systemPrompt = [
      'You are a senior software architect.',
      'You design pragmatic, layered high-level architectures from a project brief and its evidence.',
      'You always answer with a single valid JSON object and never with prose, markdown or code fences.',
    ].join(' ');

    const prompt = `Design the high-level architecture for this project.

${context.join('\n')}

Return ONLY a JSON object with exactly this shape:
{
  "summary": "two or three sentences on the architecture and its boundaries",
  "layers": [
    {
      "name": "Layer name",
      "description": "what this layer is responsible for",
      "components": [
        { "name": "Component name", "description": "responsibility", "technology": "concrete tech", "status": "planned | implemented | partial" }
      ]
    }
  ],
  "dataFlows": [
    { "from": "Component A", "to": "Component B", "label": "what travels between them" }
  ],
  "techDecisions": [
    { "decision": "short decision", "rationale": "why" }
  ],
  "mermaid": "graph TD; A[Client] --> B[API]; B --> C[(Database)]"
}

Rules:
- 4 to 5 layers ordered from user-facing to infrastructure (e.g. Presentation, Application/API, Domain, Data, Infrastructure/External).
- 2 to 4 concrete components per layer. Technologies must be real entries from the tech stack or standard companions.
- A component name must appear in EXACTLY ONE layer. Never repeat a component (such as an API gateway, database, or service) in multiple layers; if a component is shared, put it in the layer it belongs to and reference it by name in dataFlows instead.
- status is "implemented" only when the evidence (features/scanned files/progress) shows that work exists; otherwise "planned" or "partial".
- 4 to 8 dataFlows covering the main request, persistence and external-service paths. Every dataFlow must go from a DIFFERENT component to a DIFFERENT component; never from a component to itself.
- 3 to 5 techDecisions with concrete rationale.
- mermaid must be valid Mermaid "graph TD" syntax with short node labels and edges matching the dataFlows. No quotes inside node labels. No self-loops (an edge must never start and end at the same node) and no duplicate edges.
- Keep every description under 18 words so the JSON stays compact.`;

    let raw: string;
    let model: string;
    try {
      const result = await OllamaService.generateDetailed(prompt, undefined, systemPrompt, {
        timeoutMs: 240000,
        json: true,
      });
      raw = result.text;
      model = result.model;
    } catch (err: any) {
      throw httpError(
        `Ollama could not generate the design: ${err?.message || 'request failed'}. Check the local model and try again.`,
        502
      );
    }

    let parsed: any;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      throw httpError('Ollama returned an incomplete design. Try generating again.', 502);
    }

    // De-duplicate component names across layers: a component may live in only one layer.
    const seenComponents = new Set<string>();
    const layers = asArray(parsed.layers)
      .slice(0, 6)
      .map((layer: any) => {
        const components = asArray(layer?.components)
          .slice(0, 5)
          .map((c: any) => ({
            name: text(c?.name, 'Component'),
            description: text(c?.description),
            technology: text(c?.technology),
            status: ['planned', 'implemented', 'partial'].includes(text(c?.status).toLowerCase())
              ? text(c?.status).toLowerCase()
              : 'planned',
          }))
          .filter((c: any) => c.name.length > 0)
          .filter((c: any) => {
            const key = c.name.toLowerCase();
            if (seenComponents.has(key)) return false;
            seenComponents.add(key);
            return true;
          });
        return {
          name: text(layer?.name, 'Layer'),
          description: text(layer?.description),
          components,
        };
      })
      .filter((l: any) => l.components.length > 0);

    if (layers.length === 0) {
      throw httpError('Ollama returned a design without layers. Try generating again.', 502);
    }

    const hld = {
      summary: text(parsed.summary),
      layers,
      dataFlows: (() => {
        const seen = new Set<string>();
        return asArray(parsed.dataFlows)
          .slice(0, 10)
          .map((f: any) => ({
            from: text(f?.from),
            to: text(f?.to),
            label: text(f?.label),
          }))
          // Drop self-loops and duplicate flows.
          .filter((f: any) => f.from && f.to && f.from.toLowerCase() !== f.to.toLowerCase())
          .filter((f: any) => {
            const key = `${f.from.toLowerCase()}->${f.to.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      })(),
      techDecisions: asArray(parsed.techDecisions)
        .slice(0, 6)
        .map((d: any) => ({
          decision: text(d?.decision),
          rationale: text(d?.rationale),
        }))
        .filter((d: any) => d.decision),
      mermaid: sanitizeMermaid(text(parsed.mermaid)),
      model,
    };

    await prisma.projectActivity.create({
      data: {
        projectId,
        type: 'HLD_GENERATED',
        description: `Ollama generated a high-level design with ${layers.length} layers and ${hld.dataFlows.length} data flows using ${model}.`,
        metadata: JSON.stringify({ ...hld, generatedAt: new Date().toISOString() }),
      },
    });

    return { hld: { ...hld, generatedAt: new Date().toISOString() }, model };
  }
}

function sanitizeMermaid(raw: string): string {
  if (!raw) return '';
  // Drop self-loop edges (X --> X) and collapse stray blank lines.
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => !/\b([A-Za-z0-9_]+)\s*--+>\s*\1\b/.test(line))
    .join('\n')
    .trim();
}

function parseJsonArray(value: string | null | undefined): any[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
