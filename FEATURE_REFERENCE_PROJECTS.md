# Feature Specification: Reference Projects

## Overview

Allow users to provide links to existing similar projects and specify what they like/dislike about them. This helps the AI understand user preferences and generate more tailored architecture recommendations.

## User Value

1. **Better Context**: AI understands user preferences through concrete examples
2. **Faster Refinement**: Reduces back-and-forth clarification questions
3. **Personalized Results**: Architecture options align with stated preferences
4. **Learning from Examples**: Users can reference best practices they've seen

## Feature Flow

### Phase 1: Initial Idea Submission (Enhanced)

```
1. User enters project idea
2. User selects skill level
3. [NEW] User optionally adds reference projects:
   - Project URL (GitHub, live site, etc.)
   - What they like about it
   - What they dislike about it
   - Specific features to emulate/avoid
4. Click "Start Design Process"
```

## UI Design

### Reference Projects Input Component

```
┌─────────────────────────────────────────────────────────┐
│ Reference Projects (Optional)                            │
│                                                          │
│ Have similar projects in mind? Share them to help us    │
│ understand your preferences better.                      │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Project 1                                           │ │
│ │                                                     │ │
│ │ URL: [https://github.com/example/project        ] │ │
│ │                                                     │ │
│ │ What I like:                                        │ │
│ │ [Clean architecture, good documentation         ] │ │
│ │                                                     │ │
│ │ What I dislike:                                     │ │
│ │ [Too complex for beginners, over-engineered     ] │ │
│ │                                                     │ │
│ │ Features to emulate:                                │ │
│ │ [API design, testing approach                   ] │ │
│ │                                                     │ │
│ │ Features to avoid:                                  │ │
│ │ [Microservices complexity                       ] │ │
│ │                                                     │ │
│ │                                    [Remove Project] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [+ Add Another Reference Project]                       │
│                                                          │
│ [Skip This Step]              [Continue to Clarification]│
└─────────────────────────────────────────────────────────┘
```

## Data Model

### TypeScript Interface

```typescript
interface ReferenceProject {
  id: string;
  url: string;
  likes: string[];          // What user likes
  dislikes: string[];       // What user dislikes
  emulateFeatures: string[]; // Features to copy
  avoidFeatures: string[];   // Features to avoid
  notes?: string;            // Additional context
}

interface Project {
  // ... existing fields
  referenceProjects?: ReferenceProject[];
}
```

### Database Schema Addition

```sql
-- Add to existing schema
CREATE TABLE reference_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  likes TEXT,              -- JSON array
  dislikes TEXT,           -- JSON array
  emulate_features TEXT,   -- JSON array
  avoid_features TEXT,     -- JSON array
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_reference_projects_project ON reference_projects(project_id);
```

## AI Integration

### Enhanced Clarification Prompt

```typescript
const clarificationPromptWithReferences = (context: {
  projectIdea: string;
  skillLevel: SkillLevel;
  referenceProjects: ReferenceProject[];
  conversationHistory: Conversation[];
  questionNumber: number;
}) => `You are Bob, an experienced technical leader helping a ${context.skillLevel} developer refine their project idea.

Project Idea: "${context.projectIdea}"

Reference Projects:
${context.referenceProjects.map(ref => `
- URL: ${ref.url}
  Likes: ${ref.likes.join(', ')}
  Dislikes: ${ref.dislikes.join(', ')}
  Features to emulate: ${ref.emulateFeatures.join(', ')}
  Features to avoid: ${ref.avoidFeatures.join(', ')}
`).join('\n')}

Previous Conversation:
${context.conversationHistory.map(c => `${c.role}: ${c.content}`).join('\n')}

Based on the reference projects, the user prefers:
- ${extractPreferences(context.referenceProjects)}

Generate ONE specific clarifying question that builds on these preferences.
Focus on aspects not yet covered by the reference projects.

Return ONLY the question.`;
```

### Architecture Generation Enhancement

```typescript
const architectureOptionsWithReferences = (context: {
  requirements: string;
  skillLevel: SkillLevel;
  referenceProjects: ReferenceProject[];
}) => `Generate 3 distinct architecture options for:

${context.requirements}

Developer Skill Level: ${context.skillLevel}

User has provided these reference projects as examples:
${context.referenceProjects.map(ref => `
- ${ref.url}
  Positive aspects: ${ref.likes.join(', ')}
  Negative aspects: ${ref.dislikes.join(', ')}
  Emulate: ${ref.emulateFeatures.join(', ')}
  Avoid: ${ref.avoidFeatures.join(', ')}
`).join('\n')}

IMPORTANT: 
- Incorporate the positive aspects from reference projects
- Avoid the negative aspects mentioned
- Explain how each option addresses user preferences
- Reference specific examples when relevant

For each option provide:
1. Name
2. Description
3. Overview
4. Tech stack
5. Pros (3-5)
6. Cons (3-5)
7. How it addresses reference project preferences
8. Complexity (low/medium/high)
9. Estimated cost ($, $$, $$$)
10. Estimated time

Return as JSON array.`;
```

## API Endpoints

### POST /api/reference-projects

Add reference project to existing project

```typescript
// Request
{
  projectId: string;
  url: string;
  likes: string[];
  dislikes: string[];
  emulateFeatures: string[];
  avoidFeatures: string[];
  notes?: string;
}

// Response
{
  id: string;
  projectId: string;
  url: string;
  likes: string[];
  dislikes: string[];
  emulateFeatures: string[];
  avoidFeatures: string[];
  notes?: string;
  createdAt: string;
}
```

### GET /api/reference-projects/:projectId

Get all reference projects for a project

```typescript
// Response
{
  referenceProjects: ReferenceProject[];
}
```

### DELETE /api/reference-projects/:id

Remove a reference project

```typescript
// Response
{
  success: boolean;
  message: string;
}
```

## URL Metadata Extraction (Optional Enhancement)

### Automatic Project Analysis

When user provides a URL, optionally fetch metadata:

```typescript
interface URLMetadata {
  title: string;
  description: string;
  techStack?: string[];      // Detected from README, package.json
  stars?: number;            // GitHub stars
  language?: string;         // Primary language
  topics?: string[];         // GitHub topics
  screenshot?: string;       // Open Graph image
}

// API endpoint
POST /api/analyze-url
{
  url: string;
}

// Response
{
  metadata: URLMetadata;
  suggestions: {
    possibleLikes: string[];
    possibleDislikes: string[];
    detectedFeatures: string[];
  };
}
```

### Implementation

```typescript
// lib/url-analyzer.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function analyzeProjectURL(url: string): Promise<URLMetadata> {
  // GitHub-specific analysis
  if (url.includes('github.com')) {
    return analyzeGitHubProject(url);
  }
  
  // Generic web scraping
  return analyzeGenericURL(url);
}

async function analyzeGitHubProject(url: string): Promise<URLMetadata> {
  // Extract owner/repo from URL
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  
  const [, owner, repo] = match;
  
  // Use GitHub API
  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`, // Optional
      },
    }
  );
  
  return {
    title: response.data.name,
    description: response.data.description,
    stars: response.data.stargazers_count,
    language: response.data.language,
    topics: response.data.topics,
  };
}
```

## User Experience Enhancements

### Smart Suggestions

Based on common patterns, suggest categories:

```typescript
const suggestionCategories = {
  likes: [
    'Clean code architecture',
    'Good documentation',
    'Easy to understand',
    'Modern tech stack',
    'Good test coverage',
    'Performance optimized',
    'Scalable design',
    'Security best practices',
  ],
  dislikes: [
    'Too complex',
    'Poor documentation',
    'Outdated dependencies',
    'Over-engineered',
    'Hard to maintain',
    'Slow performance',
    'Security issues',
    'Difficult to deploy',
  ],
  features: [
    'Authentication system',
    'API design',
    'Database schema',
    'UI/UX patterns',
    'Testing approach',
    'Deployment strategy',
    'Error handling',
    'Logging system',
  ],
};
```

### Quick Add Buttons

```tsx
// Component example
<div className="flex flex-wrap gap-2 mb-4">
  <span className="text-sm text-gray-600">Quick add:</span>
  {suggestionCategories.likes.map(suggestion => (
    <button
      key={suggestion}
      onClick={() => addLike(suggestion)}
      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200"
    >
      + {suggestion}
    </button>
  ))}
</div>
```

## Validation Rules

```typescript
import { z } from 'zod';

const ReferenceProjectSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  likes: z.array(z.string().min(3).max(200)).min(1, 'Add at least one thing you like'),
  dislikes: z.array(z.string().min(3).max(200)).optional(),
  emulateFeatures: z.array(z.string().min(3).max(200)).optional(),
  avoidFeatures: z.array(z.string().min(3).max(200)).optional(),
  notes: z.string().max(1000).optional(),
});

// Validate before submission
const validateReferenceProject = (data: unknown) => {
  return ReferenceProjectSchema.parse(data);
};
```

## Benefits to AI Processing

### 1. Reduced Clarification Questions

Instead of asking generic questions, AI can focus on:
- Specific gaps not covered by references
- Tradeoffs between conflicting preferences
- Scale and performance specifics

### 2. Better Architecture Alignment

AI can:
- Prioritize patterns seen in liked projects
- Avoid anti-patterns from disliked projects
- Suggest similar tech stacks
- Reference specific examples in justifications

### 3. Improved Justifications

```
"Based on your preference for [Project X]'s clean architecture, 
this option uses a similar layered approach with clear separation 
of concerns. However, unlike [Project Y] which you found over-engineered, 
we've kept the microservices count minimal."
```

## Implementation Priority

### Phase 1 (MVP)
- [ ] Basic reference project input (URL + likes/dislikes)
- [ ] Store in database
- [ ] Include in AI prompts
- [ ] Display in project summary

### Phase 2 (Enhanced)
- [ ] URL metadata extraction
- [ ] Smart suggestions
- [ ] Quick add buttons
- [ ] Visual preview of referenced projects

### Phase 3 (Advanced)
- [ ] Automatic similarity detection
- [ ] Compare user's architecture with references
- [ ] Highlight differences and similarities
- [ ] Generate comparison reports

## Example User Flow

### Step 1: Add Reference
```
User: "I want to build a task management app"
System: "Have any similar projects in mind?"
User: Adds "https://github.com/todoist/todoist"
  Likes: "Clean UI, offline sync, keyboard shortcuts"
  Dislikes: "Complex pricing model"
  Emulate: "Offline-first architecture"
```

### Step 2: AI Uses Context
```
AI: "I see you like Todoist's offline-first approach. 
     Should your app also work completely offline, 
     or is occasional connectivity acceptable?"
```

### Step 3: Architecture Reflects Preferences
```
Option 1: Offline-First Architecture
- Uses IndexedDB for local storage (like Todoist)
- Service Workers for offline functionality
- Sync engine for conflict resolution
- Keyboard shortcuts library integrated

Justification: "This option directly addresses your 
preference for Todoist's offline capabilities while 
keeping the architecture simpler than their full 
implementation."
```

## Testing Strategy

### Unit Tests
- Reference project CRUD operations
- URL validation
- Metadata extraction

### Integration Tests
- AI prompt generation with references
- Architecture generation incorporating preferences
- Database operations

### E2E Tests
- Complete flow: add references → clarify → generate architecture
- Verify AI uses reference context
- Check justifications mention references

## Success Metrics

- **Adoption Rate**: % of users who add reference projects
- **Clarification Efficiency**: Fewer questions needed when references provided
- **Satisfaction**: Higher ratings for architectures with reference context
- **Relevance**: User feedback on how well references were incorporated

## Future Enhancements

1. **AI-Powered Project Discovery**: Suggest similar projects based on idea
2. **Automated Comparison**: Compare generated architecture with references
3. **Learning from Community**: Aggregate popular reference patterns
4. **Visual Comparison**: Side-by-side architecture diagrams
5. **Reference Templates**: Pre-filled examples for common project types

---

This feature significantly enhances the AI's ability to generate personalized, relevant architecture recommendations by learning from concrete examples the user provides.