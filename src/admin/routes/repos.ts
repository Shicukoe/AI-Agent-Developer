import { Router } from 'express';
import type { Request, Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { RepoConfigRepository } from '../../state/RepoConfigRepository.js';
import { TrelloClient } from '../../trello/TrelloClient.js';
import { ProjectKnowledge } from '../../agents/ProjectKnowledge.js';
import { config } from '../../config.js';
import { childLogger } from '../../utils/logger.js';

const log = childLogger('admin-repos');

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response): void => {
    fn(req, res).catch((err: unknown) => {
      log.error({ err, path: req.path }, 'Admin repos route error');
      if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    });
  };
}

/** Kiểm tra path repo: tồn tại + là git repo (có .git). Trả thông báo lỗi hoặc null nếu OK. */
function validateRepoPath(repoPath: string): string | null {
  if (!repoPath) return 'Thiếu repo_path.';
  if (!existsSync(repoPath)) return `Đường dẫn không tồn tại trên máy chủ: ${repoPath}`;
  if (!existsSync(join(repoPath, '.git'))) return `Thư mục không phải git repo (thiếu .git): ${repoPath}. Hãy git clone trước.`;
  return null;
}

export function reposRouter(): Router {
  const router = Router();

  // Danh sách cấu hình repo theo board.
  router.get('/repos', wrap(async (_req, res) => {
    res.json({ items: RepoConfigRepository.list(), defaultRepoPath: config.GIT_REPO_PATH });
  }));

  // Liệt kê board Trello đang giám sát (TRELLO_BOARD_IDS) kèm tên — giúp chọn board khi map.
  router.get('/repos/boards', wrap(async (_req, res) => {
    const out: Array<{ id: string; name: string; mapped: boolean }> = [];
    for (const id of config.TRELLO_BOARD_IDS) {
      let name = id;
      try { const lists = await TrelloClient.getLists(id); name = lists.length ? id : id; } catch { /* giữ id */ }
      out.push({ id, name, mapped: !!RepoConfigRepository.getByBoard(id) });
    }
    res.json({ items: out });
  }));

  // Tạo cấu hình repo cho 1 board.
  router.post('/repos', wrap(async (req, res) => {
    const { board_id, name, repo_path, base_branch, enabled } = req.body ?? {};
    if (!board_id || !name || !repo_path) {
      res.status(400).json({ error: 'Cần board_id, name, repo_path.' }); return;
    }
    if (RepoConfigRepository.getByBoard(String(board_id))) {
      res.status(409).json({ error: 'Board này đã được cấu hình. Hãy sửa bản ghi hiện có.' }); return;
    }
    const pathErr = validateRepoPath(String(repo_path));
    if (pathErr) { res.status(400).json({ error: pathErr }); return; }

    const row = RepoConfigRepository.create({
      board_id: String(board_id), name: String(name), repo_path: String(repo_path),
      base_branch: base_branch ? String(base_branch) : undefined,
      enabled: enabled === false ? false : true,
    });
    log.info({ boardId: row.board_id, repoPath: row.repo_path }, 'Repo config created');
    // Prewarm cache hiểu dự án NGAY (chạy nền) để các luồng sau dùng — không chặn response.
    void ProjectKnowledge.ensureFresh(row.repo_path, row.base_branch).catch(err =>
      log.warn({ repoPath: row.repo_path, err: (err as Error).message }, 'Prewarm cache nền lỗi — bỏ qua'));
    res.json({ ok: true, item: row });
  }));

  // Sửa cấu hình repo.
  router.put('/repos/:id', wrap(async (req, res) => {
    const existing = RepoConfigRepository.getById(String(req.params.id));
    if (!existing) { res.status(404).json({ error: 'Cấu hình không tồn tại.' }); return; }
    const { name, repo_path, base_branch, enabled } = req.body ?? {};
    if (repo_path !== undefined) {
      const pathErr = validateRepoPath(String(repo_path));
      if (pathErr) { res.status(400).json({ error: pathErr }); return; }
    }
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = String(name);
    if (repo_path !== undefined) patch.repo_path = String(repo_path);
    if (base_branch !== undefined) patch.base_branch = String(base_branch);
    if (enabled !== undefined) patch.enabled = enabled ? 1 : 0;
    RepoConfigRepository.update(existing.id, patch);
    res.json({ ok: true, item: RepoConfigRepository.getById(existing.id) });
  }));

  // Xoá cấu hình repo.
  router.delete('/repos/:id', wrap(async (req, res) => {
    const existing = RepoConfigRepository.getById(String(req.params.id));
    if (!existing) { res.status(404).json({ error: 'Cấu hình không tồn tại.' }); return; }
    RepoConfigRepository.remove(existing.id);
    log.info({ id: existing.id, boardId: existing.board_id }, 'Repo config deleted');
    res.json({ ok: true });
  }));

  return router;
}
