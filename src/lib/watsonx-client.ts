import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { WatsonXConfig, WatsonXRequest, WatsonXResponse } from '@/types';
import { retryWithBackoff } from './utils';

// Configuration from environment variables
const config: WatsonXConfig = {
  apiKey: process.env.WATSONX_API_KEY || '',
  projectId: process.env.WATSONX_PROJECT_ID || '',
  url: process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com',
  version: '2024-03-14',
};

// Model IDs
export const MODELS = {
  GRANITE_13B_CHAT: 'ibm/granite-13b-chat-v2',
  GRANITE_20B_CODE: 'ibm/granite-20b-code-instruct-v2',
  LLAMA_3_70B: 'meta-llama/llama-3-70b-instruct',
  LLAMA_3_8B: 'meta-llama/llama-3-8b-instruct',
} as const;

// Default parameters for different use cases
export const PARAMETERS = {
  CONVERSATIONAL: {
    max_new_tokens: 500,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 50,
    repetition_penalty: 1.1,
  },
  TECHNICAL: {
    max_new_tokens: 1500,
    temperature: 0.3,
    top_p: 0.85,
    top_k: 40,
    repetition_penalty: 1.05,
  },
  CREATIVE: {
    max_new_tokens: 2000,
    temperature: 0.8,
    top_p: 0.95,
    top_k: 60,
    repetition_penalty: 1.0,
  },
  CODE: {
    max_new_tokens: 2000,
    temperature: 0.2,
    top_p: 0.8,
    top_k: 30,
    repetition_penalty: 1.0,
  },
} as const;

/**
 * Initialize watsonx.ai client
 */
let watsonxClient: WatsonXAI | null = null;

function getClient(): WatsonXAI {
  if (!watsonxClient) {
    if (!config.apiKey || !config.projectId) {
      throw new Error('watsonx.ai credentials not configured. Please set WATSONX_API_KEY and WATSONX_PROJECT_ID environment variables.');
    }

    watsonxClient = WatsonXAI.newInstance({
      version: config.version,
      serviceUrl: config.url,
    });

    watsonxClient.setServiceUrl(config.url);
  }

  return watsonxClient;
}

/**
 * Generate text using watsonx.ai
 */
export async function generateText(
  prompt: string,
  modelId: string = MODELS.GRANITE_13B_CHAT,
  parameters: any = PARAMETERS.CONVERSATIONAL
): Promise<string> {
  const client = getClient();

  const request = {
    modelId: modelId,
    input: prompt,
    parameters,
    projectId: config.projectId,
  };

  try {
    const response = await retryWithBackoff(async () => {
      const result = await client.generateText(request);
      return result;
    }, 3, 1000);

    if (response.result && response.result.results && response.result.results.length > 0) {
      return response.result.results[0].generated_text.trim();
    }

    throw new Error('No text generated from watsonx.ai');
  } catch (error) {
    console.error('watsonx.ai generation error:', error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate clarification questions
 */
export async function generateClarificationQuestion(
  projectDescription: string,
  skillLevel: string,
  previousQA: Array<{ question: string; answer: string }> = []
): Promise<string> {
  const qaHistory = previousQA.length > 0
    ? previousQA.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')
    : 'No previous questions asked yet.';

  const prompt = `You are an expert system architect helping to clarify project requirements.

Project Description: ${projectDescription}
User Skill Level: ${skillLevel}
Previous Q&A:
${qaHistory}

Based on the project description and previous answers, generate ONE specific, focused clarification question that will help understand the requirements better. The question should:
- Be clear and specific
- Help identify technical requirements, constraints, or user needs
- Be appropriate for a ${skillLevel} level developer
- Not repeat previous questions
- Focus on critical aspects like scalability, security, data flow, or user experience

Generate only the question, without any preamble or explanation:`;

  return await generateText(prompt, MODELS.GRANITE_13B_CHAT, PARAMETERS.CONVERSATIONAL);
}

/**
 * Generate requirements summary
 */
export async function generateRequirementsSummary(
  projectDescription: string,
  qaHistory: Array<{ question: string; answer: string }>
): Promise<{
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  constraints: string[];
  assumptions: string[];
  keyFeatures: string[];
}> {
  const qa = qaHistory.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n');

  const prompt = `Analyze the following project information and generate a structured requirements summary.

Project Description: ${projectDescription}

Q&A Session:
${qa}

Generate a JSON object with the following structure:
{
  "functionalRequirements": ["requirement 1", "requirement 2", ...],
  "nonFunctionalRequirements": ["requirement 1", "requirement 2", ...],
  "constraints": ["constraint 1", "constraint 2", ...],
  "assumptions": ["assumption 1", "assumption 2", ...],
  "keyFeatures": ["feature 1", "feature 2", ...]
}

Provide 3-5 items for each category. Be specific and technical. Return only valid JSON, no additional text.`;

  const response = await generateText(prompt, MODELS.LLAMA_3_70B, PARAMETERS.TECHNICAL);
  
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse requirements summary:', error);
    // Return default structure if parsing fails
    return {
      functionalRequirements: ['User authentication', 'Data storage', 'API endpoints'],
      nonFunctionalRequirements: ['Performance', 'Security', 'Scalability'],
      constraints: ['Budget limitations', 'Time constraints'],
      assumptions: ['Users have internet access', 'Modern browsers supported'],
      keyFeatures: ['Core functionality', 'User interface', 'Data management'],
    };
  }
}

/**
 * Generate architecture options
 */
export async function generateArchitectureOptions(
  projectDescription: string,
  requirements: any,
  skillLevel: string
): Promise<any[]> {
  const reqSummary = `
Functional: ${requirements.functionalRequirements.join(', ')}
Non-Functional: ${requirements.nonFunctionalRequirements.join(', ')}
Constraints: ${requirements.constraints.join(', ')}
Key Features: ${requirements.keyFeatures.join(', ')}
`;

  const prompt = `You are an expert system architect. Generate 3 distinct architecture options for the following project.

Project: ${projectDescription}
Requirements: ${reqSummary}
User Level: ${skillLevel}

For each option, provide:
1. A unique name (e.g., "Microservices Architecture", "Monolithic Architecture", "Serverless Architecture")
2. Brief description (2-3 sentences)
3. Detailed overview (1 paragraph)
4. Technology stack (frontend, backend, database, infrastructure)
5. 3-4 pros
6. 3-4 cons
7. Complexity level (low/medium/high)
8. Estimated cost (low/medium/high)

Return a JSON array with 3 options. Each option should have this structure:
{
  "name": "Architecture Name",
  "description": "Brief description",
  "overview": "Detailed overview paragraph",
  "techStack": {
    "frontend": ["tech1", "tech2"],
    "backend": ["tech1", "tech2"],
    "database": ["tech1"],
    "infrastructure": ["tech1", "tech2"]
  },
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2", "con3"],
  "complexity": "medium",
  "estimatedCost": "medium"
}

Return only valid JSON array, no additional text.`;

  const response = await generateText(prompt, MODELS.LLAMA_3_70B, {
    ...PARAMETERS.TECHNICAL,
    max_new_tokens: 3000,
  });

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse architecture options:', error);
    // Return default options if parsing fails
    return [
      {
        name: 'Monolithic Architecture',
        description: 'Traditional single-tier architecture',
        overview: 'A unified application where all components are tightly integrated.',
        techStack: {
          frontend: ['React', 'TypeScript'],
          backend: ['Node.js', 'Express'],
          database: ['PostgreSQL'],
          infrastructure: ['Docker', 'AWS EC2'],
        },
        pros: ['Simple to develop', 'Easy to deploy', 'Good for small teams'],
        cons: ['Hard to scale', 'Tight coupling', 'Single point of failure'],
        complexity: 'low',
        estimatedCost: 'low',
      },
    ];
  }
}

/**
 * Generate Mermaid diagram
 */
export async function generateMermaidDiagram(
  architectureName: string,
  components: string[],
  description: string
): Promise<string> {
  const prompt = `Generate a Mermaid diagram for the following system architecture.

Architecture: ${architectureName}
Description: ${description}
Components: ${components.join(', ')}

Create a clear, well-structured Mermaid diagram using the 'graph TB' (top-bottom) format.
Include:
- All major components
- Connections between components
- Subgraphs for logical grouping
- Clear labels

Return ONLY the Mermaid code, starting with 'graph TB' and nothing else. No markdown code blocks, no explanations.`;

  const diagram = await generateText(prompt, MODELS.GRANITE_20B_CODE, PARAMETERS.CODE);
  
  // Clean up the response to ensure it's valid Mermaid
  let cleaned = diagram.trim();
  
  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '');
  
  // Ensure it starts with graph TB
  if (!cleaned.startsWith('graph TB') && !cleaned.startsWith('graph TD')) {
    cleaned = 'graph TB\n' + cleaned;
  }
  
  return cleaned;
}

/**
 * Generate component breakdown
 */
export async function generateComponentBreakdown(
  architectureName: string,
  techStack: any,
  overview: string
): Promise<any[]> {
  const prompt = `Generate a detailed component breakdown for this architecture.

Architecture: ${architectureName}
Overview: ${overview}
Tech Stack: ${JSON.stringify(techStack)}

Generate 5-8 components with the following structure for each:
{
  "name": "Component Name",
  "type": "frontend|backend|database|service|infrastructure",
  "description": "What this component does",
  "responsibilities": ["responsibility1", "responsibility2"],
  "technologies": ["tech1", "tech2"],
  "dependencies": ["component1", "component2"]
}

Return a JSON array of components. Return only valid JSON, no additional text.`;

  const response = await generateText(prompt, MODELS.LLAMA_3_70B, {
    ...PARAMETERS.TECHNICAL,
    max_new_tokens: 2500,
  });

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse component breakdown:', error);
    return [];
  }
}

/**
 * Generate justifications
 */
export async function generateJustifications(
  architectureName: string,
  techStack: any,
  requirements: any
): Promise<any[]> {
  const prompt = `Generate technical justifications for architecture decisions.

Architecture: ${architectureName}
Tech Stack: ${JSON.stringify(techStack)}
Requirements: ${JSON.stringify(requirements)}

Generate 4-6 justifications covering:
- Technology choices
- Architecture patterns
- Infrastructure decisions
- Security considerations
- Performance optimizations

Each justification should have:
{
  "category": "technology|pattern|infrastructure|security|performance",
  "decision": "What was decided",
  "reasoning": "Why this decision was made",
  "alternatives": [
    {
      "name": "Alternative option",
      "description": "What it is",
      "whyNotChosen": "Why we didn't choose it"
    }
  ],
  "tradeoffs": [
    {
      "aspect": "What aspect",
      "benefit": "The benefit",
      "cost": "The cost/tradeoff"
    }
  ]
}

Return a JSON array. Return only valid JSON, no additional text.`;

  const response = await generateText(prompt, MODELS.LLAMA_3_70B, {
    ...PARAMETERS.TECHNICAL,
    max_new_tokens: 3000,
  });

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse justifications:', error);
    return [];
  }
}

/**
 * Test watsonx.ai connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await generateText('Hello, this is a test.', MODELS.GRANITE_13B_CHAT, {
      max_new_tokens: 50,
      temperature: 0.7,
    });
    return response.length > 0;
  } catch (error) {
    console.error('watsonx.ai connection test failed:', error);
    return false;
  }
}

/**
 * Get available models
 */
export function getAvailableModels() {
  return Object.entries(MODELS).map(([key, value]) => ({
    id: value,
    name: key.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' '),
  }));
}

// Made with Bob
