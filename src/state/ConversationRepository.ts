import { randomUUID } from 'crypto';
import { getDb } from './db.js';

export interface ConversationMessage {
  id: string;
  task_id: string;
  turn: number;
  role: 'user' | 'assistant';
  content: string;
  token_count: number | null;
  created_at: number;
}

export const ConversationRepository = {
  append(taskId: string, role: 'user' | 'assistant', content: string, tokenCount?: number): ConversationMessage {
    const db = getDb();
    const lastTurn = (db.prepare('SELECT MAX(turn) as t FROM conversations WHERE task_id = ?').get(taskId) as { t: number | null }).t ?? 0;
    const msg: ConversationMessage = {
      id: randomUUID(),
      task_id: taskId,
      turn: lastTurn + 1,
      role,
      content,
      token_count: tokenCount ?? null,
      created_at: Date.now(),
    };
    db.prepare('INSERT INTO conversations VALUES (@id, @task_id, @turn, @role, @content, @token_count, @created_at)').run(msg);
    return msg;
  },

  getHistory(taskId: string): ConversationMessage[] {
    return getDb().prepare('SELECT * FROM conversations WHERE task_id = ? ORDER BY turn ASC').all(taskId) as ConversationMessage[];
  },

  getLastN(taskId: string, n: number): ConversationMessage[] {
    return getDb().prepare('SELECT * FROM conversations WHERE task_id = ? ORDER BY turn DESC LIMIT ?').all(taskId, n).reverse() as ConversationMessage[];
  },

  countTokens(taskId: string): number {
    const row = getDb().prepare('SELECT SUM(token_count) as total FROM conversations WHERE task_id = ?').get(taskId) as { total: number | null };
    return row.total ?? 0;
  },
};
