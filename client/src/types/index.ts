export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  projectType?: string | null;
  projectTypeSource?: 'AUTO' | 'USER';
  projectTypeConfidence?: number | null;
  scopeApprovedAt?: string | null;
  dimensionWeightOverrides?: string;
  objective: string;
  expectedDeliverables: string;
  techStack: string[];
  startDate: string | null;
  targetDeadline: string | null;
  complexity: 'Low' | 'Medium' | 'High' | 'Very High';
  status: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  healthStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL';
  rootPath: string | null;
  activeModel: string | null;
  overallProgress: number;
  verificationConfidence: number;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedTasksCount?: number;
  pendingTasksCount?: number;
  _count?: {
    tasks: number;
    features: number;
    scannedFiles: number;
  };
  phases?: ProjectPhase[];
  tasks?: Task[];
  features?: Feature[];
  recommendations?: AIRecommendation[];
  activities?: ProjectActivity[];
}

export interface FolderProjectAnalysis {
  rootPath: string;
  name: string;
  description: string;
  category: string;
  objective: string;
  expectedDeliverables: string;
  techStack: string[];
  complexity: 'Low' | 'Medium' | 'High' | 'Very High';
  projectType: {
    code: ProjectTypeCode;
    label: string;
    confidence: number;
    rationale: string;
  };
  filesScanned: number;
  truncated: boolean;
  aiUsed: boolean;
  aiMessage: string | null;
}

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  description: string;
  orderIndex: number;
  startDate: string | null;
  endDate: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  modules?: ProjectModule[];
}

export interface ProjectModule {
  id: string;
  projectId: string;
  phaseId: string | null;
  name: string;
  description: string;
  orderIndex: number;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  projectId: string;
  moduleId: string | null;
  title: string;
  description: string;
  targetDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  phaseId: string | null;
  moduleId: string | null;
  milestoneId: string | null;
  title: string;
  description: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedHours: number | null;
  actualHours: number | null;
  deadline: string | null;
  completionCriteria: string | null;
  technicalNotes: string | null;
  aiRecommendations: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    category?: string;
  };
  subtasks?: Subtask[];
  dependencies?: TaskDependency[];
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: string;
  dependsOnTask?: Task;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  orderIndex: number;
}

export interface Feature {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: string;
  dimension?: string;
  source?: string;
  expectedFunctionality?: string;
  verificationStatus?: string;
  included?: boolean;
  weight: number;
  estimatedProgress: number;
  verificationConfidence: number;
  status: 'NOT_STARTED' | 'SCAFFOLDING' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'VERIFIED' | 'NEEDS_ATTENTION';
  missingRequirements: string | null;
  lastAssessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidences?: FeatureEvidence[];
}

export interface FeatureEvidence {
  id: string;
  featureId: string;
  filePath: string;
  symbolOrComponent: string | null;
  evidenceDescription: string;
  status: 'FOUND' | 'PARTIAL' | 'MISSING' | 'BROKEN';
  confidence: number;
  lineStart: number | null;
  lineEnd: number | null;
  createdAt: string;
}

export interface AIRecommendation {
  id: string;
  projectId: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'NEXT_STEP' | 'ARCHITECTURE' | 'REFACTOR' | 'TEST' | 'SECURITY';
  relatedFeatureId: string | null;
  isConvertedToTask: boolean;
  convertedTaskId: string | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
  };
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: string;
  description: string;
  metadata: string | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
  };
}

export interface GlobalStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalPendingTasks: number;
  overdueTasks: number;
  averageCompletion: number;
  averageConfidence: number;
}

export interface OverviewData {
  stats: GlobalStats;
  upcomingDeadlines: Task[];
  attentionTasks: Task[];
  recentActivities: ProjectActivity[];
  latestRecommendations: AIRecommendation[];
}

export interface OllamaStatus {
  online: boolean;
  endpoint: string;
  activeModel: string;
  effectiveModel?: string;
  availableModels: string[];
  version?: string;
  error?: string;
}

export interface SystemSettings {
  ollama_endpoint: string;
  ollama_default_model: string;
  theme: string;
  scan_exclusions: string;
  max_file_size_kb: string;
}

// ---------------------------------------------------------------------------
// Evaluation Framework V2
// ---------------------------------------------------------------------------

export type ProjectTypeCode =
  | 'BUSINESS_WEBSITE'
  | 'PORTFOLIO_WEBSITE'
  | 'ECOMMERCE_WEBSITE'
  | 'LANDING_PAGE'
  | 'SAAS_APPLICATION'
  | 'FULLSTACK_WEB_APP'
  | 'AI_APPLICATION'
  | 'DESKTOP_APPLICATION'
  | 'MOBILE_APPLICATION'
  | 'GAME_3D'
  | 'DEVELOPER_TOOL'
  | 'OTHER';

export type MetricGroup = 'PRODUCT' | 'TECHNICAL' | 'READINESS';

export type ImplementationStatusV2 =
  | 'IMPLEMENTED'
  | 'PARTIALLY_IMPLEMENTED'
  | 'PLACEHOLDER'
  | 'MISSING'
  | 'CANNOT_VERIFY'
  | 'NOT_APPLICABLE';

export type VerificationStatusV2 =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED'
  | 'CANNOT_VERIFY'
  | 'NOT_APPLICABLE';

export interface AssessmentClassification {
  projectType: ProjectTypeCode;
  projectTypeLabel: string;
  confidence: number;
  source: 'AUTO' | 'USER';
  rationale: string;
  evidence: string[];
  alternatives: Array<{ projectType: ProjectTypeCode; label: string; score: number }>;
}

export interface AssessmentDimensionEvidence {
  label: string;
  detail: string;
  satisfied: boolean;
  filePath?: string;
  weight?: number;
}

export interface AssessmentDimension {
  key: string;
  name: string;
  description: string;
  metric: MetricGroup;
  weight: number;
  normalizedWeight: number;
  applicable: boolean;
  exclusionReason?: string;
  score: number | null;
  confidence: number;
  summary: string;
  evidence: AssessmentDimensionEvidence[];
  fileRefs: string[];
  checksPassed: number;
  checksTotal: number;
  featureCoverage: number | null;
}

export interface AssessmentFeatureEvidence {
  filePath: string;
  symbolOrComponent?: string | null;
  evidenceDescription: string;
  status: 'FOUND' | 'PARTIAL' | 'MISSING' | 'BROKEN';
  confidence: number;
  lineStart?: number;
  lineEnd?: number;
}

export interface AssessmentFeature {
  id?: string;
  name: string;
  description: string;
  dimension: string;
  category: string;
  source: 'ORIGINAL_PLANNED' | 'AI_DISCOVERED' | 'AI_INFERRED_MISSING' | 'USER_CONFIRMED';
  included: boolean;
  weight: number;
  expectedFunctionality: string;
  status: ImplementationStatusV2;
  verificationStatus: VerificationStatusV2;
  completion: number;
  confidence: number;
  missingRequirements: string | null;
  evidences: AssessmentFeatureEvidence[];
  placeholderSignals: string[];
}

export interface AssessmentFeatureCounts {
  total: number;
  applicable: number;
  implemented: number;
  partiallyImplemented: number;
  placeholder: number;
  missing: number;
  cannotVerify: number;
  notApplicable: number;
  verified: number;
}

export interface AssessmentScores {
  productCompletion: number | null;
  technicalCompletion: number | null;
  productionReadiness: number | null;
  evaluationConfidence: number;
  overallProgress: number;
  featureCounts: AssessmentFeatureCounts;
}

export interface AssessmentNextAction {
  title: string;
  explanation: string;
  recommendedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  dimension?: string;
  relatedFeatureId?: string | null;
}

export interface ProjectAssessment {
  id: string;
  projectId: string;
  scanJobId: string | null;
  frameworkVersion: string;
  projectType: ProjectTypeCode;
  projectTypeLabel: string;
  projectTypeSource: 'AUTO' | 'USER';
  classificationConfidence: number;
  productCompletion: number | null;
  technicalCompletion: number | null;
  productionReadiness: number | null;
  evaluationConfidence: number;
  overallProgress: number;
  scopeApproved: boolean;
  aiAssisted: boolean;
  dimensions: AssessmentDimension[];
  features: AssessmentFeature[];
  scope: Array<{ id?: string; title: string; description: string; dimension: string; source: string; included: boolean; priority: string }>;
  nextActions: AssessmentNextAction[];
  notes: string[];
  summary: string | null;
  scores: AssessmentScores;
  classification: {
    projectType: ProjectTypeCode;
    projectTypeLabel: string;
    source: 'AUTO' | 'USER';
    confidence: number;
    rationale: string;
    evidence: string[];
    alternatives: Array<{ projectType: ProjectTypeCode; label: string; score: number }>;
  };
  website?: {
    analyzed: boolean;
    pages: Array<{ route: string; hasContent: boolean }>;
    runtime?: {
      baseUrl: string;
      checkedRoutes: number;
      successfulRoutes: number;
      failedRoutes: string[];
    };
  } | null;
  createdAt: string;
}

export interface ScopeRequirement {
  id: string;
  projectId: string;
  name: string;
  description: string;
  dimension: string;
  source: string;
  included: boolean;
  userModified: boolean;
  weight: number;
  status: string;
  verificationStatus: string;
  estimatedProgress: number;
  verificationConfidence: number;
  expectedFunctionality: string;
  missingRequirements: string | null;
  evidences?: AssessmentFeatureEvidence[];
}

export interface ProgressSnapshotRow {
  id: string;
  projectId: string;
  overallProgress: number;
  verificationConfidence: number;
  totalFeatures: number;
  completedFeatures: number;
  frameworkVersion: string;
  productCompletion: number | null;
  technicalCompletion: number | null;
  productionReadiness: number | null;
  summary: string | null;
  createdAt: string;
}

export interface AssessmentHistoryRow {
  id: string;
  createdAt: string;
  frameworkVersion: string;
  projectType: string;
  projectTypeLabel: string;
  productCompletion: number | null;
  technicalCompletion: number | null;
  productionReadiness: number | null;
  evaluationConfidence: number;
  overallProgress: number;
  scopeApproved: boolean;
  aiAssisted: boolean;
}

export interface AssessmentResponse {
  project: {
    id: string;
    name: string;
    projectType: string | null;
    projectTypeSource: string;
    projectTypeConfidence: number | null;
    scopeApprovedAt: string | null;
    dimensionWeightOverrides: string;
    lastScanAt: string | null;
    overallProgress: number;
  };
  assessment: ProjectAssessment | null;
  history: AssessmentHistoryRow[];
  latestSnapshot: ProgressSnapshotRow | null;
  legacySnapshots: ProgressSnapshotRow[];
  comparison: {
    available: boolean;
    explanation: string;
    previous?: {
      overallProgress: number;
      verificationConfidence: number;
      frameworkVersion: string;
      createdAt: string;
    };
  };
  scope: {
    approvedAt: string | null;
    requirements: ScopeRequirement[];
    counts: { total: number; included: number };
  };
  framework: {
    version: string;
    projectTypes: Array<{ value: ProjectTypeCode; label: string }>;
    dimensionKeys: string[];
  };
}

// ---------------------------------------------------------------------------
// AI Planner & Assistant (local Ollama)
// ---------------------------------------------------------------------------

export type PlanTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export interface PlanGenerationResult {
  project: Project;
  model: string;
  summary: string;
  phases: number;
  tasks: number;
}

export interface AssistantMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

// High-Level Design (Ollama-generated architecture)
export interface HldComponent {
  name: string;
  description: string;
  technology: string;
  status: 'planned' | 'implemented' | 'partial';
}

export interface HldLayer {
  name: string;
  description: string;
  components: HldComponent[];
}

export interface HldDataFlow {
  from: string;
  to: string;
  label: string;
}

export interface HldDecision {
  decision: string;
  rationale: string;
}

export interface HldDocument {
  summary: string;
  layers: HldLayer[];
  dataFlows: HldDataFlow[];
  techDecisions: HldDecision[];
  mermaid: string;
  model?: string;
  generatedAt?: string;
}
