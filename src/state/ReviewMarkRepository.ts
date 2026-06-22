import { getDb } from './db.js';

/** Mốc commit đã review trên 1 nhánh của 1 repo — phục vụ auto-incremental review (chỉ phần mới). */
export const ReviewMarkRepository = {
  get(repoKey: string, branch: string): string | null {
    const row = getDb()
      .prepare('SELECT last_commit FROM review_marks WHERE repo_key = ? AND branch = ?')
      .get(repoKey, branch) as { last_commit: string } | undefined;
    return row?.last_commit ?? null;
  },

  set(repoKey: string, branch: string, commit: string): void {
    getDb().prepare(`INSERT INTO review_marks (repo_key, branch, last_commit, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(repo_key, branch) DO UPDATE SET last_commit = excluded.last_commit, updated_at = excluded.updated_at`)
      .run(repoKey, branch, commit, Date.now());
  },
};
