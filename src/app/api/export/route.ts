import { NextRequest, NextResponse } from 'next/server';
import { 
  getProject, 
  getArchitectures, 
  getConversation,
  createExport,
  updateProject
} from '@/lib/database';
import { ExportOptions, APIError } from '@/types';

/**
 * POST /api/export
 * Export project documentation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, format = 'markdown', options = {} } = body;
    
    // Validate input
    if (!projectId) {
      const errorResponse: APIError = {
        error: 'VALIDATION_ERROR',
        message: 'Project ID is required',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Get project
    const project = getProject(projectId);
    if (!project) {
      const errorResponse: APIError = {
        error: 'NOT_FOUND',
        message: 'Project not found',
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    // Get architectures
    const architectures = getArchitectures(projectId);
    const selectedArchitecture = architectures.find(a => a.selected);
    
    if (!selectedArchitecture) {
      const errorResponse: APIError = {
        error: 'NO_ARCHITECTURE',
        message: 'No architecture selected for this project',
      };
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Get conversation if requested
    let conversation: any[] = [];
    if (options.includeConversation) {
      conversation = getConversation(projectId);
    }
    
    // Generate export content based on format
    let content = '';
    let filename = '';
    
    switch (format) {
      case 'markdown':
        content = generateMarkdownExport(project, selectedArchitecture, conversation, options);
        filename = `${project.name.replace(/\s+/g, '-').toLowerCase()}-architecture.md`;
        break;
        
      case 'json':
        content = JSON.stringify({
          project,
          architecture: selectedArchitecture,
          conversation: options.includeConversation ? conversation : undefined,
        }, null, 2);
        filename = `${project.name.replace(/\s+/g, '-').toLowerCase()}-architecture.json`;
        break;
        
      case 'html':
        content = generateHTMLExport(project, selectedArchitecture, conversation, options);
        filename = `${project.name.replace(/\s+/g, '-').toLowerCase()}-architecture.html`;
        break;
        
      default:
        const errorResponse: APIError = {
          error: 'INVALID_FORMAT',
          message: 'Unsupported export format',
        };
        
        return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Save export to database
    const exportResult = createExport({
      projectId,
      format,
      filename,
      content,
    });
    
    // Update project status to completed
    updateProject(projectId, { status: 'completed' });
    
    return NextResponse.json({
      export: exportResult,
      message: 'Export created successfully',
    });
  } catch (error) {
    console.error('Error creating export:', error);
    
    const errorResponse: APIError = {
      error: 'EXPORT_FAILED',
      message: 'Failed to create export',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Generate Markdown export
 */
function generateMarkdownExport(
  project: any,
  architecture: any,
  conversation: any[],
  options: any
): string {
  let md = `# ${project.name}\n\n`;
  md += `**Generated**: ${new Date().toLocaleDateString()}\n\n`;
  md += `## Project Description\n\n${project.description}\n\n`;
  
  md += `## Selected Architecture: ${architecture.name}\n\n`;
  md += `${architecture.overview}\n\n`;
  
  md += `### Technology Stack\n\n`;
  if (architecture.techStack.frontend?.length) {
    md += `**Frontend**: ${architecture.techStack.frontend.join(', ')}\n\n`;
  }
  if (architecture.techStack.backend?.length) {
    md += `**Backend**: ${architecture.techStack.backend.join(', ')}\n\n`;
  }
  if (architecture.techStack.database?.length) {
    md += `**Database**: ${architecture.techStack.database.join(', ')}\n\n`;
  }
  if (architecture.techStack.infrastructure?.length) {
    md += `**Infrastructure**: ${architecture.techStack.infrastructure.join(', ')}\n\n`;
  }
  
  md += `### Pros\n\n`;
  architecture.pros.forEach((pro: string) => {
    md += `- ${pro}\n`;
  });
  md += `\n`;
  
  md += `### Cons\n\n`;
  architecture.cons.forEach((con: string) => {
    md += `- ${con}\n`;
  });
  md += `\n`;
  
  md += `### Complexity\n\n${architecture.complexity}\n\n`;
  md += `### Estimated Cost\n\n${architecture.estimatedCost}\n\n`;
  
  if (options.includeDiagrams && architecture.diagram) {
    md += `## System Diagram\n\n\`\`\`mermaid\n${architecture.diagram}\n\`\`\`\n\n`;
  }
  
  if (options.includeConversation && conversation.length > 0) {
    md += `## Clarification Q&A\n\n`;
    for (let i = 0; i < conversation.length; i += 2) {
      if (conversation[i]?.role === 'assistant' && conversation[i + 1]?.role === 'user') {
        md += `**Q**: ${conversation[i].content}\n\n`;
        md += `**A**: ${conversation[i + 1].content}\n\n`;
      }
    }
  }
  
  return md;
}

/**
 * Generate HTML export
 */
function generateHTMLExport(
  project: any,
  architecture: any,
  conversation: any[],
  options: any
): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - Architecture</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #0f62fe; }
    h2 { color: #333; border-bottom: 2px solid #0f62fe; padding-bottom: 10px; }
    .tech-stack { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .tech-item { background: #f4f4f4; padding: 15px; border-radius: 5px; }
    ul { line-height: 1.8; }
    .metadata { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${project.name}</h1>
  <p class="metadata">Generated: ${new Date().toLocaleDateString()}</p>
  
  <h2>Project Description</h2>
  <p>${project.description}</p>
  
  <h2>Selected Architecture: ${architecture.name}</h2>
  <p>${architecture.overview}</p>
  
  <h2>Technology Stack</h2>
  <div class="tech-stack">`;
  
  if (architecture.techStack.frontend?.length) {
    html += `<div class="tech-item"><strong>Frontend</strong><br>${architecture.techStack.frontend.join(', ')}</div>`;
  }
  if (architecture.techStack.backend?.length) {
    html += `<div class="tech-item"><strong>Backend</strong><br>${architecture.techStack.backend.join(', ')}</div>`;
  }
  if (architecture.techStack.database?.length) {
    html += `<div class="tech-item"><strong>Database</strong><br>${architecture.techStack.database.join(', ')}</div>`;
  }
  if (architecture.techStack.infrastructure?.length) {
    html += `<div class="tech-item"><strong>Infrastructure</strong><br>${architecture.techStack.infrastructure.join(', ')}</div>`;
  }
  
  html += `</div>
  
  <h2>Advantages</h2>
  <ul>`;
  architecture.pros.forEach((pro: string) => {
    html += `<li>${pro}</li>`;
  });
  html += `</ul>
  
  <h2>Considerations</h2>
  <ul>`;
  architecture.cons.forEach((con: string) => {
    html += `<li>${con}</li>`;
  });
  html += `</ul>
  
  <h2>Complexity</h2>
  <p>${architecture.complexity}</p>
  
  <h2>Estimated Cost</h2>
  <p>${architecture.estimatedCost}</p>
</body>
</html>`;
  
  return html;
}

// Made with Bob
