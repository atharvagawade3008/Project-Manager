import type { FileMetadata } from '../../filesystem/filesystem.service.js';
import type { SourceCorpus } from './corpus.js';

export const EVALUATION_FRAMEWORK_VERSION = 'V2';

export type ProjectType =
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

export const PROJECT_TYPES: ProjectType[] = [
  'BUSINESS_WEBSITE',
  'PORTFOLIO_WEBSITE',
  'ECOMMERCE_WEBSITE',
  'LANDING_PAGE',
  'SAAS_APPLICATION',
  'FULLSTACK_WEB_APP',
  'AI_APPLICATION',
  'DESKTOP_APPLICATION',
  'MOBILE_APPLICATION',
  'GAME_3D',
  'DEVELOPER_TOOL',
  'OTHER',
];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  BUSINESS_WEBSITE: 'Business website',
  PORTFOLIO_WEBSITE: 'Portfolio website',
  ECOMMERCE_WEBSITE: 'E-commerce website',
  LANDING_PAGE: 'Landing page',
  SAAS_APPLICATION: 'SaaS application',
  FULLSTACK_WEB_APP: 'Full-stack web application',
  AI_APPLICATION: 'AI application',
  DESKTOP_APPLICATION: 'Desktop application',
  MOBILE_APPLICATION: 'Mobile application',
  GAME_3D: '3D game',
  DEVELOPER_TOOL: 'Developer tool',
  OTHER: 'Other',
};

export const WEB_PROJECT_TYPES: ProjectType[] = [
  'BUSINESS_WEBSITE',
  'PORTFOLIO_WEBSITE',
  'ECOMMERCE_WEBSITE',
  'LANDING_PAGE',
  'SAAS_APPLICATION',
  'FULLSTACK_WEB_APP',
  'AI_APPLICATION',
];

export type MetricGroup = 'PRODUCT' | 'TECHNICAL' | 'READINESS';

export const METRIC_LABELS: Record<MetricGroup, string> = {
  PRODUCT: 'Product Completion',
  TECHNICAL: 'Technical Completion',
  READINESS: 'Production Readiness',
};

export type ImplementationStatus =
  | 'IMPLEMENTED'
  | 'PARTIALLY_IMPLEMENTED'
  | 'PLACEHOLDER'
  | 'MISSING'
  | 'CANNOT_VERIFY'
  | 'NOT_APPLICABLE';

export type VerificationStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED'
  | 'CANNOT_VERIFY'
  | 'NOT_APPLICABLE';

export type RequirementSource =
  | 'ORIGINAL_PLANNED'
  | 'AI_DISCOVERED'
  | 'AI_INFERRED_MISSING'
  | 'USER_CONFIRMED';

export const REQUIREMENT_SOURCE_LABELS: Record<RequirementSource, string> = {
  ORIGINAL_PLANNED: 'Original planned requirement',
  AI_DISCOVERED: 'AI-discovered implemented feature',
  AI_INFERRED_MISSING: 'AI-inferred missing feature',
  USER_CONFIRMED: 'User-confirmed requirement',
};

export interface ProjectMeta {
  name: string;
  description: string;
  category?: string | null;
  objective?: string | null;
  expectedDeliverables?: string | null;
  techStack?: string[];
}

export interface ProjectSignals {
  meta: ProjectMeta;
  rootPath: string;
  files: FileMetadata[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  packageName: string | null;
  packageDescription: string | null;
  readme: string;
  readmePath: string | null;
  allText: string;
  hasTests: boolean;
  testFiles: string[];
  sourceFiles: string[];
  htmlFiles: string[];
  cssFiles: string[];
  pageFiles: string[];
  routeDefinitions: Array<{ route: string; filePath: string }>;
  fileExtensions: Record<string, number>;
}

export interface ClassificationResult {
  projectType: ProjectType;
  projectTypeLabel: string;
  confidence: number;
  source: 'AUTO' | 'USER';
  rationale: string;
  evidence: string[];
  alternatives: Array<{ projectType: ProjectType; label: string; score: number }>;
}

export interface RequirementInput {
  id?: string;
  title: string;
  description: string;
  dimension: string;
  priority: string;
  source: RequirementSource;
  included: boolean;
  expectedFunctionality?: string;
}

export interface DimensionDefinition {
  key: string;
  name: string;
  description: string;
  metric: MetricGroup;
  weight: number;
  applicable: (ctx: DimensionContext) => boolean;
  exclusionReason?: string;
}

export interface DimensionContext {
  signals: ProjectSignals;
  classification: ClassificationResult;
  website: WebsiteAnalysis | null;
  requirements: RequirementInput[];
  features: FeatureAssessment[];
  corpus: SourceCorpus;
}

export interface DimensionEvidenceItem {
  label: string;
  detail: string;
  satisfied: boolean;
  filePath?: string;
  weight?: number;
}

export interface DimensionPartial {
  score: number;
  confidence: number;
  summary: string;
  evidence: DimensionEvidenceItem[];
  fileRefs: string[];
  checksPassed: number;
  checksTotal: number;
}

export interface DimensionResult {
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
  evidence: DimensionEvidenceItem[];
  fileRefs: string[];
  checksPassed: number;
  checksTotal: number;
  featureCoverage: number | null;
}

export interface FeatureEvidenceRef {
  filePath: string;
  symbolOrComponent?: string | null;
  evidenceDescription: string;
  status: 'FOUND' | 'PARTIAL' | 'MISSING' | 'BROKEN';
  confidence: number;
  lineStart?: number;
  lineEnd?: number;
}

export interface FeatureAssessment {
  id?: string;
  name: string;
  description: string;
  dimension: string;
  category: string;
  source: RequirementSource;
  included: boolean;
  weight: number;
  expectedFunctionality: string;
  status: ImplementationStatus;
  verificationStatus: VerificationStatus;
  completion: number;
  confidence: number;
  missingRequirements: string | null;
  evidences: FeatureEvidenceRef[];
  placeholderSignals: string[];
}

export interface WebsitePageInfo {
  route: string;
  name: string;
  filePath: string;
  kind: 'html' | 'page-component' | 'route-definition' | 'runtime-only';
  hasContent: boolean;
  sectionCount: number;
  wordCount: number;
  hasNav: boolean;
  hasFooter: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  formCount: number;
  buttonCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  runtimeStatus?: number;
  runtimeVerified?: boolean;
}

export interface FormInfo {
  filePath: string;
  fieldCount: number;
  hasValidation: boolean;
  hasSubmitHandler: boolean;
  hasAction: boolean;
  hasBackendEndpoint: boolean;
  isPlaceholder: boolean;
  evidence: string;
}

export interface WebsiteAnalysis {
  analyzed: boolean;
  pages: WebsitePageInfo[];
  routes: string[];
  brokenInternalLinks: string[];
  unresolvedRouteLinks: string[];
  navigationMenus: number;
  buttons: number;
  links: number;
  wiredInteractions: number;
  placeholderInteractions: number;
  forms: FormInfo[];
  validationSignals: number;
  interactiveStateHooks: number;
  modals: number;
  carousels: number;
  animationSignals: number;
  cssKeyframes: number;
  transitionClasses: number;
  mediaQueryCount: number;
  breakpoints: string[];
  tailwindBreakpoints: string[];
  hasViewportMeta: boolean;
  fluidLayoutSignals: number;
  mobileNavSignals: number;
  responsiveImageSignals: number;
  imageRefs: number;
  resolvedImages: number;
  missingAssets: string[];
  imagesWithAlt: number;
  imagesMissingAlt: number;
  apiCalls: number;
  apiEndpoints: string[];
  envVarRefs: number;
  backendRouteCount: number;
  hasAnalytics: boolean;
  hasThirdPartySdk: boolean;
  seo: {
    pagesWithTitle: number;
    pagesWithDescription: number;
    pagesWithOpenGraph: number;
    pagesWithCanonical: number;
    pagesWithLang: number;
    singleH1Pages: number;
    pagesWithStructuredData: number;
    hasRobotsTxt: boolean;
    hasSitemap: boolean;
    semanticTags: number;
    headingCount: number;
  };
  accessibility: {
    ariaAttributes: number;
    labelElements: number;
    inputs: number;
    labelledInputs: number;
    semanticElements: number;
    divButtons: number;
    focusStyles: number;
    skipLinks: number;
    altCoverage: number | null;
  };
  errorHandling: {
    errorBoundaries: number;
    tryCatchBlocks: number;
    catchHandlers: number;
    loadingStates: number;
    emptyStates: number;
    has404Page: boolean;
    formErrorMessages: number;
  };
  deployment: {
    configs: string[];
    buildScript: string | null;
    hasEnvExample: boolean;
    hasDocker: boolean;
    hasCi: boolean;
    hasHostingConfig: boolean;
    hasDeployScript: boolean;
  };
  runtime: {
    baseUrl: string | null;
    checkedRoutes: number;
    successfulRoutes: number;
    failedRoutes: string[];
    notes: string[];
  };
  placeholderCopy: string[];
  detected404: boolean;
}

export interface RuntimeCheckSummary {
  baseUrl: string;
  checkedRoutes: number;
  successfulRoutes: number;
  failedRoutes: string[];
  notes: string[];
  routeResults: Array<{ route: string; status: number | null; ok: boolean; contentLength: number }>;
}

export interface AssessmentScores {
  productCompletion: number | null;
  technicalCompletion: number | null;
  productionReadiness: number | null;
  evaluationConfidence: number;
  overallProgress: number;
  featureCounts: {
    total: number;
    applicable: number;
    implemented: number;
    partiallyImplemented: number;
    placeholder: number;
    missing: number;
    cannotVerify: number;
    notApplicable: number;
    verified: number;
  };
}

export interface NextAction {
  title: string;
  explanation: string;
  recommendedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  dimension?: string;
  relatedFeatureId?: string | null;
}

export interface AssessmentPayload {
  frameworkVersion: string;
  projectType: ProjectType;
  projectTypeLabel: string;
  projectTypeSource: 'AUTO' | 'USER';
  classification: ClassificationResult;
  scores: AssessmentScores;
  dimensions: DimensionResult[];
  features: FeatureAssessment[];
  scope: RequirementInput[];
  scopeApproved: boolean;
  nextActions: NextAction[];
  notes: string[];
  summary: string;
  aiAssisted: boolean;
  scannedFiles: number;
  totalCodeLines: number;
  website: WebsiteAnalysis | null;
}
