import Database from 'better-sqlite3';
import path from 'path';
import { 
  DBProject, 
  DBConversation, 
  DBArchitecture, 
  Project,
  Message,
  ArchitectureOption,
  ProjectHistorySummary,
  SkillLevel,
  ProjectStatus,
  MessageRole,
  Component,
  Justification
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
      requirements TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Add requirements column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN requirements TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }

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
      component_cache TEXT,
      justification_cache TEXT,
      implementation_guide_cache TEXT,
      selected INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  try {
    db.exec(`ALTER TABLE architectures ADD COLUMN component_cache TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }

  try {
    db.exec(`ALTER TABLE architectures ADD COLUMN justification_cache TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }

  try {
    db.exec(`ALTER TABLE architectures ADD COLUMN implementation_guide_cache TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }

  try {
    db.exec(`ALTER TABLE architectures ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore error
  }

  removeDuplicateArchitectureNames();

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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_architectures_exact_unique
      ON architectures(project_id, name, description, overview, tech_stack, pros, cons, complexity, estimated_cost);
  `);
}

function removeDuplicateArchitectureNames(): void {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, project_id, name, selected, display_order, created_at
    FROM architectures
    ORDER BY project_id ASC, LOWER(TRIM(name)) ASC, selected DESC, display_order ASC, created_at ASC, id ASC
  `).all() as Array<{
    id: string;
    project_id: string;
    name: string;
    selected: number;
    display_order: number | null;
    created_at: string;
  }>;

  if (rows.length === 0) {
    return;
  }

  const deleteIds: string[] = [];
  const preferredOrderUpdates = new Map<string, number>();
  const duplicateGroups = new Map<string, typeof rows>();

  for (const row of rows) {
    const groupKey = `${row.project_id}::${row.name.trim().toLowerCase()}`;
    const group = duplicateGroups.get(groupKey) ?? [];
    group.push(row);
    duplicateGroups.set(groupKey, group);
  }

  for (const group of duplicateGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const canonical = group[0];
    const preferredDisplayOrder = group.reduce((lowest, entry) => {
      const displayOrder = entry.display_order ?? Number.MAX_SAFE_INTEGER;
      return Math.min(lowest, displayOrder);
    }, Number.MAX_SAFE_INTEGER);

    if (preferredDisplayOrder !== Number.MAX_SAFE_INTEGER && (canonical.display_order ?? Number.MAX_SAFE_INTEGER) !== preferredDisplayOrder) {
      preferredOrderUpdates.set(canonical.id, preferredDisplayOrder);
    }

    for (const duplicate of group.slice(1)) {
      deleteIds.push(duplicate.id);
    }
  }

  if (deleteIds.length === 0 && preferredOrderUpdates.size === 0) {
    return;
  }

  const deleteStmt = db.prepare('DELETE FROM architectures WHERE id = ?');
  const updateDisplayOrderStmt = db.prepare('UPDATE architectures SET display_order = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    for (const [id, displayOrder] of preferredOrderUpdates.entries()) {
      updateDisplayOrderStmt.run(displayOrder, id);
    }

    for (const id of deleteIds) {
      deleteStmt.run(id);
    }

    const remainingRows = db.prepare(`
      SELECT id, project_id
      FROM architectures
      ORDER BY project_id ASC, display_order ASC, created_at ASC, id ASC
    `).all() as Array<{ id: string; project_id: string }>;

    const nextOrderByProject = new Map<string, number>();
    for (const row of remainingRows) {
      const nextOrder = nextOrderByProject.get(row.project_id) ?? 0;
      updateDisplayOrderStmt.run(nextOrder, row.id);
      nextOrderByProject.set(row.project_id, nextOrder + 1);
    }
  });

  transaction();
}

function findExactArchitectureMatch(architecture: Omit<ArchitectureOption, 'id' | 'createdAt'>): ArchitectureOption | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT *
    FROM architectures
    WHERE project_id = ?
      AND name = ?
      AND description = ?
      AND overview = ?
      AND tech_stack = ?
      AND pros = ?
      AND cons = ?
      AND complexity = ?
      AND estimated_cost = ?
    LIMIT 1
  `);

  const row = stmt.get(
    architecture.projectId,
    architecture.name,
    architecture.description,
    architecture.overview,
    JSON.stringify(architecture.techStack),
    JSON.stringify(architecture.pros),
    JSON.stringify(architecture.cons),
    architecture.complexity,
    architecture.estimatedCost
  ) as DBArchitecture | undefined;

  return row ? dbArchitectureToOption(row) : null;
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
    requirements: dbProject.requirements ? JSON.parse(dbProject.requirements) : undefined,
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
    displayOrder: dbArch.display_order ?? 0,
    createdAt: dbArch.created_at,
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

function getProjectResumePath(project: Project, architectureCount: number, hasSelectedArchitecture: boolean): string {
  if (hasSelectedArchitecture || project.status === 'designing' || project.status === 'completed') {
    return `/project/${project.id}/design`;
  }

  if (architectureCount > 0 || project.status === 'selecting_architecture' || project.status === 'generating_options') {
    return `/project/${project.id}/architecture`;
  }

  return `/project/${project.id}/clarify`;
}

export function getProjectHistorySummaries(): ProjectHistorySummary[] {
  const db = getDatabase();
  const projects = getAllProjects();

  const conversationCountStmt = db.prepare('SELECT COUNT(*) as count FROM conversations WHERE project_id = ?');
  const answeredQuestionCountStmt = db.prepare("SELECT COUNT(*) as count FROM conversations WHERE project_id = ? AND role = 'user'");
  const architectureCountStmt = db.prepare('SELECT COUNT(*) as count FROM architectures WHERE project_id = ?');
  const selectedArchitectureStmt = db.prepare(`
    SELECT id, name, description, created_at
    FROM architectures
    WHERE project_id = ? AND selected = 1
    LIMIT 1
  `);

  return projects.map((project) => {
    const conversationCount = (conversationCountStmt.get(project.id) as { count: number }).count;
    const answeredQuestionCount = (answeredQuestionCountStmt.get(project.id) as { count: number }).count;
    const architectureCount = (architectureCountStmt.get(project.id) as { count: number }).count;
    const selectedArchitectureRow = selectedArchitectureStmt.get(project.id) as
      | { id: string; name: string; description: string; created_at: string }
      | undefined;

    const selectedArchitecture = selectedArchitectureRow
      ? {
          id: selectedArchitectureRow.id,
          name: selectedArchitectureRow.name,
          description: selectedArchitectureRow.description,
          createdAt: selectedArchitectureRow.created_at,
        }
      : undefined;

    return {
      project,
      conversationCount,
      answeredQuestionCount,
      architectureCount,
      hasRequirements: Boolean(project.requirements),
      selectedArchitecture,
      resumePath: getProjectResumePath(project, architectureCount, Boolean(selectedArchitecture)),
    };
  });
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
  if (updates.requirements !== undefined) {
    fields.push('requirements = ?');
    values.push(JSON.stringify(updates.requirements));
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
  const existingArchitecture = findExactArchitectureMatch(architecture);

  if (existingArchitecture) {
    return existingArchitecture;
  }

  const id = `arch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO architectures (
      id, project_id, name, description, overview, tech_stack, pros, cons,
      complexity, estimated_cost, diagram, selected, display_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
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
    architecture.displayOrder ?? 0,
    now
  );

  if (result.changes === 0) {
    const matchedArchitecture = findExactArchitectureMatch(architecture);

    if (matchedArchitecture) {
      return matchedArchitecture;
    }
  }

  return {
    id,
    ...architecture,
    createdAt: now,
  };
}

export function getArchitectures(projectId: string): ArchitectureOption[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM architectures WHERE project_id = ? ORDER BY display_order ASC, created_at ASC, id ASC');
  const rows = stmt.all(projectId) as DBArchitecture[];
  return rows.map(dbArchitectureToOption);
}

export function getArchitecture(id: string): ArchitectureOption | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM architectures WHERE id = ?');
  const row = stmt.get(id) as DBArchitecture | undefined;
  return row ? dbArchitectureToOption(row) : null;
}

export function reorderArchitectures(projectId: string, prioritizedArchitectureIds: string[]): void {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id
    FROM architectures
    WHERE project_id = ?
    ORDER BY display_order ASC, created_at ASC, id ASC
  `).all(projectId) as Array<{ id: string }>;

  if (rows.length === 0) {
    return;
  }

  const uniquePrioritizedIds = prioritizedArchitectureIds.filter(
    (id, index) => prioritizedArchitectureIds.indexOf(id) === index
  );
  const remainingIds = rows
    .map((row) => row.id)
    .filter((id) => !uniquePrioritizedIds.includes(id));
  const orderedIds = [...uniquePrioritizedIds, ...remainingIds];
  const updateStmt = db.prepare('UPDATE architectures SET display_order = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      updateStmt.run(index, id);
    });
  });

  transaction();
}

export function deleteArchitectures(projectId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM architectures WHERE project_id = ?');
  const result = stmt.run(projectId);
  return result.changes > 0;
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

export function getArchitectureComponents(architectureId: string): Component[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT component_cache FROM architectures WHERE id = ?');
  const row = stmt.get(architectureId) as { component_cache?: string | null } | undefined;

  if (!row?.component_cache) {
    return [];
  }

  try {
    return JSON.parse(row.component_cache) as Component[];
  } catch (error) {
    console.error('Failed to parse cached components:', error);
    return [];
  }
}

export function saveArchitectureComponents(architectureId: string, components: Component[]): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE architectures SET component_cache = ? WHERE id = ?');
  const result = stmt.run(JSON.stringify(components), architectureId);
  return result.changes > 0;
}

export function getArchitectureJustifications(architectureId: string): Justification[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT justification_cache FROM architectures WHERE id = ?');
  const row = stmt.get(architectureId) as { justification_cache?: string | null } | undefined;

  if (!row?.justification_cache) {
    return [];
  }

  try {
    return JSON.parse(row.justification_cache) as Justification[];
  } catch (error) {
    console.error('Failed to parse cached justifications:', error);
    return [];
  }
}

export function saveArchitectureJustifications(architectureId: string, justifications: Justification[]): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE architectures SET justification_cache = ? WHERE id = ?');
  const result = stmt.run(JSON.stringify(justifications), architectureId);
  return result.changes > 0;
}

export function getArchitectureImplementationGuide(architectureId: string): string | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT implementation_guide_cache FROM architectures WHERE id = ?');
  const row = stmt.get(architectureId) as { implementation_guide_cache?: string | null } | undefined;
  return row?.implementation_guide_cache || null;
}

export function saveArchitectureImplementationGuide(architectureId: string, guide: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE architectures SET implementation_guide_cache = ? WHERE id = ?');
  const result = stmt.run(guide, architectureId);
  return result.changes > 0;
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

  return {
    projects: projectCount.count,
    conversations: conversationCount.count,
    architectures: architectureCount.count,
  };
}

// Made with Bob
