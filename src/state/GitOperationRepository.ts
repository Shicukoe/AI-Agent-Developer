import { randomUUID } from 'crypto';
import { getDb } from './db.js';

export type GitOperationType = 'create_branch' | 'commit' | 'merge' | 'push' | 'worktree_add' | 'worktree_remove';

export interface GitOperation {
  id: string;
  task_id: string;
  operation: GitOperationType;
  branch: string | null;
  commit_hash: string | null;
  output: string | null;
  executed_at: number;
}

export const GitOperationRepository = {
  log(taskId: string, op: GitOperationType, opts: { branch?: string; commitHash?: string; output?: string } = {}): void {
    getDb().prepare('INSERT INTO git_operations VALUES (@id, @task_id, @operation, @branch, @commit_hash, @output, @executed_at)').run({
      id: randomUUID(),
      task_id: taskId,
      operation: op,
      branch: opts.branch ?? null,
      commit_hash: opts.commitHash ?? null,
      output: opts.output ?? null,
      executed_at: Date.now(),
    });
  },

  getByTask(taskId: string): GitOperation[] {
    return getDb().prepare('SELECT * FROM git_operations WHERE task_id = ? ORDER BY executed_at ASC').all(taskId) as GitOperation[];
  },
};
