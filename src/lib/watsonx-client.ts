import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication';
import { normalizeMermaidDiagram } from '@/lib/mermaid';
import { SkillLevel, WatsonXConfig, WatsonXRequest, WatsonXResponse } from '@/types';
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
- If the user says things like "decide yourself", "use best practices", or "give me options with justifications", accept that as a valid preference and move to a different unresolved design question instead of pushing for the same decision
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

Use true when the user explicitly delegates implementation choices with phrases like "decide yourself", "use best practices", or "show me options with justifications".
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

If the user answered with phrases like "decide yourself", "use best practices", or "show options with justifications", treat that as a valid instruction to leave room for architecture options rather than as missing information. Capture those answers as assumptions or design flexibility, not as unanswered gaps.
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

For each option, provide:
1. A unique name that fits the project type (for example, web-app patterns for apps, or workflow/pipeline/platform patterns for data and scientific systems)
2. Brief description (2-3 sentences)
3. Detailed overview (1 paragraph)
4. Technology stack as a JSON object with only the categories that make sense for this project. Common categories include frontend, backend, database, infrastructure, orchestration, workflow, compute, storage, analytics, bioinformatics_tools, observability, security, integrations, and tools.
5. 3-4 pros
6. 3-4 cons
7. Complexity level (low/medium/high)
8. Estimated cost (low/medium/high)

If this is a pipeline or scientific workflow, prefer architecture options such as orchestrated batch pipelines, workflow-engine-based systems, reproducible containerized compute pipelines, HPC-compatible execution, or hybrid cloud processing where appropriate.
For bioinformatics specifically, pay attention to data volumes, reproducibility, workflow orchestration, storage layout, compute environment, reference data management, and integration with domain tools.

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

  const diagram = await generateText(prompt, DEFAULT_CODE_MODEL, PARAMETERS.CODE);
  
  // Clean up the response to ensure it's valid Mermaid
  let cleaned = normalizeMermaidDiagram(diagram);
  
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
  overview: string,
  skillLevel: SkillLevel = 'beginner'
): Promise<any[]> {
  const explanationStyleGuidance = getExplanationStyleGuidance(skillLevel);
  const domainPresetGuidance = formatDomainPresetGuidance(`${architectureName} ${overview}`);
  const prompt = `Generate a detailed component breakdown for this architecture.

Architecture: ${architectureName}
Overview: ${overview}
Tech Stack: ${JSON.stringify(techStack)}
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
  "responsibilities": ["responsibility1", "responsibility2"],
  "technologies": ["tech1", "tech2"],
  "dependencies": ["component1", "component2"]
}

The "description" and "responsibilities" fields should match the requested explanation style.
If the system is a pipeline or scientific workflow, components should reflect stages such as ingestion, orchestration, compute, reference-data management, storage, reporting, and monitoring rather than forcing a UI-centric decomposition.

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
