# Technical Specification - AI System Design Assistant

## API Design

### REST API Endpoints

#### 1. Project Management

**POST /api/projects**
Create a new project session

```typescript
// Request
{
  title: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  initialIdea: string;
}

// Response
{
  projectId: string;
  createdAt: string;
  status: 'clarification' | 'architecture' | 'complete';
}
```

**GET /api/projects/:id**
Retrieve project details

```typescript
// Response
{
  id: string;
  title: string;
  skillLevel: string;
  initialIdea: string;
  refinedRequirements?: string;
  selectedArchitecture?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
```

**GET /api/projects**
List all projects

```typescript
// Query params
{
  limit?: number;
  offset?: number;
  skillLevel?: string;
}

// Response
{
  projects: Project[];
  total: number;
  hasMore: boolean;
}
```

**PATCH /api/projects/:id**
Update project details

```typescript
// Request
{
  refinedRequirements?: string;
  selectedArchitecture?: string;
  status?: string;
}

// Response
{
  success: boolean;
  project: Project;
}
```

**DELETE /api/projects/:id**
Delete a project

```typescript
// Response
{
  success: boolean;
  message: string;
}
```

#### 2. Clarification Workflow

**POST /api/clarify**
Get next clarifying question

```typescript
// Request
{
  projectId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// Response
{
  question: string;
  questionNumber: number;
  totalQuestions: number;
  isComplete: boolean;
  refinedRequirements?: string; // Only if isComplete = true
}
```

**POST /api/clarify/complete**
Finalize clarification phase

```typescript
// Request
{
  projectId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// Response
{
  refinedRequirements: string;
  keyPoints: string[];
  suggestedTechnologies: string[];
}
```

#### 3. Architecture Generation

**POST /api/architecture/generate**
Generate architecture options

```typescript
// Request
{
  projectId: string;
  refinedRequirements: string;
  skillLevel: string;
}

// Response
{
  options: Array<{
    id: string;
    name: string;
    description: string;
    overview: string;
    techStack: string[];
    pros: string[];
    cons: string[];
    complexity: 'low' | 'medium' | 'high';
    estimatedCost: string;
    estimatedTime: string;
  }>;
}
```

**POST /api/architecture/select**
Select and expand architecture option

```typescript
// Request
{
  projectId: string;
  optionId: string;
}

// Response
{
  architecture: {
    id: string;
    name: string;
    components: Component[];
    diagram: {
      mermaid: string;
      reactFlow: ReactFlowData;
    };
    justifications: Justification[];
  };
}
```

#### 4. Component Breakdown

**GET /api/architecture/:id/components**
Get detailed component breakdown

```typescript
// Response
{
  components: Array<{
    id: string;
    name: string;
    type: 'frontend' | 'backend' | 'database' | 'service' | 'infrastructure';
    description: string;
    responsibilities: string[];
    technologies: string[];
    dependencies: string[];
    interfaces: Array<{
      name: string;
      type: 'REST' | 'GraphQL' | 'WebSocket' | 'gRPC';
      description: string;
    }>;
    complexity: number; // 1-10
    estimatedEffort: string;
  }>;
}
```

#### 5. Visualization

**POST /api/diagrams/generate**
Generate Mermaid diagram

```typescript
// Request
{
  architectureId: string;
  diagramType: 'architecture' | 'sequence' | 'entity' | 'deployment';
}

// Response
{
  mermaid: string;
  reactFlow: ReactFlowData;
}
```

**POST /api/diagrams/convert**
Convert between diagram formats

```typescript
// Request
{
  source: 'mermaid' | 'reactflow';
  target: 'mermaid' | 'reactflow';
  data: string | ReactFlowData;
}

// Response
{
  converted: string | ReactFlowData;
}
```

#### 6. Justifications

**GET /api/architecture/:id/justifications**
Get decision justifications

```typescript
// Response
{
  justifications: Array<{
    category: 'technology' | 'pattern' | 'scalability' | 'security' | 'cost' | 'maintenance';
    decision: string;
    reasoning: string;
    alternatives: Array<{
      option: string;
      pros: string[];
      cons: string[];
    }>;
    tradeoffs: string[];
    skillLevelNotes: string; // Adapted to user's skill level
  }>;
}
```

#### 7. Export

**POST /api/export**
Export project documentation

```typescript
// Request
{
  projectId: string;
  format: 'markdown' | 'pdf' | 'json' | 'png' | 'svg';
  includeConversation?: boolean;
  includeDiagrams?: boolean;
}

// Response (for JSON)
{
  data: ExportData;
}

// Response (for files)
{
  fileUrl: string;
  expiresAt: string;
}
```

## Data Models

### TypeScript Interfaces

```typescript
// Core Models
interface Project {
  id: string;
  title: string;
  skillLevel: SkillLevel;
  initialIdea: string;
  refinedRequirements?: string;
  selectedArchitecture?: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
type ProjectStatus = 'clarification' | 'architecture' | 'design' | 'complete';

interface Conversation {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Architecture {
  id: string;
  projectId: string;
  optionName: string;
  description: string;
  overview: string;
  techStack: string[];
  components: Component[];
  diagram: Diagram;
  justifications: Justification[];
  pros: string[];
  cons: string[];
  complexity: Complexity;
  estimatedCost: string;
  estimatedTime: string;
  createdAt: Date;
}

type Complexity = 'low' | 'medium' | 'high';

interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  responsibilities: string[];
  technologies: string[];
  dependencies: string[];
  interfaces: Interface[];
  complexity: number; // 1-10
  estimatedEffort: string;
  implementationNotes: string[];
}

type ComponentType = 
  | 'frontend' 
  | 'backend' 
  | 'database' 
  | 'service' 
  | 'infrastructure' 
  | 'integration';

interface Interface {
  name: string;
  type: InterfaceType;
  description: string;
  endpoints?: Endpoint[];
  dataFormat?: string;
}

type InterfaceType = 'REST' | 'GraphQL' | 'WebSocket' | 'gRPC' | 'Message Queue';

interface Endpoint {
  method: string;
  path: string;
  description: string;
  requestSchema?: object;
  responseSchema?: object;
}

interface Diagram {
  mermaid: string;
  reactFlow: ReactFlowData;
  type: DiagramType;
}

type DiagramType = 'architecture' | 'sequence' | 'entity' | 'deployment' | 'component';

interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    type?: ComponentType;
  };
}

interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

interface Justification {
  id: string;
  category: JustificationCategory;
  decision: string;
  reasoning: string;
  alternatives: Alternative[];
  tradeoffs: string[];
  skillLevelNotes: Record<SkillLevel, string>;
}

type JustificationCategory = 
  | 'technology' 
  | 'pattern' 
  | 'scalability' 
  | 'security' 
  | 'cost' 
  | 'maintenance';

interface Alternative {
  option: string;
  pros: string[];
  cons: string[];
  whenToUse: string;
}

interface ExportData {
  project: Project;
  conversations: Conversation[];
  architecture: Architecture;
  diagrams: {
    mermaid: string;
    svg?: string;
    png?: string;
  };
  documentation: string; // Markdown format
}
```

## Database Schema (SQLite)

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  skill_level TEXT NOT NULL CHECK(skill_level IN ('beginner', 'intermediate', 'advanced')),
  initial_idea TEXT NOT NULL,
  refined_requirements TEXT,
  selected_architecture TEXT,
  status TEXT NOT NULL DEFAULT 'clarification' CHECK(status IN ('clarification', 'architecture', 'design', 'complete')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Conversations table
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_project ON conversations(project_id, timestamp);

-- Architectures table
CREATE TABLE architectures (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  option_name TEXT NOT NULL,
  description TEXT,
  overview TEXT,
  tech_stack TEXT, -- JSON array
  components TEXT, -- JSON array
  diagram_mermaid TEXT,
  diagram_reactflow TEXT, -- JSON
  justifications TEXT, -- JSON array
  pros TEXT, -- JSON array
  cons TEXT, -- JSON array
  complexity TEXT CHECK(complexity IN ('low', 'medium', 'high')),
  estimated_cost TEXT,
  estimated_time TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_architectures_project ON architectures(project_id);

-- Components table (denormalized for easier querying)
CREATE TABLE components (
  id TEXT PRIMARY KEY,
  architecture_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  responsibilities TEXT, -- JSON array
  technologies TEXT, -- JSON array
  dependencies TEXT, -- JSON array
  interfaces TEXT, -- JSON array
  complexity INTEGER CHECK(complexity BETWEEN 1 AND 10),
  estimated_effort TEXT,
  implementation_notes TEXT, -- JSON array
  FOREIGN KEY (architecture_id) REFERENCES architectures(id) ON DELETE CASCADE
);

CREATE INDEX idx_components_architecture ON components(architecture_id);

-- Exports table (track generated exports)
CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  format TEXT NOT NULL,
  file_path TEXT,
  file_url TEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_exports_project ON exports(project_id);
CREATE INDEX idx_exports_expires ON exports(expires_at);
```

## IBM watsonx.ai Integration

### Prompt Templates

#### 1. Clarification Question Generation

```typescript
const clarificationPrompt = (context: {
  projectIdea: string;
  skillLevel: SkillLevel;
  conversationHistory: Conversation[];
  questionNumber: number;
}) => `You are Bob, an experienced technical leader helping a ${context.skillLevel} developer refine their project idea.

Project Idea: "${context.projectIdea}"

Previous Conversation:
${context.conversationHistory.map(c => `${c.role}: ${c.content}`).join('\n')}

This is question ${context.questionNumber} of approximately 5-7 questions.

Generate ONE specific, actionable clarifying question that will help refine the requirements. Focus on:
- Target users and use cases (if not yet clear)
- Scale and performance requirements
- Technology constraints or preferences
- Integration needs with existing systems
- Timeline and resource constraints
- Security and compliance requirements

Keep the question concise and appropriate for a ${context.skillLevel} developer.

Return ONLY the question, no additional text.`;
```

#### 2. Requirements Summary Generation

```typescript
const requirementsSummaryPrompt = (context: {
  projectIdea: string;
  conversationHistory: Conversation[];
  skillLevel: SkillLevel;
}) => `Based on the following conversation, create a comprehensive requirements summary.

Initial Idea: "${context.projectIdea}"

Conversation:
${context.conversationHistory.map(c => `${c.role}: ${c.content}`).join('\n')}

Create a structured requirements summary that includes:
1. Project Overview (2-3 sentences)
2. Target Users
3. Core Features (prioritized list)
4. Technical Requirements
5. Scale and Performance Needs
6. Integration Requirements
7. Constraints and Considerations

Format as clear, concise bullet points appropriate for a ${context.skillLevel} developer.

Return as JSON:
{
  "overview": "string",
  "targetUsers": ["string"],
  "coreFeatures": ["string"],
  "technicalRequirements": ["string"],
  "scaleAndPerformance": "string",
  "integrations": ["string"],
  "constraints": ["string"]
}`;
```

#### 3. Architecture Options Generation

```typescript
const architectureOptionsPrompt = (context: {
  requirements: string;
  skillLevel: SkillLevel;
}) => `You are a senior software architect. Generate 3 distinct architecture options for the following requirements:

${context.requirements}

Developer Skill Level: ${context.skillLevel}

For each option, provide:
1. Name (e.g., "Monolithic Architecture", "Microservices Architecture")
2. Brief description (2-3 sentences)
3. Overview (1 paragraph explaining the approach)
4. Recommended tech stack (specific technologies)
5. Pros (3-5 advantages)
6. Cons (3-5 disadvantages)
7. Complexity rating (low/medium/high)
8. Estimated cost (relative: $, $$, $$$)
9. Estimated development time (e.g., "2-3 months")

Ensure options are:
- Distinctly different approaches
- Appropriate for the skill level
- Realistic and implementable
- Include modern best practices

Return as JSON array of architecture options.`;
```

#### 4. Component Breakdown Generation

```typescript
const componentBreakdownPrompt = (context: {
  architecture: Architecture;
  skillLevel: SkillLevel;
}) => `Break down the following architecture into detailed components:

Architecture: ${context.architecture.optionName}
Description: ${context.architecture.description}
Tech Stack: ${context.architecture.techStack.join(', ')}

Developer Skill Level: ${context.skillLevel}

For each component, provide:
1. Name
2. Type (frontend/backend/database/service/infrastructure)
3. Description (2-3 sentences)
4. Responsibilities (specific tasks it handles)
5. Recommended technologies
6. Dependencies (other components it relies on)
7. Interfaces (APIs, events, etc.)
8. Complexity rating (1-10)
9. Estimated effort (e.g., "1-2 weeks")
10. Implementation notes (key considerations)

Adjust the number and complexity of components based on skill level:
- Beginner: 3-5 high-level components
- Intermediate: 5-8 components with moderate detail
- Advanced: 8-12+ components with fine-grained separation

Return as JSON array of components.`;
```

#### 5. Mermaid Diagram Generation

```typescript
const mermaidDiagramPrompt = (context: {
  architecture: Architecture;
  components: Component[];
  diagramType: DiagramType;
}) => `Generate a Mermaid diagram for the following architecture:

Architecture: ${context.architecture.optionName}
Components: ${context.components.map(c => c.name).join(', ')}
Diagram Type: ${context.diagramType}

Component Details:
${context.components.map(c => `
- ${c.name} (${c.type}): ${c.description}
  Dependencies: ${c.dependencies.join(', ') || 'none'}
`).join('\n')}

Generate valid Mermaid syntax for a ${context.diagramType} diagram that:
- Shows all components and their relationships
- Uses appropriate Mermaid diagram type
- Includes clear labels
- Groups related components if applicable
- Uses proper Mermaid syntax (no quotes in brackets, no parentheses in brackets)

Return ONLY the Mermaid code, starting with the diagram type declaration.`;
```

#### 6. Justification Generation

```typescript
const justificationPrompt = (context: {
  architecture: Architecture;
  components: Component[];
  skillLevel: SkillLevel;
}) => `Provide detailed justifications for the architectural decisions in:

Architecture: ${context.architecture.optionName}
Tech Stack: ${context.architecture.techStack.join(', ')}
Components: ${context.components.map(c => c.name).join(', ')}

Developer Skill Level: ${context.skillLevel}

For each major decision category, provide:

1. Technology Choices
   - Why these specific technologies?
   - What alternatives were considered?
   - What are the tradeoffs?

2. Architectural Patterns
   - Why this overall structure?
   - What patterns are being used?
   - How does it support the requirements?

3. Scalability Approach
   - How will it handle growth?
   - What are the scaling strategies?
   - What are the bottlenecks?

4. Security Considerations
   - What security measures are built-in?
   - What vulnerabilities are addressed?
   - What additional security is needed?

5. Cost Implications
   - What are the infrastructure costs?
   - What are the development costs?
   - What are the maintenance costs?

6. Maintenance Burden
   - How easy is it to maintain?
   - What skills are required?
   - What are the long-term considerations?

Adapt explanations to ${context.skillLevel} level:
- Beginner: Simple language, analogies, avoid jargon
- Intermediate: Technical terms with explanations
- Advanced: Deep technical analysis, industry best practices

Return as JSON array of justifications with category, decision, reasoning, alternatives, and tradeoffs.`;
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

// Error codes
enum ErrorCode {
  // Client errors (4xx)
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Business logic errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  INVALID_SKILL_LEVEL = 'INVALID_SKILL_LEVEL',
  CLARIFICATION_INCOMPLETE = 'CLARIFICATION_INCOMPLETE',
  ARCHITECTURE_NOT_SELECTED = 'ARCHITECTURE_NOT_SELECTED',
}
```

### Retry Strategy

```typescript
// For watsonx.ai API calls
const retryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // ms
  maxDelay: 10000, // ms
  retryableErrors: [
    'RATE_LIMIT_EXCEEDED',
    'SERVICE_UNAVAILABLE',
    'TIMEOUT',
  ],
};
```

## Performance Optimization

### Caching Strategy

```typescript
// Cache AI responses for common patterns
interface CacheConfig {
  clarificationQuestions: {
    ttl: 3600, // 1 hour
    maxSize: 100,
  },
  architectureOptions: {
    ttl: 7200, // 2 hours
    maxSize: 50,
  },
  diagrams: {
    ttl: 86400, // 24 hours
    maxSize: 200,
  },
}
```

### Rate Limiting

```typescript
// API rate limits
const rateLimits = {
  perUser: {
    requests: 100,
    window: 3600, // 1 hour
  },
  perIP: {
    requests: 200,
    window: 3600,
  },
  watsonxAPI: {
    requests: 50,
    window: 60, // 1 minute
  },
};
```

## Security Considerations

### Input Validation

```typescript
// Zod schemas for validation
import { z } from 'zod';

const ProjectSchema = z.object({
  title: z.string().min(3).max(200),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  initialIdea: z.string().min(10).max(5000),
});

const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
});
```

### API Key Management

```typescript
// Environment variables
interface EnvConfig {
  WATSONX_API_KEY: string;
  WATSONX_URL: string;
  WATSONX_PROJECT_ID: string;
  DATABASE_PATH: string;
  SESSION_SECRET: string;
  EXPORT_STORAGE_PATH: string;
}
```

### Content Sanitization

```typescript
// Sanitize user input before AI processing
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
```

## Testing Strategy

### Unit Tests
- API route handlers
- Data validation
- Utility functions
- Component logic

### Integration Tests
- Database operations
- watsonx.ai integration
- End-to-end workflows

### E2E Tests
- Complete user journeys
- Multi-step processes
- Export functionality

## Deployment Configuration

### Environment Variables

```bash
# .env.example
WATSONX_API_KEY=your_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_project_id
DATABASE_PATH=./data/projects.db
SESSION_SECRET=your_secret_key
EXPORT_STORAGE_PATH=./exports
NODE_ENV=production
PORT=3000
```

### Build Configuration

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:e2e": "playwright test",
    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js"
  }
}
```

This technical specification provides the detailed implementation guidelines needed to build the AI-powered system design assistant.