import Database from 'better-sqlite3';
import 'dotenv/config';
import { join } from 'path';

const db = new Database(join(process.cwd(), 'data', 'agent.db'));
const rows = db.prepare('SELECT id, card_id, card_name, list_id, task_type, status, parent_task_id, plan_file_path, metadata FROM tasks ORDER BY created_at DESC LIMIT 50').all();
console.log('tasks count', rows.length);
for (const row of rows) {
  console.log(row);
}
const epicRows = db.prepare("SELECT * FROM tasks WHERE task_type='epic' OR parent_task_id IS NOT NULL ORDER BY created_at DESC").all();
console.log('epic rows', epicRows.length);
for (const row of epicRows) console.log(row);
