import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication';
import { extractMermaidNodeLabels, normalizeMermaidDiagram, normalizeMermaidLabel } from '@/lib/mermaid';
import { RequirementsSummary, SkillLevel, TechStack, WatsonXConfig, WatsonXRequest, WatsonXResponse } from '@/types';
import { retryWithBackoff } from './utils';

// Configuration from environment variables
const config: WatsonXConfig = {
  apiKey: process.env.WATSONX_API_KEY || '',
  projectId: process.env.WATSONX_PROJECT_ID || '',
  url: process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com',
  version: '2024-03-14',
};

// Model IDs - Updated to current watsonx.ai models
export const MODELS = {
  GRANITE_8B_INSTRUCT: 'ibm/granite-3-8b-instruct',
  GRANITE_13B_INSTRUCT: 'ibm/granite-13b-instruct-v2',
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

type ClarificationQA = { question: string; answer: string };
type ProjectDomainId = 'generic' | 'pipeline' | 'bioinformatics' | 'etl' | 'ml';

interface DomainTopic {
  label: string;
  aliases: string[];
}

interface DomainPreset {
  id: ProjectDomainId;
  label: string;
  triggerKeywords: string[];
  clarificationQuestionLimit: number;
  minimumAnswersBeforeEarlyStop: number;
  clarificationFocus: string[];
  requirementFocus: string[];
  architectureAnchors: string[];
  recommendedStackCategories: string[];
  topics: DomainTopic[];
}

const DEFAULT_TEXT_MODEL = MODELS.GRANITE_8B_INSTRUCT;
const DEFAULT_CODE_MODEL = MODELS.GRANITE_8B_INSTRUCT;

interface MermaidGenerationInput {
  architectureName: string;
  description: string;
  overview?: string;
  techStack?: TechStack;
  components?: string[];
  requirements?: RequirementsSummary;
  skillLevel?: SkillLevel;
}

interface DiagramCoverageAssessment {
  score: number;
  missingExpectedLabels: string[];
}

const DOMAIN_PRESETS: DomainPreset[] = [
  {
    id: 'bioinformatics',
    label: 'Bioinformatics Pipeline',
    triggerKeywords: ['bioinformatics', 'genomics', 'proteomics', 'rna-seq', 'rnaseq', 'fastq', 'bam', 'vcf', 'alignment', 'variant calling'],
    clarificationQuestionLimit: 5,
    minimumAnswersBeforeEarlyStop: 3,
    clarificationFocus: [
      'input data size and sample volume',
      'workflow engine or orchestration preference',
      'reproducibility, provenance, and versioning expectations',
      'compute environment such as cloud, Kubernetes, or HPC',
      'downstream outputs, reports, or systems consuming results',
    ],
    requirementFocus: [
      'data volume, throughput, and storage layout',
      'reproducible execution and environment pinning',
      'reference data and tool version management',
      'batch scheduling, parallelism, and compute environment constraints',
      'result artifacts, downstream delivery, and auditability',
    ],
    architectureAnchors: [
      'Nextflow-based workflow platform',
      'Snakemake-driven reproducible pipeline',
      'Cromwell/WDL workflow execution',
      'Kubernetes jobs for scalable batch execution',
      'HPC scheduler integration such as Slurm when cluster execution is required',
    ],
    recommendedStackCategories: ['workflow', 'compute', 'storage', 'bioinformatics_tools', 'observability', 'security'],
    topics: [
      { label: 'data size and throughput', aliases: ['data size', 'dataset size', 'throughput', 'sample volume', 'sample count', 'fastq', 'bam', 'vcf', 'terabyte', 'gigabyte'] },
      { label: 'workflow engine', aliases: ['workflow engine', 'orchestration', 'nextflow', 'snakemake', 'cromwell', 'wdl', 'airflow'] },
      { label: 'reproducibility requirements', aliases: ['reproducibility', 'provenance', 'versioning', 'traceability', 'deterministic', 'audit trail'] },
      { label: 'compute environment', aliases: ['compute environment', 'hpc', 'slurm', 'cluster', 'gpu', 'cpu', 'kubernetes', 'cloud', 'on-prem'] },
      { label: 'downstream outputs', aliases: ['output', 'downstream', 'report', 'reporting', 'consumer', 'results delivery', 'notebook', 'dashboard', 'export'] },
    ],
  },
  {
    id: 'etl',
    label: 'ETL / Data Pipeline',
    triggerKeywords: ['etl', 'elt', 'data pipeline', 'data ingestion', 'data warehouse', 'data lake', 'transformation pipeline'],
    clarificationQuestionLimit: 5,
    minimumAnswersBeforeEarlyStop: 3,
    clarificationFocus: [
      'source systems and ingestion pattern',
      'data volume, batch frequency, or streaming expectations',
      'orchestration or scheduler needs',
      'data quality, lineage, and reproducibility expectations',
      'downstream analytics, warehouse, or API consumers',
    ],
    requirementFocus: [
      'source and destination systems',
      'latency, throughput, and backfill requirements',
      'lineage, retry, and observability requirements',
      'compute and storage layout',
      'serving and downstream consumption patterns',
    ],
    architectureAnchors: [
      'Airflow-orchestrated ETL platform',
      'Kubernetes job-based batch processing',
      'Managed workflow orchestration with containerized transforms',
      'Warehouse-centric ELT architecture',
    ],
    recommendedStackCategories: ['workflow', 'compute', 'storage', 'analytics', 'integrations', 'observability'],
    topics: [
      { label: 'data size and frequency', aliases: ['data size', 'volume', 'batch', 'streaming', 'throughput', 'frequency', 'daily', 'hourly', 'backfill'] },
      { label: 'workflow engine', aliases: ['workflow engine', 'orchestration', 'airflow', 'dag', 'scheduler', 'kubernetes jobs'] },
      { label: 'reproducibility and lineage', aliases: ['reproducibility', 'lineage', 'versioning', 'provenance', 'audit', 'data quality'] },
      { label: 'compute environment', aliases: ['compute', 'kubernetes', 'spark', 'cloud', 'on-prem', 'cluster'] },
      { label: 'downstream outputs', aliases: ['warehouse', 'dashboard', 'bi', 'api', 'consumer', 'report', 'export'] },
    ],
  },
  {
    id: 'ml',
    label: 'ML Workflow',
    triggerKeywords: ['machine learning', 'ml pipeline', 'model training', 'feature pipeline', 'inference pipeline', 'mlops', 'training job'],
    clarificationQuestionLimit: 5,
    minimumAnswersBeforeEarlyStop: 3,
    clarificationFocus: [
      'training and inference data size',
      'pipeline orchestration or experiment workflow needs',
      'reproducibility and model/version tracking expectations',
      'compute environment such as GPU, Kubernetes, or managed training',
      'downstream consumers such as batch scoring, APIs, or dashboards',
    ],
    requirementFocus: [
      'training, validation, and inference flow',
      'experiment tracking and reproducibility',
      'compute requirements and scaling model',
      'feature, model, and artifact storage',
      'serving and downstream integration requirements',
    ],
    architectureAnchors: [
      'Kubeflow-style ML workflow orchestration',
      'Airflow-orchestrated training and batch inference',
      'Kubernetes job pipeline with experiment tracking',
      'Hybrid batch training and service-based inference architecture',
    ],
    recommendedStackCategories: ['workflow', 'compute', 'storage', 'ml_ops', 'observability', 'integrations'],
    topics: [
      { label: 'data size and throughput', aliases: ['dataset size', 'training data', 'inference volume', 'throughput', 'batch size', 'latency'] },
      { label: 'workflow engine', aliases: ['orchestration', 'airflow', 'kubeflow', 'pipeline engine', 'workflow'] },
      { label: 'reproducibility and tracking', aliases: ['reproducibility', 'experiment tracking', 'model registry', 'versioning', 'provenance'] },
      { label: 'compute environment', aliases: ['gpu', 'cpu', 'kubernetes', 'cloud', 'cluster', 'distributed training'] },
      { label: 'downstream outputs', aliases: ['serving', 'batch scoring', 'api', 'dashboard', 'consumer', 'report'] },
    ],
  },
  {
    id: 'pipeline',
    label: 'General Pipeline / Workflow',
    triggerKeywords: ['pipeline', 'workflow', 'batch processing', 'job orchestration', 'scheduler'],
    clarificationQuestionLimit: 4,
    minimumAnswersBeforeEarlyStop: 3,
    clarificationFocus: [
      'data size or workload volume',
      'workflow orchestration needs',
      'reproducibility and rerun expectations',
      'compute environment',
      'downstream outputs or consuming systems',
    ],
    requirementFocus: [
      'stage boundaries and dependencies',
      'orchestration and retry requirements',
      'execution environment and scaling constraints',
      'artifact storage and traceability',
      'output delivery requirements',
    ],
    architectureAnchors: [
      'Workflow-engine-based pipeline',
      'Containerized Kubernetes job pipeline',
      'Scheduler-driven batch processing architecture',
      'HPC-compatible staged execution when needed',
    ],
    recommendedStackCategories: ['workflow', 'compute', 'storage', 'integrations', 'observability'],
    topics: [
      { label: 'data size and workload volume', aliases: ['data size', 'volume', 'throughput', 'job size', 'batch'] },
      { label: 'workflow engine', aliases: ['workflow', 'orchestration', 'scheduler', 'dag', 'nextflow', 'airflow', 'snakemake'] },
      { label: 'reproducibility requirements', aliases: ['reproducibility', 'rerun', 'versioning', 'provenance', 'audit'] },
      { label: 'compute environment', aliases: ['compute', 'cluster', 'kubernetes', 'cloud', 'on-prem', 'hpc'] },
      { label: 'downstream outputs', aliases: ['output', 'consumer', 'report', 'dashboard', 'api', 'export'] },
    ],
  },
  {
    id: 'generic',
    label: 'Generic Product / Application',
    triggerKeywords: [],
    clarificationQuestionLimit: 3,
    minimumAnswersBeforeEarlyStop: 2,
    clarificationFocus: [
      'target platform',
      'main users and workflows',
      'key integrations or constraints',
      'rough scale expectations',
    ],
    requirementFocus: [
      'core user workflows',
      'platform and integration requirements',
      'security and operational constraints',
      'scalability expectations',
    ],
    architectureAnchors: [
      'Monolithic application',
      'Modular service-based application',
      'Serverless application where appropriate',
    ],
    recommendedStackCategories: ['frontend', 'backend', 'database', 'infrastructure', 'tools'],
    topics: [],
  },
];

function toSearchableText(projectDescription: string, qaHistory: ClarificationQA[] = []): string {
  const qaText = qaHistory.map((entry) => `${entry.question} ${entry.answer}`).join(' ');
  return `${projectDescription} ${qaText}`.toLowerCase();
}

function detectProjectDomain(projectDescription: string, qaHistory: ClarificationQA[] = []): DomainPreset {
  const text = toSearchableText(projectDescription, qaHistory);

  for (const preset of DOMAIN_PRESETS) {
    if (preset.id === 'generic') {
      continue;
    }

    if (preset.triggerKeywords.some((keyword) => text.includes(keyword))) {
      return preset;
    }
  }

  return DOMAIN_PRESETS.find((preset) => preset.id === 'generic')!;
}

function getUnresolvedDomainTopics(projectDescription: string, qaHistory: ClarificationQA[] = []): string[] {
  const preset = detectProjectDomain(projectDescription, qaHistory);
  if (preset.id === 'generic') {
    return [];
  }

  const text = toSearchableText(projectDescription, qaHistory);

  return preset.topics
    .filter((topic) => !topic.aliases.some((alias) => text.includes(alias)))
    .map((topic) => topic.label);
}

function formatDomainGuidance(projectDescription: string, qaHistory: ClarificationQA[] = []): string {
  const preset = detectProjectDomain(projectDescription, qaHistory);
  if (preset.id === 'generic') {
    return 'No special domain branch detected. Use the normal product clarification flow.';
  }

  const unresolvedTopics = getUnresolvedDomainTopics(projectDescription, qaHistory);
  const prioritizedTopics = unresolvedTopics.length > 0 ? unresolvedTopics : preset.clarificationFocus;

  return `Detected domain: ${preset.label}
Domain-specific clarification priorities:
${prioritizedTopics.map((topic) => `- ${topic}`).join('\n')}

Architecture preset anchors to keep in mind when helpful:
${preset.architectureAnchors.map((anchor) => `- ${anchor}`).join('\n')}`;
}

function formatDomainRequirementGuidance(projectDescription: string, qaHistory: ClarificationQA[] = []): string {
  const preset = detectProjectDomain(projectDescription, qaHistory);

  return `Detected domain: ${preset.label}
Capture these requirements explicitly when the dialog provides them:
${preset.requirementFocus.map((item) => `- ${item}`).join('\n')}`;
}

function formatDomainPresetGuidance(projectDescription: string, qaHistory: ClarificationQA[] = []): string {
  const preset = detectProjectDomain(projectDescription, qaHistory);

  return `Detected domain: ${preset.label}
Architecture anchors that are appropriate when the requirements support them:
${preset.architectureAnchors.map((anchor) => `- ${anchor}`).join('\n')}

Relevant tech stack categories for this domain:
${preset.recommendedStackCategories.map((category) => `- ${category}`).join('\n')}`;
}

export function getClarificationStrategy(projectDescription: string, qaHistory: ClarificationQA[] = []) {
  const preset = detectProjectDomain(projectDescription, qaHistory);

  return {
    domainId: preset.id,
    domainLabel: preset.label,
    maxQuestions: preset.clarificationQuestionLimit,
    minimumAnswersBeforeEarlyStop: preset.minimumAnswersBeforeEarlyStop,
  };
}

function getExplanationStyleGuidance(skillLevel: SkillLevel): string {
  switch (skillLevel) {
    case 'beginner':
      return `Explain decisions in very plain language for a non-technical audience.
- Spell out abbreviations the first time you use them.
- Briefly explain what each major technology does and why it exists in the system.
- Prefer concrete examples over jargon.
- Make tradeoffs explicit in simple everyday language.`;
    case 'advanced':
      return `Explain decisions for an expert audience.
- Be concise and direct.
- Use standard industry abbreviations naturally.
- Assume familiarity with architecture patterns, cloud services, and tradeoff analysis.
- Focus on the key rationale, constraints, and implications instead of introductory teaching.`;
    default:
      return `Explain decisions in very plain language for a non-technical audience.
- Spell out abbreviations the first time you use them.
- Briefly explain what each major technology does and why it exists in the system.
- Prefer concrete examples over jargon.
- Make tradeoffs explicit in simple everyday language.`;
  }
}

  /**
 * Initialize watsonx.ai client
 */
let watsonxClient: WatsonXAI | null = null;

function getClient(): WatsonXAI {
  if (!watsonxClient) {
    if (!config.apiKey || !config.projectId) {
      throw new Error('watsonx.ai credentials not configured. Please set WATSONX_API_KEY and WATSONX_PROJECT_ID environment variables.');
    }

    // Create IAM authenticator explicitly
    const authenticator = new IamAuthenticator({
      apikey: config.apiKey,
    });

    watsonxClient = WatsonXAI.newInstance({
      version: config.version,
      serviceUrl: config.url,
      authenticator: authenticator,
    });
  }

  return watsonxClient;
}

/**
 * Generate text using watsonx.ai
 */
export async function generateText(
  prompt: string,
  modelId: string = DEFAULT_TEXT_MODEL,
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
  previousQA: Array<{ question: string; answer: string }> = [],
  excludedQuestions: string[] = []
): Promise<string> {
  const domainGuidance = formatDomainGuidance(projectDescription, previousQA);
  const qaHistory = previousQA.length > 0
    ? previousQA.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')
    : 'No previous questions asked yet.';
  const latestExchange = previousQA.length > 0
    ? previousQA[previousQA.length - 1]
    : null;
  const excludedQuestionList = excludedQuestions.length > 0
    ? excludedQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')
    : 'None.';

  const prompt = `You are an expert system architect having a brief clarification dialog before suggesting implementation design options.

Project Description: ${projectDescription}
User Skill Level: ${skillLevel}
Previous Q&A:
${qaHistory}

Latest answered question: ${latestExchange?.question ?? 'None yet.'}
Latest answer: ${latestExchange?.answer ?? 'None yet.'}

Questions that are already resolved or must not be repeated:
${excludedQuestionList}

Domain Guidance:
${domainGuidance}

Based on the project description and previous answers, generate ONE brief, focused clarification message that will help you understand enough to suggest implementation design options. The message should:
- Ask exactly one question only
- Be the single most important unresolved question for making the system design better
- Feel like a short back-and-forth dialog, not a formal questionnaire
- Stay brief: one sentence when possible, two short sentences at most
- Focus only on product functionality, target platform or delivery surface, user roles and workflows, key integrations, business or compliance constraints, and rough scale or concurrency expectations
- Prioritize clarifying the target platform early when it is still unclear, such as whether this should be a web app, mobile app, desktop app, API, chatbot, internal tool, or something else
- If the detected domain is a pipeline, bioinformatics workflow, ETL flow, or ML workflow, prioritize unresolved questions about data size, workflow engine, reproducibility, compute environment, and downstream outputs before generic app questions
- For domain workflows, the delivery surface can be a workflow engine, CLI, scheduled job system, notebook flow, internal platform, API, or dashboard, not just web or mobile
- Never ask the user to choose implementation details such as backend approach, database or storage solution, cloud provider, hosting model, API style, frameworks, or vendor products
- Avoid low-value or cosmetic questions such as naming, branding, visual style, or generic product brainstorming
- Be clear and specific
- Help identify technical requirements, constraints, or user needs
- Be appropriate for a ${skillLevel} level developer
- Not repeat or paraphrase previous questions
- Treat the latest answer as useful information, not something to ignore
- If the latest answer was partial, ask only for the missing detail and explicitly move the conversation forward
- Never ask for the same information again using slightly different wording
- If the user says things like "decide yourself", "use best practices", "I don't know", "show me options later", or "give me options with justifications", accept that as a valid preference and move to a different unresolved design question instead of pushing for the same decision
- Treat "I don't know" as uncertainty about that decision, not refusal to continue; either ask a different high-value question or leave that choice open for architecture tradeoffs later
- If enough detail is already known in that area, move on to another important gap
- If the latest user answer contains a direct question for you, answer it briefly in one short sentence first, then ask one short clarifying question only if it is still absolutely necessary

Generate only the message text, without any preamble or explanation:`;

  return await generateText(prompt, DEFAULT_TEXT_MODEL, PARAMETERS.CONVERSATIONAL);
}

export async function hasEnoughClarificationForDesign(
  projectDescription: string,
  qaHistory: Array<{ question: string; answer: string }>
): Promise<boolean> {
  if (qaHistory.length === 0) {
    return false;
  }

  const preset = detectProjectDomain(projectDescription, qaHistory);
  const unresolvedDomainTopics = getUnresolvedDomainTopics(projectDescription, qaHistory);

  if (preset.id !== 'generic' && qaHistory.length < preset.minimumAnswersBeforeEarlyStop) {
    return false;
  }

  if (preset.id !== 'generic' && unresolvedDomainTopics.length >= 3) {
    return false;
  }

  const qa = qaHistory.map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`).join('\n\n');

  const prompt = `You are deciding whether there is already enough clarified product context to start suggesting architecture and implementation design options.

Project Description: ${projectDescription}

Clarification Dialog:
${qa}

Domain Guidance:
${formatDomainGuidance(projectDescription, qaHistory)}

Return JSON only in this format:
{
  "hasEnoughInformation": true or false
}

Use true only if the dialog already covers the minimum needed to propose architecture options responsibly:
- the core product purpose or main workflows are clear
- the target platform or delivery surface is clear enough, such as web, mobile, desktop, API, chatbot, internal tool, or multi-platform
- the main users or actors are reasonably clear
- any important integrations, compliance constraints, or operational constraints are known if relevant
- rough scale or concurrency expectations are known, or it is reasonable to leave scale open and present options

If the detected domain is a pipeline, bioinformatics workflow, ETL system, or ML workflow, prefer false unless the dialog is also reasonably clear about most of these when relevant:
- data size or workload volume
- workflow engine or orchestration expectations
- reproducibility, provenance, or versioning expectations
- compute environment such as cloud, Kubernetes, or HPC
- downstream outputs or consuming systems

Use true when the user explicitly delegates implementation choices with phrases like "decide yourself", "use best practices", "show me options later", or "show me options with justifications" and the remaining essentials are otherwise clear enough.
Treat "I don't know" as acceptable uncertainty about one area, but not as blanket completeness unless the other essentials are already clear.
Use false if another short clarification question is still truly necessary.

Return only valid JSON.`;

  const response = await generateText(prompt, DEFAULT_TEXT_MODEL, PARAMETERS.TECHNICAL);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return false;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { hasEnoughInformation?: boolean };
    return parsed.hasEnoughInformation === true;
  } catch (error) {
    console.error('Failed to parse clarification sufficiency check:', error);
    return false;
  }
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
  const domainRequirementGuidance = formatDomainRequirementGuidance(projectDescription, qaHistory);

  const prompt = `Analyze the following project information and generate a structured requirements summary for implementation design.

Project Description: ${projectDescription}

Q&A Session:
${qa}

Domain Guidance:
${domainRequirementGuidance}

If the user answered with phrases like "decide yourself", "use best practices", "I don't know", "show me options later", or "show options with justifications", treat that as a valid instruction to leave room for architecture options rather than as missing information. Capture those answers as assumptions, deferred decisions, or design flexibility, not as unanswered gaps.
When the user says "I don't know", record the specific area as intentionally undecided so the architecture options can cover sensible alternatives.
If the detected domain is a pipeline, bioinformatics workflow, ETL system, or ML workflow, explicitly capture data size, workflow orchestration, reproducibility, compute environment, and downstream outputs whenever the dialog gives enough signal.

Generate a JSON object with the following structure:
{
  "functionalRequirements": ["requirement 1", "requirement 2", ...],
  "nonFunctionalRequirements": ["requirement 1", "requirement 2", ...],
  "constraints": ["constraint 1", "constraint 2", ...],
  "assumptions": ["assumption 1", "assumption 2", ...],
  "keyFeatures": ["feature 1", "feature 2", ...]
}

Provide 3-5 items for each category. Be specific and technical. Return only valid JSON, no additional text.`;

  const response = await generateText(prompt, DEFAULT_TEXT_MODEL, PARAMETERS.TECHNICAL);
  
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
  const explanationStyleGuidance = getExplanationStyleGuidance(skillLevel as SkillLevel);
  const domainPresetGuidance = formatDomainPresetGuidance(projectDescription);
  const reqSummary = `
Functional: ${requirements.functionalRequirements.join(', ')}
Non-Functional: ${requirements.nonFunctionalRequirements.join(', ')}
Constraints: ${requirements.constraints.join(', ')}
Assumptions: ${requirements.assumptions.join(', ')}
Key Features: ${requirements.keyFeatures.join(', ')}
`;

  const prompt = `You are an expert system architect. Generate 3 distinct architecture options for the following project.

Project: ${projectDescription}
Requirements: ${reqSummary}
User Level: ${skillLevel}
Explanation Style:
${explanationStyleGuidance}
Domain Preset Guidance:
${domainPresetGuidance}

First, infer what kind of system this is. It may be a web app, mobile app, desktop app, API product, internal tool, data pipeline, bioinformatics workflow, ETL system, analytics platform, ML workflow, batch processing system, scientific computing workflow, or something else.
Do not force the project into a generic web-application shape if the request points to a pipeline, scientific workflow, or other non-app system.
Choose architecture patterns and technologies that actually fit the domain.
Treat this as a best-effort architecture review, not a brainstorming exercise. The options must be credible implementation candidates for this exact project.

For each option, provide:
1. A unique name that fits the project type (for example, web-app patterns for apps, or workflow/pipeline/platform patterns for data and scientific systems)
2. Brief description (2-3 sentences)
3. Detailed overview (1 paragraph) that clearly explains why this option fits the project goals, constraints, and likely usage pattern
4. Technology stack as a JSON object with only the categories that make sense for this project. Common categories include frontend, backend, database, infrastructure, orchestration, workflow, compute, storage, analytics, bioinformatics_tools, observability, security, integrations, and tools.
5. 3-4 pros
6. 3-4 cons
7. Complexity level (low/medium/high)
8. Estimated cost (low/medium/high)

If this is a pipeline or scientific workflow, prefer architecture options such as orchestrated batch pipelines, workflow-engine-based systems, reproducible containerized compute pipelines, HPC-compatible execution, or hybrid cloud processing where appropriate.
For bioinformatics specifically, pay attention to data volumes, reproducibility, workflow orchestration, storage layout, compute environment, reference data management, and integration with domain tools.
The 3 options should be meaningfully different in tradeoffs, for example one optimized for simplicity, one for scale/flexibility, and one for operational rigor or reproducibility when that distinction makes sense.
Avoid generic filler. Pros and cons must be specific to this project rather than broad statements that apply to almost any architecture.
If the requirements include assumptions or deferred decisions such as "use best practices", "I don't know", or "show me options later", treat those as explicit user guidance. Reflect them by keeping unresolved choices open, surfacing sensible alternatives across the 3 options, and calling out where an option makes a default best-practice choice versus where it preserves flexibility.

Return a JSON array with 3 options. Each option should have this structure:
{
  "name": "Architecture Name",
  "description": "Brief description",
  "overview": "Detailed overview paragraph",
  "techStack": {
    "category1": ["tech1", "tech2"],
    "category2": ["tech1"],
    "category3": ["tech1", "tech2"]
  },
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2", "con3"],
  "complexity": "medium",
  "estimatedCost": "medium"
}

The "description", "overview", "pros", and "cons" fields must match the requested explanation style for a ${skillLevel} user.
Do not include irrelevant categories such as frontend if the system does not need one.

Return only valid JSON array, no additional text.`;

  const response = await generateText(prompt, DEFAULT_TEXT_MODEL, {
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
        name: 'Baseline Domain-Fit Architecture',
        description: 'A conservative architecture shaped around the project domain and its main processing flow.',
        overview: 'This option centers the core workflow described in the project requirements and keeps the system structure simple enough to evolve after the first implementation pass.',
        techStack: {
          tools: ['Select domain-specific technologies based on the project requirements'],
          infrastructure: ['Containerized runtime', 'Managed storage', 'Observability'],
        },
        pros: ['Stays close to the stated requirements', 'Lower implementation risk', 'Can be specialized once constraints are clearer'],
        cons: ['Less tailored than a strong model-generated option', 'May need refinement for domain-specific edge cases', 'Uses a safe fallback when AI output is malformed'],
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
  input: MermaidGenerationInput
): Promise<string> {
  const expectedLabels = extractExpectedDiagramLabels(input);
  const blueprint = buildDiagramBlueprint(input);
  const prompt = `Generate a Mermaid diagram for the following system architecture.

Architecture: ${input.architectureName}
Description: ${input.description}
Overview: ${input.overview ?? input.description}
Audience Skill Level: ${input.skillLevel ?? 'beginner'}
Tech Stack: ${JSON.stringify(input.techStack ?? {})}
Expected Blocks: ${expectedLabels.join(', ')}
Requirements Summary: ${formatDiagramRequirements(input.requirements)}

Blueprint:
${blueprint}

Create a clear Mermaid graph using 'graph TB'.
Rules:
- Include the major blocks listed in Expected Blocks unless a block would be a duplicate label.
- Use exact or near-exact labels from the expected blocks. Do not invent unrelated technologies or placeholders.
- Group related blocks with subgraphs when that improves readability.
- Show the main flow between user-facing, application, data, workflow, compute, and platform blocks when those layers exist.
- Keep node labels single-line.
- Prefer one node per major block instead of many tiny implementation details.
- Return valid Mermaid only. No markdown fences. No explanations.

Return ONLY the Mermaid code, starting with 'graph TB' and nothing else.`;

  const diagram = await generateText(prompt, DEFAULT_CODE_MODEL, PARAMETERS.CODE);
  let cleaned = finalizeGeneratedDiagram(diagram);
  let coverage = assessDiagramCoverage(cleaned, expectedLabels);

  if (coverage.score < 0.6 && coverage.missingExpectedLabels.length > 0) {
    const repairPrompt = `Repair this Mermaid diagram so it better reflects the intended architecture.

Architecture: ${input.architectureName}
Overview: ${input.overview ?? input.description}
Expected Blocks: ${expectedLabels.join(', ')}
Missing Blocks That Must Be Reflected: ${coverage.missingExpectedLabels.join(', ')}

Current Mermaid:
${cleaned}

Requirements:
- Keep graph TB format.
- Preserve any accurate structure already present.
- Add or rename blocks so the missing expected blocks are represented.
- Do not add unrelated services or technologies.
- Return only Mermaid code.`;

    const repairedDiagram = await generateText(repairPrompt, DEFAULT_CODE_MODEL, PARAMETERS.CODE);
    cleaned = finalizeGeneratedDiagram(repairedDiagram);
    coverage = assessDiagramCoverage(cleaned, expectedLabels);
  }

  if (coverage.score < 0.45) {
    return buildFallbackMermaidDiagram(input);
  }

  return cleaned;
}

function finalizeGeneratedDiagram(diagram: string): string {
  let cleaned = normalizeMermaidDiagram(diagram);

  if (!cleaned.startsWith('graph TB') && !cleaned.startsWith('graph TD')) {
    cleaned = `graph TB\n${cleaned}`;
  }

  return cleaned;
}

function formatDiagramRequirements(requirements?: RequirementsSummary): string {
  if (!requirements) {
    return 'Not provided';
  }

  return [
    `Functional: ${requirements.functionalRequirements.join(', ') || 'None'}`,
    `Non-Functional: ${requirements.nonFunctionalRequirements.join(', ') || 'None'}`,
    `Constraints: ${requirements.constraints.join(', ') || 'None'}`,
    `Assumptions: ${requirements.assumptions.join(', ') || 'None'}`,
    `Key Features: ${requirements.keyFeatures.join(', ') || 'None'}`,
  ].join('\n');
}

function buildDiagramBlueprint(input: MermaidGenerationInput): string {
  const groupedEntries = Object.entries(input.techStack ?? {})
    .filter(([, values]) => Array.isArray(values) && values.length > 0)
    .map(([category, values]) => `${humanizeCategory(category)}: ${(values ?? []).join(', ')}`);

  if (groupedEntries.length === 0 && (input.components?.length ?? 0) > 0) {
    return `Core blocks: ${input.components?.join(', ')}`;
  }

  return groupedEntries.join('\n');
}

function humanizeCategory(category: string): string {
  return category
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractExpectedDiagramLabels(input: MermaidGenerationInput): string[] {
  const techStackLabels = Object.values(input.techStack ?? {})
    .filter((value): value is string[] => Array.isArray(value))
    .flat();

  return dedupeStrings([
    ...(input.components ?? []),
    ...techStackLabels,
  ]).slice(0, 14);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      continue;
    }

    const normalizedValue = normalizeMermaidLabel(trimmedValue);
    if (seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    result.push(trimmedValue);
  }

  return result;
}

function extractRenderedDiagramLabels(code: string): string[] {
  return dedupeStrings(extractMermaidNodeLabels(code));
}

function assessDiagramCoverage(code: string, expectedLabels: string[]): DiagramCoverageAssessment {
  if (expectedLabels.length === 0) {
    return {
      score: 1,
      missingExpectedLabels: [],
    };
  }

  const renderedLabels = extractRenderedDiagramLabels(code).map(normalizeMermaidLabel);
  const missingExpectedLabels = expectedLabels.filter((expectedLabel) => {
    const normalizedExpected = normalizeMermaidLabel(expectedLabel);
    return !renderedLabels.some((renderedLabel) => renderedLabel.includes(normalizedExpected) || normalizedExpected.includes(renderedLabel));
  });

  return {
    score: (expectedLabels.length - missingExpectedLabels.length) / expectedLabels.length,
    missingExpectedLabels,
  };
}

function buildFallbackMermaidDiagram(input: MermaidGenerationInput): string {
  const groupedTechStack = Object.entries(input.techStack ?? {})
    .filter(([, values]) => Array.isArray(values) && values.length > 0) as Array<[string, string[]]>;
  const fallbackGroups: Array<[string, string[]]> = groupedTechStack.length > 0
    ? groupedTechStack
    : [['system', dedupeStrings(input.components ?? []).slice(0, 8)]];
  const lines: string[] = ['graph TB'];
  const anchorId = sanitizeDiagramNodeId(input.architectureName || 'architecture');
  const groupAnchors: string[] = [];

  lines.push(`${anchorId}["${escapeDiagramLabel(input.architectureName)}"]`);

  fallbackGroups.forEach(([category, items], categoryIndex) => {
    const subgraphId = `${sanitizeDiagramNodeId(category)}_group_${categoryIndex}`;
    const firstNodeId = `${sanitizeDiagramNodeId(category)}_${categoryIndex}_0`;
    groupAnchors.push(firstNodeId);

    lines.push(`subgraph ${subgraphId}["${escapeDiagramLabel(humanizeCategory(category))}"]`);

    items.forEach((item, itemIndex) => {
      const nodeId = `${sanitizeDiagramNodeId(category)}_${categoryIndex}_${itemIndex}`;
      lines.push(`  ${nodeId}["${escapeDiagramLabel(item)}"]`);

      if (itemIndex > 0) {
        const previousNodeId = `${sanitizeDiagramNodeId(category)}_${categoryIndex}_${itemIndex - 1}`;
        lines.push(`  ${previousNodeId} --> ${nodeId}`);
      }
    });

    lines.push('end');
  });

  if (groupAnchors.length > 0) {
    lines.push(`${anchorId} --> ${groupAnchors[0]}`);
  }

  for (let index = 0; index < groupAnchors.length - 1; index += 1) {
    lines.push(`${groupAnchors[index]} --> ${groupAnchors[index + 1]}`);
  }

  return finalizeGeneratedDiagram(lines.join('\n'));
}

function sanitizeDiagramNodeId(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized) {
    return 'node';
  }

  return /^\d/.test(sanitized) ? `node_${sanitized}` : sanitized;
}

function escapeDiagramLabel(value: string): string {
  return value.replace(/"/g, "'");
}

/**
 * Generate component breakdown
 */
export async function generateComponentBreakdown(
  architectureName: string,
  techStack: any,
  overview: string,
  skillLevel: SkillLevel = 'beginner',
  diagramCode?: string
): Promise<any[]> {
  const explanationStyleGuidance = getExplanationStyleGuidance(skillLevel);
  const domainPresetGuidance = formatDomainPresetGuidance(`${architectureName} ${overview}`);
  const diagramLabels = diagramCode ? extractMermaidNodeLabels(diagramCode) : [];
  const prompt = `Generate a detailed component breakdown for this architecture.

Architecture: ${architectureName}
Overview: ${overview}
Tech Stack: ${JSON.stringify(techStack)}
Diagram Blocks: ${diagramLabels.join(', ') || 'Not available'}
Mermaid Diagram:
${diagramCode ?? 'Not available'}
Audience Skill Level: ${skillLevel}
Explanation Style:
${explanationStyleGuidance}
Domain Preset Guidance:
${domainPresetGuidance}

Generate 5-8 components with the following structure for each:
{
  "name": "Component Name",
  "type": "frontend|backend|database|service|infrastructure|workflow|compute|storage|orchestration|analytics",
  "description": "What this component does",
  "beginnerExplanation": "A plain-language explanation of this block for a beginner programmer",
  "diagramRole": "How this block appears or behaves in the architecture diagram",
  "responsibilities": ["responsibility1", "responsibility2"],
  "technologies": ["tech1", "tech2"],
  "dependencies": ["component1", "component2"],
  "inputFrom": ["upstream block 1", "upstream block 2"],
  "outputTo": ["downstream block 1", "downstream block 2"]
}

The "description" and "responsibilities" fields should match the requested explanation style.
If the system is a pipeline or scientific workflow, components should reflect stages such as ingestion, orchestration, compute, reference-data management, storage, reporting, and monitoring rather than forcing a UI-centric decomposition.
Make the component list line up with the major blocks that should appear in the architecture diagram. The component names should closely match those diagram blocks whenever practical.
When Diagram Blocks are provided, make the component names and technologies clearly reflect those exact blocks. Do not collapse distinct diagram blocks like AWS Lambda, DynamoDB, AWS S3, CI/CD, or React Native App into vague umbrella names such as Backend, Database, or User Interface.
The "beginnerExplanation" field should explain why the block exists and what would break if it were missing.
The "diagramRole" field should help the UI explain how to read that block in the system diagram.

Return a JSON array of components. Return only valid JSON, no additional text.`;

  const response = await generateText(prompt, DEFAULT_TEXT_MODEL, {
    ...PARAMETERS.TECHNICAL,
    max_new_tokens: 2500,
  });

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    let components = JSON.parse(jsonMatch[0]);
    let coverage = assessComponentDiagramCoverage(components, diagramLabels);

    if (diagramLabels.length > 0 && coverage.score < 0.55 && coverage.missingLabels.length > 0) {
      const repairPrompt = `Repair this component breakdown so it matches the actual Mermaid diagram.

Architecture: ${architectureName}
Overview: ${overview}
Diagram Blocks: ${diagramLabels.join(', ')}
Missing Diagram Blocks In Current Breakdown: ${coverage.missingLabels.join(', ')}
Current Breakdown JSON:
${JSON.stringify(components)}

Requirements:
- Return a JSON array only.
- Keep existing good items when possible.
- Rename or split vague items so the breakdown reflects the specific diagram blocks.
- Make component names and technologies align with the Mermaid diagram labels.
- Avoid umbrella labels like Backend or Database when the diagram shows more specific services.`;

      const repairedResponse = await generateText(repairPrompt, DEFAULT_TEXT_MODEL, {
        ...PARAMETERS.TECHNICAL,
        max_new_tokens: 2500,
      });
      const repairedJsonMatch = repairedResponse.match(/\[[\s\S]*\]/);

      if (repairedJsonMatch) {
        components = JSON.parse(repairedJsonMatch[0]);
      }
    }

    return components;
  } catch (error) {
    console.error('Failed to parse component breakdown:', error);
    return [];
  }
}

function assessComponentDiagramCoverage(components: any[], diagramLabels: string[]): { score: number; missingLabels: string[] } {
  if (diagramLabels.length === 0) {
    return { score: 1, missingLabels: [] };
  }

  const normalizedCoverageTerms = components.flatMap((component) => {
    const terms = [component?.name, ...(Array.isArray(component?.technologies) ? component.technologies : [])]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => normalizeMermaidLabel(value));

    return terms;
  });

  const missingLabels = diagramLabels.filter((label) => {
    const normalizedLabel = normalizeMermaidLabel(label);
    return !normalizedCoverageTerms.some((term) => term.includes(normalizedLabel) || normalizedLabel.includes(term));
  });

  return {
    score: (diagramLabels.length - missingLabels.length) / diagramLabels.length,
    missingLabels,
  };
}

/**
 * Generate justifications
 */
export async function generateJustifications(
  architectureName: string,
  techStack: any,
  requirements: any,
  skillLevel: SkillLevel = 'beginner'
): Promise<any[]> {
  const explanationStyleGuidance = getExplanationStyleGuidance(skillLevel);
  const domainPresetGuidance = formatDomainPresetGuidance(`${architectureName} ${JSON.stringify(requirements)}`);
  const prompt = `Generate technical justifications for architecture decisions.

Architecture: ${architectureName}
Tech Stack: ${JSON.stringify(techStack)}
Requirements: ${JSON.stringify(requirements)}
Audience Skill Level: ${skillLevel}
Explanation Style:
${explanationStyleGuidance}
Domain Preset Guidance:
${domainPresetGuidance}

Generate 4-6 justifications covering:
- Technology choices
- Architecture patterns
- Infrastructure decisions
- Security considerations
- Performance optimizations

If the detected domain is a pipeline, bioinformatics workflow, ETL system, or ML workflow, include workflow orchestration, reproducibility, compute environment, storage layout, and downstream delivery decisions where relevant.

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

The "decision", "reasoning", "description", "whyNotChosen", "benefit", and "cost" text must match the requested explanation style.
For every tradeoff:
- "benefit" must describe a genuine upside of the chosen decision
- "cost" must describe a genuine downside, limitation, added burden, or risk of the chosen decision
- Never put a drawback in the benefit field
- Never put a mitigation, upside, or justification in the cost field unless it is clearly phrased as the downside
- If an item mentions things like steeper learning curve, higher complexity, more operational overhead, slower delivery, more cost, tighter coupling, or vendor lock-in, that belongs in the "cost" field, not the "benefit" field
- Before returning, verify each tradeoff reads logically as "benefit versus cost" from the perspective of the chosen architecture

Return a JSON array. Return only valid JSON, no additional text.`;

  const response = await generateText(prompt, DEFAULT_TEXT_MODEL, {
    ...PARAMETERS.TECHNICAL,
    max_new_tokens: 3000,
  });

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    return normalizeJustifications(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error('Failed to parse justifications:', error);
    return [];
  }
}

function looksLikeBenefit(text: string): boolean {
  return /\b(faster|simpler|simplicity|easier|ease of development|ease|clearer|safer|secure|reliable|scalable|flexible|maintainable|productive|consistent|strong ecosystem|community support|reusable|observable|portable|efficient|better fit|outweigh(?:s)? the .* concerns?)\b/i.test(text);
}

function looksLikeCost(text: string): boolean {
  return /\b(steeper|harder|slower|more time|more effort|complex|complexity|overhead|burden|risk|costly|expensive|lock-?in|coupling|latency|maintenance|operational load|migration effort|learning curve|setup effort|less scalable|less reliable|less flexible|less secure|more tightly coupled|tighter coupling|all components scale together)\b/i.test(text);
}

function extractPositiveClause(text: string): string | null {
  const match = text.match(/\b(?:but|however|though|although|while|offset by|balanced by)\b([\s\S]*)/i);
  const clause = match?.[1]?.trim();

  if (!clause || !looksLikeBenefit(clause)) {
    return null;
  }

  return clause
    .replace(/^[,:;\-\s]+/, '')
    .replace(/^(?:however|but|though|although|while)\s*,?\s*/i, '')
    .replace(/^for\s+[^,]+,\s*/i, '')
    .replace(/^(?:this|that|it)\s+(?:is\s+)?(?:offset|balanced)\s+by\s+/i, '')
    .trim();
}

function extractNegativeClause(text: string): string {
  return text
    .split(/\b(?:but|however|though|although|while|offset by|balanced by)\b/i)[0]
    .trim()
    .replace(/[,:;\-\s]+$/, '');
}

export function normalizeJustifications(justifications: any[]): any[] {
  return justifications.map((justification) => ({
    ...justification,
    tradeoffs: Array.isArray(justification.tradeoffs)
      ? justification.tradeoffs.map((tradeoff: any) => {
          const benefit = typeof tradeoff?.benefit === 'string' ? tradeoff.benefit.trim() : '';
          const cost = typeof tradeoff?.cost === 'string' ? tradeoff.cost.trim() : '';
          const extractedBenefitFromCost = extractPositiveClause(cost);
          const extractedCostFromCost = extractNegativeClause(cost);

          const shouldSwap = looksLikeCost(benefit) && !looksLikeCost(cost) && looksLikeBenefit(cost);
          const shouldRewriteFromMixedCost = looksLikeCost(benefit) && Boolean(extractedBenefitFromCost);

          return {
            ...tradeoff,
            benefit: shouldRewriteFromMixedCost
              ? extractedBenefitFromCost
              : shouldSwap
              ? cost
              : benefit,
            cost: shouldRewriteFromMixedCost
              ? extractNegativeClause(benefit) || extractedCostFromCost || cost
              : shouldSwap
              ? benefit
              : cost,
          };
        })
      : [],
  }));
}

/**
 * Generate implementation guide
 */
export async function generateImplementationGuide(
  projectDescription: string,
  architectureName: string,
  architectureOverview: string,
  techStack: any,
  requirements: any,
  components: any[],
  justifications: any[],
  skillLevel: SkillLevel = 'beginner'
): Promise<string> {
  const explanationStyleGuidance = getExplanationStyleGuidance(skillLevel);
  const domainPresetGuidance = formatDomainPresetGuidance(`${projectDescription}\n${architectureName}\n${architectureOverview}`);
  const prompt = `Create an implementation guide for a coding agent like Bob or Copilot.

Project Description: ${projectDescription}
Selected Architecture: ${architectureName}
Architecture Overview: ${architectureOverview}
Tech Stack: ${JSON.stringify(techStack)}
Requirements: ${JSON.stringify(requirements)}
Components: ${JSON.stringify(components)}
Justifications: ${JSON.stringify(justifications)}
Audience Skill Level: ${skillLevel}
Explanation Style:
${explanationStyleGuidance}
Domain Preset Guidance:
${domainPresetGuidance}

Return markdown only.

The guide must be practical instructions a coding agent can follow to start a repo and populate the codebase. It must also clearly separate work that needs to happen outside the repo.

Include these sections in order:
1. # Implementation Guide
2. ## Build Goal
3. ## Repo Setup Instructions
4. ## Suggested Repository Structure
5. ## Delivery Plan
6. ## Implementation Tasks For The Coding Agent
7. ## Work Required Outside The Repo
8. ## Environment Variables And Secrets
9. ## Validation Checklist
10. ## Handoff Notes

Requirements for the content:
- Be specific to this project and selected architecture, not generic advice.
- In Repo Setup Instructions, tell the agent what framework/runtime/database/infrastructure choices to scaffold.
- In Suggested Repository Structure, include a concrete folder layout in a markdown code block.
- In Delivery Plan, break implementation into phases with clear order.
- In Implementation Tasks For The Coding Agent, use numbered steps with enough detail that the agent can begin writing code immediately.
- In Work Required Outside The Repo, include infrastructure provisioning, accounts, cloud services, DNS, secrets, deployments, third-party integrations, compliance, and operational setup when relevant.
- In Environment Variables And Secrets, list actual variable names the repo should expect.
- In Validation Checklist, include tests, manual checks, and deployment verification.
- Mention any major tradeoffs from the architecture justifications when they affect implementation order or operational setup.

Do not wrap the response in code fences. Return only markdown.`;

  const response = await generateText(prompt, DEFAULT_TEXT_MODEL, {
    ...PARAMETERS.TECHNICAL,
    max_new_tokens: 3500,
  });

  return response.trim();
}

/**
 * Test watsonx.ai connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await generateText('Hello, this is a test.', DEFAULT_TEXT_MODEL, {
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
