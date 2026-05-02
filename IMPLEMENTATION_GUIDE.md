# Implementation Guide - AI System Design Assistant

This guide provides detailed implementation instructions for building the application.

## Project Structure

```
ibm_hackathon/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Landing page
│   │   ├── globals.css              # Global styles
│   │   ├── project/
│   │   │   └── [id]/
│   │   │       ├── page.tsx         # Project detail page
│   │   │       ├── clarify/
│   │   │       │   └── page.tsx     # Clarification workflow
│   │   │       ├── architecture/
│   │   │       │   └── page.tsx     # Architecture selection
│   │   │       ├── design/
│   │   │       │   └── page.tsx     # Detailed design view
│   │   │       └── export/
│   │   │           └── page.tsx     # Export options
│   │   ├── history/
│   │   │   └── page.tsx             # Project history
│   │   └── api/                     # API routes
│   │       ├── projects/
│   │       │   ├── route.ts         # List/create projects
│   │       │   └── [id]/
│   │       │       ├── route.ts     # Get/update/delete project
│   │       │       └── conversations/
│   │       │           └── route.ts # Project conversations
│   │       ├── clarify/
│   │       │   ├── route.ts         # Generate questions
│   │       │   └── complete/
│   │       │       └── route.ts     # Finalize clarification
│   │       ├── architecture/
│   │       │   ├── generate/
│   │       │   │   └── route.ts     # Generate options
│   │       │   ├── select/
│   │       │   │   └── route.ts     # Select option
│   │       │   └── [id]/
│   │       │       ├── components/
│   │       │       │   └── route.ts # Get components
│   │       │       └── justifications/
│   │       │           └── route.ts # Get justifications
│   │       ├── diagrams/
│   │       │   ├── generate/
│   │       │   │   └── route.ts     # Generate diagrams
│   │       │   └── convert/
│   │       │       └── route.ts     # Convert formats
│   │       └── export/
│   │           └── route.ts         # Export project
│   ├── components/                   # React components
│   │   ├── ui/                      # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   └── loading.tsx
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── footer.tsx
│   │   │   └── sidebar.tsx
│   │   ├── project/
│   │   │   ├── project-card.tsx
│   │   │   ├── project-list.tsx
│   │   │   └── skill-level-selector.tsx
│   │   ├── clarification/
│   │   │   ├── conversation-interface.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── progress-indicator.tsx
│   │   │   └── requirements-summary.tsx
│   │   ├── architecture/
│   │   │   ├── option-card.tsx
│   │   │   ├── option-comparison.tsx
│   │   │   └── tech-stack-display.tsx
│   │   ├── design/
│   │   │   ├── component-list.tsx
│   │   │   ├── component-detail.tsx
│   │   │   └── dependency-graph.tsx
│   │   ├── visualization/
│   │   │   ├── mermaid-diagram.tsx
│   │   │   ├── react-flow-editor.tsx
│   │   │   └── diagram-toolbar.tsx
│   │   ├── justification/
│   │   │   ├── justification-card.tsx
│   │   │   ├── tradeoff-display.tsx
│   │   │   └── alternative-options.tsx
│   │   └── export/
│   │       ├── export-options.tsx
│   │       └── format-selector.tsx
│   ├── lib/                         # Utility libraries
│   │   ├── watsonx-client.ts       # watsonx.ai client
│   │   ├── database.ts             # SQLite database
│   │   ├── prompts.ts              # AI prompt templates
│   │   ├── validators.ts           # Zod schemas
│   │   ├── rate-limiter.ts         # Rate limiting
│   │   ├── cache.ts                # Response caching
│   │   ├── export-generator.ts     # Export functionality
│   │   └── utils.ts                # Helper functions
│   ├── types/                       # TypeScript types
│   │   ├── project.ts
│   │   ├── architecture.ts
│   │   ├── component.ts
│   │   ├── diagram.ts
│   │   └── api.ts
│   └── hooks/                       # Custom React hooks
│       ├── use-project.ts
│       ├── use-conversation.ts
│       ├── use-architecture.ts
│       └── use-export.ts
├── public/                          # Static assets
│   ├── images/
│   └── examples/
├── scripts/                         # Utility scripts
│   ├── test-watsonx.ts
│   ├── migrate-db.ts
│   └── seed-examples.ts
├── data/                            # Database files
│   └── projects.db
├── exports/                         # Generated exports
├── tests/                           # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.local                       # Environment variables
├── .env.example                     # Example env file
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

## Phase 1: Project Setup

### 1.1 Initialize Next.js Project

```bash
# Create Next.js app with TypeScript
npx create-next-app@latest ibm_hackathon --typescript --tailwind --app --src-dir

cd ibm_hackathon

# Install dependencies
npm install @ibm-cloud/watsonx-ai
npm install better-sqlite3 @types/better-sqlite3
npm install zod
npm install mermaid
npm install reactflow
npm install limiter @types/limiter
npm install uuid @types/uuid
npm install date-fns
npm install clsx tailwind-merge
npm install lucide-react

# Install dev dependencies
npm install -D @types/node
npm install -D tsx
npm install -D jest @testing-library/react @testing-library/jest-dom
npm install -D prettier eslint-config-prettier
```

### 1.2 Configure TypeScript

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 1.3 Configure Tailwind CSS

Update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
      },
    },
  },
  plugins: [],
}
```

### 1.4 Set Up Environment Variables

Create `.env.local`:

```bash
# IBM watsonx.ai
WATSONX_API_KEY=your_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_project_id_here

# Database
DATABASE_PATH=./data/projects.db

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Export Storage
EXPORT_STORAGE_PATH=./exports
```

Create `.env.example`:

```bash
# IBM watsonx.ai
WATSONX_API_KEY=your_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_project_id_here

# Database
DATABASE_PATH=./data/projects.db

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Export Storage
EXPORT_STORAGE_PATH=./exports
```

## Phase 2: Database Setup

### 2.1 Create Database Schema

Create `scripts/migrate-db.ts`:

```typescript
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/projects.db';

// Ensure data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
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

  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id, timestamp);

  CREATE TABLE IF NOT EXISTS architectures (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    option_name TEXT NOT NULL,
    description TEXT,
    overview TEXT,
    tech_stack TEXT,
    components TEXT,
    diagram_mermaid TEXT,
    diagram_reactflow TEXT,
    justifications TEXT,
    pros TEXT,
    cons TEXT,
    complexity TEXT CHECK(complexity IN ('low', 'medium', 'high')),
    estimated_cost TEXT,
    estimated_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_architectures_project ON architectures(project_id);

  CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT,
    file_url TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);
  CREATE INDEX IF NOT EXISTS idx_exports_expires ON exports(expires_at);
`);

console.log('✅ Database schema created successfully');

db.close();
```

Run migration:

```bash
npx tsx scripts/migrate-db.ts
```

### 2.2 Create Database Client

Create `src/lib/database.ts`:

```typescript
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = process.env.DATABASE_PATH || './data/projects.db';

class DatabaseClient {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('foreign_keys = ON');
  }

  // Projects
  createProject(data: {
    title: string;
    skillLevel: string;
    initialIdea: string;
  }) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, title, skill_level, initial_idea, status)
      VALUES (?, ?, ?, ?, 'clarification')
    `);
    
    stmt.run(id, data.title, data.skillLevel, data.initialIdea);
    return this.getProject(id);
  }

  getProject(id: string) {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id);
  }

  listProjects(limit = 20, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM projects 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  updateProject(id: string, data: Partial<{
    refinedRequirements: string;
    selectedArchitecture: string;
    status: string;
  }>) {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.refinedRequirements !== undefined) {
      updates.push('refined_requirements = ?');
      values.push(data.refinedRequirements);
    }
    if (data.selectedArchitecture !== undefined) {
      updates.push('selected_architecture = ?');
      values.push(data.selectedArchitecture);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE projects 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getProject(id);
  }

  deleteProject(id: string) {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    return stmt.run(id);
  }

  // Conversations
  addConversation(data: {
    projectId: string;
    role: 'user' | 'assistant';
    content: string;
  }) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, project_id, role, content)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, data.projectId, data.role, data.content);
    return { id, ...data };
  }

  getConversations(projectId: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE project_id = ? 
      ORDER BY timestamp ASC
    `);
    return stmt.all(projectId);
  }

  // Architectures
  createArchitecture(data: {
    projectId: string;
    optionName: string;
    description: string;
    overview: string;
    techStack: string[];
    components: any[];
    diagramMermaid: string;
    diagramReactflow: any;
    justifications: any[];
    pros: string[];
    cons: string[];
    complexity: string;
    estimatedCost: string;
    estimatedTime: string;
  }) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO architectures (
        id, project_id, option_name, description, overview,
        tech_stack, components, diagram_mermaid, diagram_reactflow,
        justifications, pros, cons, complexity, estimated_cost, estimated_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.projectId,
      data.optionName,
      data.description,
      data.overview,
      JSON.stringify(data.techStack),
      JSON.stringify(data.components),
      data.diagramMermaid,
      JSON.stringify(data.diagramReactflow),
      JSON.stringify(data.justifications),
      JSON.stringify(data.pros),
      JSON.stringify(data.cons),
      data.complexity,
      data.estimatedCost,
      data.estimatedTime
    );
    
    return this.getArchitecture(id);
  }

  getArchitecture(id: string) {
    const stmt = this.db.prepare('SELECT * FROM architectures WHERE id = ?');
    const row: any = stmt.get(id);
    
    if (!row) return null;
    
    return {
      ...row,
      tech_stack: JSON.parse(row.tech_stack),
      components: JSON.parse(row.components),
      diagram_reactflow: JSON.parse(row.diagram_reactflow),
      justifications: JSON.parse(row.justifications),
      pros: JSON.parse(row.pros),
      cons: JSON.parse(row.cons),
    };
  }

  getArchitecturesByProject(projectId: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM architectures WHERE project_id = ?
    `);
    return stmt.all(projectId).map((row: any) => ({
      ...row,
      tech_stack: JSON.parse(row.tech_stack),
      components: JSON.parse(row.components),
      diagram_reactflow: JSON.parse(row.diagram_reactflow),
      justifications: JSON.parse(row.justifications),
      pros: JSON.parse(row.pros),
      cons: JSON.parse(row.cons),
    }));
  }

  close() {
    this.db.close();
  }
}

export const db = new DatabaseClient();
```

## Phase 3: watsonx.ai Integration

### 3.1 Create watsonx Client

Create `src/lib/watsonx-client.ts`:

```typescript
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';

interface GenerateOptions {
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

class WatsonXClient {
  private client: WatsonXAI;
  private projectId: string;

  constructor() {
    this.client = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: process.env.WATSONX_URL!,
      apikey: process.env.WATSONX_API_KEY!,
    });
    this.projectId = process.env.WATSONX_PROJECT_ID!;
  }

  async generateText(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    const {
      modelId = 'ibm/granite-13b-chat-v2',
      temperature = 0.7,
      maxTokens = 2000,
    } = options;

    try {
      const response = await this.client.generateText({
        input: prompt,
        modelId,
        projectId: this.projectId,
        parameters: {
          max_new_tokens: maxTokens,
          temperature,
          top_p: 0.9,
          top_k: 50,
          repetition_penalty: 1.1,
        },
      });

      return response.result.results[0].generated_text.trim();
    } catch (error: any) {
      console.error('watsonx.ai error:', error);
      throw new Error(`watsonx.ai API error: ${error.message}`);
    }
  }

  async generateWithRetry(
    prompt: string,
    options: GenerateOptions = {},
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateText(prompt, options);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }
}

export const watsonxClient = new WatsonXClient();
```

### 3.2 Create Prompt Templates

Create `src/lib/prompts.ts`:

```typescript
import { SkillLevel } from '@/types/project';

export const prompts = {
  clarificationQuestion: (context: {
    projectIdea: string;
    skillLevel: SkillLevel;
    conversationHistory: Array<{ role: string; content: string }>;
    questionNumber: number;
  }) => `You are Bob, an experienced technical leader helping a ${context.skillLevel} developer refine their project idea.

Project Idea: "${context.projectIdea}"

Previous Conversation:
${context.conversationHistory.map(c => `${c.role}: ${c.content}`).join('\n')}

This is question ${context.questionNumber} of approximately 5-7 questions.

Generate ONE specific, actionable clarifying question. Focus on aspects not yet covered:
- Target users and use cases
- Scale and performance requirements
- Technology constraints
- Integration needs
- Timeline and resources
- Security requirements

Keep it concise and appropriate for a ${context.skillLevel} developer.

Return ONLY the question.`,

  requirementsSummary: (context: {
    projectIdea: string;
    conversationHistory: Array<{ role: string; content: string }>;
    skillLevel: SkillLevel;
  }) => `Based on this conversation, create a comprehensive requirements summary.

Initial Idea: "${context.projectIdea}"

Conversation:
${context.conversationHistory.map(c => `${c.role}: ${c.content}`).join('\n')}

Create a structured summary with:
1. Project Overview
2. Target Users
3. Core Features
4. Technical Requirements
5. Scale and Performance
6. Integrations
7. Constraints

Format for ${context.skillLevel} developer.

Return as JSON:
{
  "overview": "string",
  "targetUsers": ["string"],
  "coreFeatures": ["string"],
  "technicalRequirements": ["string"],
  "scaleAndPerformance": "string",
  "integrations": ["string"],
  "constraints": ["string"]
}`,

  architectureOptions: (context: {
    requirements: string;
    skillLevel: SkillLevel;
  }) => `Generate 3 distinct architecture options for:

${context.requirements}

Developer Skill Level: ${context.skillLevel}

For each option provide:
1. Name
2. Description
3. Overview
4. Tech stack
5. Pros (3-5)
6. Cons (3-5)
7. Complexity (low/medium/high)
8. Estimated cost ($, $$, $$$)
9. Estimated time

Return as JSON array.`,
};
```

## Next Steps

This implementation guide provides the foundation. The remaining phases include:

1. **Phase 4**: Build UI components
2. **Phase 5**: Implement API routes
3. **Phase 6**: Create visualization components
4. **Phase 7**: Add export functionality
5. **Phase 8**: Testing and deployment

Would you like me to continue with the remaining phases?