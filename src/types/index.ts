// Skill levels for user experience adaptation
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

// Project status throughout the workflow
export type ProjectStatus = 
  | 'created'
  | 'clarifying'
  | 'generating_options'
  | 'selecting_architecture'
  | 'designing'
  | 'completed';

// Base project interface
export interface Project {
  id: string;
  name: string;
  description: string;
  skillLevel: SkillLevel;
  status: ProjectStatus;
  requirements?: RequirementsSummary;  // Added to store clarification results
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHistorySummary {
  project: Project;
  conversationCount: number;
  answeredQuestionCount: number;
  architectureCount: number;
  exportCount: number;
  hasRequirements: boolean;
  selectedArchitecture?: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
  };
  resumePath: string;
}

// Conversation message types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

// Clarification phase
export interface ClarificationQuestion {
  id: string;
  question: string;
  context?: string;
  suggestedAnswers?: string[];
}

export interface ClarificationResponse {
  questionId: string;
  answer: string;
}

export interface RequirementsSummary {
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  constraints: string[];
  assumptions: string[];
  keyFeatures: string[];
}

// Architecture options
export interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  infrastructure?: string[];
  tools?: string[];
  [category: string]: string[] | undefined;
}

export interface ArchitectureOption {
  id: string;
  projectId: string;
  name: string;
  description: string;
  overview: string;
  techStack: TechStack;
  pros: string[];
  cons: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedCost: 'low' | 'medium' | 'high';
  diagram?: string; // Mermaid diagram code
  selected: boolean;
  createdAt: string;
}

// Component breakdown
export interface Component {
  id: string;
  architectureId: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'service' | 'infrastructure' | 'workflow' | 'compute' | 'storage' | 'orchestration' | 'analytics';
  description: string;
  responsibilities: string[];
  technologies: string[];
  dependencies: string[];
  apis?: APIEndpoint[];
  dataModels?: DataModel[];
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
}

export interface DataModel {
  name: string;
  fields: DataField[];
  relationships?: string[];
}

export interface DataField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// Justifications and tradeoffs
export interface Justification {
  id: string;
  architectureId: string;
  category: 'technology' | 'pattern' | 'infrastructure' | 'security' | 'performance';
  decision: string;
  reasoning: string;
  alternatives: Alternative[];
  tradeoffs: Tradeoff[];
}

export interface Alternative {
  name: string;
  description: string;
  whyNotChosen: string;
}

export interface Tradeoff {
  aspect: string;
  benefit: string;
  cost: string;
}

// Diagrams
export type DiagramType = 
  | 'system_overview'
  | 'component_diagram'
  | 'sequence_diagram'
  | 'deployment_diagram'
  | 'data_flow';

export interface Diagram {
  id: string;
  architectureId: string;
  type: DiagramType;
  title: string;
  mermaidCode: string;
  description?: string;
  createdAt: string;
}

// Export formats
export type ExportFormat = 
  | 'markdown'
  | 'pdf'
  | 'json'
  | 'html'
  | 'png';

export interface ExportOptions {
  format: ExportFormat;
  includeDiagrams: boolean;
  includeJustifications: boolean;
  includeComponents: boolean;
  includeConversation: boolean;
}

export interface ExportResult {
  id: string;
  projectId: string;
  format: ExportFormat;
  filename: string;
  content: string | Buffer;
  createdAt: string;
}

// API request/response types
export interface CreateProjectRequest {
  name: string;
  description: string;
  skillLevel?: SkillLevel;
}

export interface CreateProjectResponse {
  id: string;
  message: string;
}

export interface ClarifyRequest {
  projectId: string;
  previousAnswers?: ClarificationResponse[];
}

export interface ClarifyResponse {
  question: ClarificationQuestion;
  progress: number; // 0-100
  isComplete: boolean;
}

export interface CompleteClarificationRequest {
  projectId: string;
  answers: ClarificationResponse[];
}

export interface CompleteClarificationResponse {
  summary: RequirementsSummary;
  message: string;
}

export interface GenerateArchitectureRequest {
  projectId: string;
  requirements: RequirementsSummary;
}

export interface GenerateArchitectureResponse {
  options: ArchitectureOption[];
  message: string;
}

export interface SelectArchitectureRequest {
  projectId: string;
  architectureId: string;
}

export interface SelectArchitectureResponse {
  architecture: ArchitectureOption;
  components: Component[];
  justifications: Justification[];
  diagrams: Diagram[];
  message: string;
}

export interface GenerateDiagramRequest {
  architectureId: string;
  type: DiagramType;
  components?: Component[];
}

export interface GenerateDiagramResponse {
  diagram: Diagram;
  message: string;
}

// Error types
export interface APIError {
  error: string;
  message: string;
  details?: any;
}

// watsonx.ai specific types
export interface WatsonXConfig {
  apiKey: string;
  projectId: string;
  url: string;
  version: string;
}

export interface WatsonXRequest {
  model_id: string;
  input: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
  };
  project_id: string;
}

export interface WatsonXResponse {
  model_id: string;
  created_at: string;
  results: Array<{
    generated_text: string;
    generated_token_count: number;
    input_token_count: number;
    stop_reason: string;
  }>;
}

// Database schema types
export interface DBProject {
  id: string;
  name: string;
  description: string;
  skill_level: SkillLevel;
  status: ProjectStatus;
  requirements?: string;  // JSON string of RequirementsSummary
  created_at: string;
  updated_at: string;
}

export interface DBConversation {
  id: string;
  project_id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface DBArchitecture {
  id: string;
  project_id: string;
  name: string;
  description: string;
  overview: string;
  tech_stack: string; // JSON string
  pros: string; // JSON string
  cons: string; // JSON string
  complexity: string;
  estimated_cost: string;
  diagram: string | null;
  component_cache?: string | null;
  justification_cache?: string | null;
  selected: number; // SQLite boolean (0 or 1)
  created_at: string;
}

export interface DBExport {
  id: string;
  project_id: string;
  format: ExportFormat;
  filename: string;
  content: string;
  created_at: string;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<T>;

// Made with Bob
