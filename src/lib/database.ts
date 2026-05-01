import Database from 'better-sqlite3';
import path from 'path';
import { 
  DBProject, 
  DBConversation, 
  DBArchitecture, 
  DBExport,
  Project,
  Message,
  ArchitectureOption,
  ExportResult,
  SkillLevel,
  ProjectStatus,
  MessageRole,
  ExportFormat
} from '@/types';

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

// Initialize database connection
let db: Database.Database | null = null;

/**
 * Get database instance (singleton pattern)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    initializeSchema();
  }
  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema(): void {
  const db = getDatabase();

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      skill_level TEXT NOT NULL CHECK(skill_level IN ('beginner', 'intermediate', 'advanced')),
      status TEXT NOT NULL CHECK(status IN ('created', 'clarifying', 'generating_options', 'selecting_architecture', 'designing', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Architectures table
  db.exec(`
    CREATE TABLE IF NOT EXISTS architectures (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      overview TEXT NOT NULL,
      tech_stack TEXT NOT NULL,
      pros TEXT NOT NULL,
      cons TEXT NOT NULL,
      complexity TEXT NOT NULL CHECK(complexity IN ('low', 'medium', 'high')),
      estimated_cost TEXT NOT NULL CHECK(estimated_cost IN ('low', 'medium', 'high')),
      diagram TEXT,
      selected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Exports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('markdown', 'pdf', 'json', 'html', 'png')),
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
    CREATE INDEX IF NOT EXISTS idx_architectures_project_id ON architectures(project_id);
    CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
  `);
}

/**
 * Convert DB project to Project type
 */
function dbProjectToProject(dbProject: DBProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description,
    skillLevel: dbProject.skill_level as SkillLevel,
    status: dbProject.status as ProjectStatus,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
  };
}

/**
 * Convert DB conversation to Message type
 */
function dbConversationToMessage(dbConv: DBConversation): Message {
  return {
    id: dbConv.id,
    projectId: dbConv.project_id,
    role: dbConv.role as MessageRole,
    content: dbConv.content,
    timestamp: dbConv.timestamp,
  };
}

/**
 * Convert DB architecture to ArchitectureOption type
 */
function dbArchitectureToOption(dbArch: DBArchitecture): ArchitectureOption {
  return {
    id: dbArch.id,
    projectId: dbArch.project_id,
    name: dbArch.name,
    description: dbArch.description,
    overview: dbArch.overview,
    techStack: JSON.parse(dbArch.tech_stack),
    pros: JSON.parse(dbArch.pros),
    cons: JSON.parse(dbArch.cons),
    complexity: dbArch.complexity as 'low' | 'medium' | 'high',
    estimatedCost: dbArch.estimated_cost as 'low' | 'medium' | 'high',
    diagram: dbArch.diagram || undefined,
    selected: dbArch.selected === 1,
    createdAt: dbArch.created_at,
  };
}

/**
 * Convert DB export to ExportResult type
 */
function dbExportToResult(dbExport: DBExport): ExportResult {
  return {
    id: dbExport.id,
    projectId: dbExport.project_id,
    format: dbExport.format as ExportFormat,
    filename: dbExport.filename,
    content: dbExport.content,
    createdAt: dbExport.created_at,
  };
}

// ============================================================================
// Project Operations
// ============================================================================

export function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const db = getDatabase();
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO projects (id, name, description, skill_level, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, project.name, project.description, project.skillLevel, project.status, now, now);

  return {
    id,
    ...project,
    createdAt: now,
    updatedAt: now,
  };
}

export function getProject(id: string): Project | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  const row = stmt.get(id) as DBProject | undefined;
  return row ? dbProjectToProject(row) : null;
}

export function getAllProjects(): Project[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  const rows = stmt.all() as DBProject[];
  return rows.map(dbProjectToProject);
}

export function updateProject(id: string, updates: Partial<Project>): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.skillLevel !== undefined) {
    fields.push('skill_level = ?');
    values.push(updates.skillLevel);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const stmt = db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================================================
// Conversation Operations
// ============================================================================

export function addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
  const db = getDatabase();
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO conversations (id, project_id, role, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, message.projectId, message.role, message.content, timestamp);

  return {
    id,
    ...message,
    timestamp,
  };
}

export function getConversation(projectId: string): Message[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM conversations WHERE project_id = ? ORDER BY timestamp ASC');
  const rows = stmt.all(projectId) as DBConversation[];
  return rows.map(dbConversationToMessage);
}

export function deleteConversation(projectId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM conversations WHERE project_id = ?');
  const result = stmt.run(projectId);
  return result.changes > 0;
}

// ============================================================================
// Architecture Operations
// ============================================================================

export function createArchitecture(architecture: Omit<ArchitectureOption, 'id' | 'createdAt'>): ArchitectureOption {
  const db = getDatabase();
  const id = `arch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO architectures (
      id, project_id, name, description, overview, tech_stack, pros, cons,
      complexity, estimated_cost, diagram, selected, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    architecture.projectId,
    architecture.name,
    architecture.description,
    architecture.overview,
    JSON.stringify(architecture.techStack),
    JSON.stringify(architecture.pros),
    JSON.stringify(architecture.cons),
    architecture.complexity,
    architecture.estimatedCost,
    architecture.diagram || null,
    architecture.selected ? 1 : 0,
    now
  );

  return {
    id,
    ...architecture,
    createdAt: now,
  };
}

export function getArchitectures(projectId: string): ArchitectureOption[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM architectures WHERE project_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(projectId) as DBArchitecture[];
  return rows.map(dbArchitectureToOption);
}

export function getArchitecture(id: string): ArchitectureOption | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM architectures WHERE id = ?');
  const row = stmt.get(id) as DBArchitecture | undefined;
  return row ? dbArchitectureToOption(row) : null;
}

export function selectArchitecture(projectId: string, architectureId: string): boolean {
  const db = getDatabase();
  
  // Deselect all architectures for this project
  const deselectStmt = db.prepare('UPDATE architectures SET selected = 0 WHERE project_id = ?');
  deselectStmt.run(projectId);

  // Select the specified architecture
  const selectStmt = db.prepare('UPDATE architectures SET selected = 1 WHERE id = ?');
  const result = selectStmt.run(architectureId);
  
  return result.changes > 0;
}

export function updateArchitecture(id: string, updates: Partial<ArchitectureOption>): boolean {
  const db = getDatabase();
  
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.diagram !== undefined) {
    fields.push('diagram = ?');
    values.push(updates.diagram);
  }
  if (updates.selected !== undefined) {
    fields.push('selected = ?');
    values.push(updates.selected ? 1 : 0);
  }

  if (fields.length === 0) return false;

  values.push(id);

  const stmt = db.prepare(`UPDATE architectures SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// ============================================================================
// Export Operations
// ============================================================================

export function createExport(exportData: Omit<ExportResult, 'id' | 'createdAt'>): ExportResult {
  const db = getDatabase();
  const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO exports (id, project_id, format, filename, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const content = typeof exportData.content === 'string' 
    ? exportData.content 
    : exportData.content.toString('base64');

  stmt.run(id, exportData.projectId, exportData.format, exportData.filename, content, now);

  return {
    id,
    ...exportData,
    createdAt: now,
  };
}

export function getExports(projectId: string): ExportResult[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM exports WHERE project_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(projectId) as DBExport[];
  return rows.map(dbExportToResult);
}

export function getExport(id: string): ExportResult | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM exports WHERE id = ?');
  const row = stmt.get(id) as DBExport | undefined;
  return row ? dbExportToResult(row) : null;
}

// ============================================================================
// Utility Operations
// ============================================================================

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDatabaseStats() {
  const db = getDatabase();
  
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  const conversationCount = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
  const architectureCount = db.prepare('SELECT COUNT(*) as count FROM architectures').get() as { count: number };
  const exportCount = db.prepare('SELECT COUNT(*) as count FROM exports').get() as { count: number };

  return {
    projects: projectCount.count,
    conversations: conversationCount.count,
    architectures: architectureCount.count,
    exports: exportCount.count,
  };
}

// Made with Bob
