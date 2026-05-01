// scripts/reset-database.ts
import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

console.log('🔄 Resetting database...');

// Delete old database
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('✅ Old database deleted');
}

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create new database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('📝 Creating schema...');

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

console.log('✅ Projects table created');

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

console.log('✅ Conversations table created');

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

console.log('✅ Architectures table created');

// Exports table
db.exec(`
  CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('markdown', 'pdf', 'json')),
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);

console.log('✅ Exports table created');

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
  CREATE INDEX IF NOT EXISTS idx_architectures_project ON architectures(project_id);
  CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);
  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
`);

console.log('✅ Indexes created');

db.close();

console.log('🎉 Database reset complete!');
console.log('📍 Database location:', DB_PATH);

// Made with Bob
