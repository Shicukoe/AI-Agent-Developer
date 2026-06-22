import { randomUUID } from 'crypto';
import { getDb } from './db.js';

/** Cấu hình repo cho 1 board Trello (đa-repo). 1 board = 1 repo. */
export interface RepoConfig {
  id: string;
  board_id: string;
  name: string;
  repo_path: string;
  base_branch: string;
  enabled: number; // 0 | 1 (SQLite không có boolean)
  created_at: number;
  updated_at: number;
  docs_path: string | null;   // thư mục tài liệu (mặc định <repo>/docs nếu null)
}

export interface RepoConfigInput {
  board_id: string;
  name: string;
  repo_path: string;
  base_branch?: string;
  enabled?: boolean;
  docs_path?: string;
}

export const RepoConfigRepository = {
  count(): number {
    return (getDb().prepare('SELECT COUNT(*) AS n FROM repo_configs').get() as { n: number }).n;
  },

  list(): RepoConfig[] {
    return getDb().prepare('SELECT * FROM repo_configs ORDER BY name ASC').all() as RepoConfig[];
  },

  getById(id: string): RepoConfig | undefined {
    return getDb().prepare('SELECT * FROM repo_configs WHERE id = ?').get(id) as RepoConfig | undefined;
  },

  getByBoard(boardId: string): RepoConfig | undefined {
    return getDb().prepare('SELECT * FROM repo_configs WHERE board_id = ?').get(boardId) as RepoConfig | undefined;
  },

  create(input: RepoConfigInput): RepoConfig {
    const now = Date.now();
    const row: RepoConfig = {
      id: randomUUID(),
      board_id: input.board_id.trim(),
      name: input.name.trim(),
      repo_path: input.repo_path.trim(),
      base_branch: (input.base_branch ?? 'dev').trim() || 'dev',
      enabled: input.enabled === false ? 0 : 1,
      created_at: now,
      updated_at: now,
      docs_path: input.docs_path?.trim() || null,
    };
    getDb().prepare(`INSERT INTO repo_configs VALUES (
      @id, @board_id, @name, @repo_path, @base_branch, @enabled, @created_at, @updated_at, @docs_path
    )`).run(row);
    return row;
  },

  update(id: string, patch: Partial<Omit<RepoConfig, 'id' | 'created_at'>>): void {
    const fields = { ...patch, updated_at: Date.now() };
    const sets = Object.keys(fields).map(k => `${k} = @${k}`).join(', ');
    getDb().prepare(`UPDATE repo_configs SET ${sets} WHERE id = @id`).run({ ...fields, id });
  },

  remove(id: string): void {
    getDb().prepare('DELETE FROM repo_configs WHERE id = ?').run(id);
  },
};
