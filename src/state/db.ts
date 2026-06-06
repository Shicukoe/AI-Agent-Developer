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

  log.info({ path: dbPath }, 'Database initialized');
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
