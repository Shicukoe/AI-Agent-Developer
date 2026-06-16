import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('db');
const __dirname = dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  mkdirSync(config.DATA_DIR, { recursive: true });
  const dbPath = join(config.DATA_DIR, 'agent.db');

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  _db.exec(schema);

  migrate(_db);

  log.info({ path: dbPath }, 'Database initialized');
  return _db;
}

/**
 * Migration idempotent cho DB cũ: `CREATE TABLE IF NOT EXISTS` không thêm cột vào bảng đã tồn tại,
 * nên với DB cũ ta tự `ALTER TABLE ADD COLUMN` cho các cột còn thiếu (SQLite cho phép ADD COLUMN nullable).
 */
function migrate(db: Database.Database): void {
  const cols = (db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>).map(c => c.name);
  const needed: Array<{ name: string; ddl: string }> = [
    { name: 'repo_key', ddl: 'ALTER TABLE tasks ADD COLUMN repo_key TEXT' },
    { name: 'repo_path', ddl: 'ALTER TABLE tasks ADD COLUMN repo_path TEXT' },
  ];
  for (const c of needed) {
    if (!cols.includes(c.name)) {
      try { db.exec(c.ddl); log.info({ column: c.name }, 'Migrated: added tasks column'); }
      catch (err) { log.warn({ column: c.name, err: (err as Error).message }, 'Migration ADD COLUMN lỗi'); }
    }
  }
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
