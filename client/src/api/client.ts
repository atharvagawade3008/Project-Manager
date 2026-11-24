import type {
  Project,
  OverviewData,
  OllamaStatus,
  SystemSettings,
  Feature,
  AIRecommendation,
  AssessmentResponse,
  ScopeRequirement,
  FolderProjectAnalysis,
  PlanGenerationResult,
  PlanTaskStatus,
  AssistantMessage,
  Task,
  HldDocument,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const json = await res.json();
  if (!json.success && json.error) {
    throw new Error(json.error);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Overview
  getOverview: () => fetchJson<OverviewData>('/overview/stats'),

  // Projects
  getProjects: (params?: { search?: string; category?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString();
    return fetchJson<Project[]>(`/projects${qs ? `?${qs}` : ''}`);
  },

  getProject: (id: string) => fetchJson<Project>(`/projects/${id}`),

  createProject: (data: Partial<Project>) =>
    fetchJson<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  analyzeProjectFolder: (path: string, useAI = true) =>
    fetchJson<FolderProjectAnalysis>('/projects/analyze-folder', {
      method: 'POST',
      body: JSON.stringify({ path, useAI }),
    }),

  updateProject: (id: string, data: Partial<Project>) =>
    fetchJson<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProject: (id: string) =>
    fetchJson<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
    }),

  // Filesystem
  validateDirectory: (dirPath: string) =>
    fetchJson<{ valid: boolean; resolvedPath?: string; error?: string }>('/filesystem/validate', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath }),
    }),

  browseDirectories: (basePath?: string) => {
    const qs = basePath ? `?path=${encodeURIComponent(basePath)}` : '';
    return fetchJson<{
      currentPath: string;
      parentPath: string | null;
      folders: string[];
      shortcuts: Array<{ name: string; path: string }>;
    }>(`/filesystem/browse${qs}`);
  },

  openNativeFolderPicker: () =>
    fetchJson<{ selectedPath: string | null; cancelled: boolean }>('/filesystem/native-picker', {
      method: 'POST',
    }),

  getScannedFiles: (projectId: string) =>
    fetchJson<any[]>(`/filesystem/files/${projectId}`),

  // Progress Intelligence — Evaluation Framework V2
  scanProject: (projectId: string, options?: { previewUrl?: string; refreshScope?: boolean; useAI?: boolean }) =>
    fetchJson<{
      jobId: string;
      assessmentId: string;
      frameworkVersion: string;
      overallProgress: number;
      productCompletion: number | null;
      technicalCompletion: number | null;
      productionReadiness: number | null;
      verificationConfidence: number;
      evaluationConfidence: number;
      scannedFilesCount: number;
      totalCodeLines: number;
      featuresAssessed: number;
      featureCounts: any;
      projectType: string;
      projectTypeLabel: string;
      classificationConfidence: number;
      scopeReviewRequired: boolean;
      scopeApproved: boolean;
      aiAssisted: boolean;
      excludedDimensions: string[];
      notes: string[];
      report: any;
    }>(`/progress/scan/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),

  getAssessment: (projectId: string) =>
    fetchJson<AssessmentResponse>(`/progress/assessment/${projectId}`),

  getScope: (projectId: string) =>
    fetchJson<{
      approvedAt: string | null;
      requirements: ScopeRequirement[];
      counts: { total: number; included: number; originalPlanned: number; aiDiscovered: number; aiInferredMissing: number; userConfirmed: number };
    }>(`/progress/scope/${projectId}`),

  updateScope: (
    projectId: string,
    payload: {
      updates?: Array<{
        id: string;
        included?: boolean;
        title?: string;
        description?: string;
        expectedFunctionality?: string;
        dimension?: string;
        priority?: string;
      }>;
      additions?: Array<{
        title: string;
        description?: string;
        dimension?: string;
        expectedFunctionality?: string;
        priority?: string;
      }>;
      removals?: string[];
    }
  ) =>
    fetchJson<{ approvedAt: string | null; requirements: ScopeRequirement[]; counts: { total: number; included: number }; message: string }>(
      `/progress/scope/${projectId}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  approveScope: (projectId: string) =>
    fetchJson<{ approvedAt: string; message: string }>(`/progress/scope/${projectId}/approve`, {
      method: 'POST',
    }),

  updateClassification: (projectId: string, projectType: string) =>
    fetchJson<{ projectType: string | null; projectTypeSource: string; message: string }>(
      `/progress/classification/${projectId}`,
      { method: 'PUT', body: JSON.stringify({ projectType }) }
    ),

  updateDimensionWeights: (projectId: string, weights: Record<string, number>) =>
    fetchJson<{ weights: Record<string, number>; message: string }>(`/progress/weights/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ weights }),
    }),

  getJobStatus: (jobId: string) =>
    fetchJson<any>(`/progress/jobs/${jobId}`),

  getProgressReport: (projectId: string) =>
    fetchJson<{
      report: any;
      features: Feature[];
    }>(`/progress/report/${projectId}`),

  getProgressSnapshots: (projectId: string) =>
    fetchJson<any[]>(`/progress/snapshots/${projectId}`),

  convertRecommendationToTask: (id: string) =>
    fetchJson<any>(`/progress/recommendations/${id}/convert`, {
      method: 'POST',
    }),

  // AI planner (Ollama-backed hierarchy generation)
  getPlan: (projectId: string) => fetchJson<Project>(`/ai/plan/${projectId}`),

  generatePlan: (projectId: string, options?: { replace?: boolean }) =>
    fetchJson<PlanGenerationResult>(`/ai/plan/${projectId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ replace: options?.replace !== false }),
    }),

  updateTaskStatus: (taskId: string, status: PlanTaskStatus) =>
    fetchJson<Task>(`/ai/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // High-Level Design (Ollama-backed architecture)
  getHld: (projectId: string) => fetchJson<HldDocument | null>(`/ai/hld/${projectId}`),

  generateHld: (projectId: string) =>
    fetchJson<{ hld: HldDocument; model: string }>(`/ai/hld/${projectId}/generate`, {
      method: 'POST',
    }),

  // AI project assistant (Ollama-backed chat)
  getAssistantHistory: (projectId: string) =>
    fetchJson<AssistantMessage[]>(`/ai/assistant/${projectId}/history`),

  sendAssistantMessage: (projectId: string, message: string) =>
    fetchJson<{ reply: string; model: string }>(`/ai/assistant/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  // Ollama
  getOllamaStatus: () => fetchJson<OllamaStatus>('/ollama/status'),
  getOllamaModels: () => fetchJson<any[]>('/ollama/models'),
  updateOllamaSettings: (data: { endpoint?: string; activeModel?: string }) =>
    fetchJson<OllamaStatus>('/ollama/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Settings
  getSettings: () => fetchJson<SystemSettings>('/settings'),
  updateSettings: (data: Partial<SystemSettings>) =>
    fetchJson<SystemSettings>('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
