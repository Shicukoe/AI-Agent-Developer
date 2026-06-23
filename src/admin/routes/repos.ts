import { Router } from 'express';
import type { Request, Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { RepoConfigRepository } from '../../state/RepoConfigRepository.js';
import { TrelloClient } from '../../trello/TrelloClient.js';
import { BoardProvisioner } from '../../trello/BoardProvisioner.js';
import { generateDocs } from '../../scripts/gen-docs.js';
import { config } from '../../config.js';
import { childLogger } from '../../utils/logger.js';
import type { WorkerRegistry } from '../../supervisor/WorkerRegistry.js';

const log = childLogger('admin-repos');

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response): void => {
    fn(req, res).catch((err: unknown) => {
      log.error({ err, path: req.path }, 'Admin repos route error');
      if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    });
  };
}

/** Chuẩn hoá danh sách repo ngữ cảnh về JSON array string (nhận mảng hoặc chuỗi nhiều dòng/;). undefined nếu rỗng. */
function normalizeContextPaths(raw: unknown): string | undefined {
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw.map(s => String(s).trim());
  else if (typeof raw === 'string') arr = raw.split(/[\r\n;]+/).map(s => s.trim());
  arr = arr.filter(Boolean);
  return arr.length ? JSON.stringify(arr) : undefined;
}

/** Kiểm tra path repo: tồn tại + là git repo (có .git). Trả thông báo lỗi hoặc null nếu OK. */
function validateRepoPath(repoPath: string): string | null {
  if (!repoPath) return 'Thiếu repo_path.';
  if (!existsSync(repoPath)) return `Đường dẫn không tồn tại trên máy chủ: ${repoPath}`;
  if (!existsSync(join(repoPath, '.git'))) return `Thư mục không phải git repo (thiếu .git): ${repoPath}. Hãy git clone trước.`;
  return null;
}

export function reposRouter(registry: WorkerRegistry): Router {
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
    const { board_id, name, repo_path, base_branch, enabled, docs_path } = req.body ?? {};
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
      docs_path: docs_path ? String(docs_path) : undefined,
      context_repo_paths: normalizeContextPaths(req.body?.context_repo_paths),
    });
    log.info({ boardId: row.board_id, repoPath: row.repo_path }, 'Repo config created');
    registry.reconcile();   // spawn worker cho dự án mới

    // Tự chuẩn bị board: tạo list stage + label điều khiển còn thiếu (khỏi tạo tay). Lỗi Trello KHÔNG chặn tạo repo.
    let provision: Awaited<ReturnType<typeof BoardProvisioner.provision>> | { error: string };
    try {
      provision = await BoardProvisioner.provision(row.board_id);
    } catch (err) {
      provision = { error: err instanceof Error ? err.message : 'Không provision được board' };
      log.warn({ boardId: row.board_id, err }, 'Provision board lỗi (bỏ qua, có thể tạo thủ công)');
    }
    res.json({ ok: true, item: row, provision });
  }));

  // Chuẩn bị lại board thủ công (tạo list/label còn thiếu) cho 1 repo đã cấu hình.
  router.post('/repos/:id/provision', wrap(async (req, res) => {
    const cfg = RepoConfigRepository.getById(String(req.params.id));
    if (!cfg) { res.status(404).json({ error: 'Cấu hình không tồn tại.' }); return; }
    const provision = await BoardProvisioner.provision(cfg.board_id);
    res.json({ ok: true, provision });
  }));

  // Sửa cấu hình repo.
  router.put('/repos/:id', wrap(async (req, res) => {
    const existing = RepoConfigRepository.getById(String(req.params.id));
    if (!existing) { res.status(404).json({ error: 'Cấu hình không tồn tại.' }); return; }
    const { name, repo_path, base_branch, enabled, docs_path } = req.body ?? {};
    if (repo_path !== undefined) {
      const pathErr = validateRepoPath(String(repo_path));
      if (pathErr) { res.status(400).json({ error: pathErr }); return; }
    }
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = String(name);
    if (repo_path !== undefined) patch.repo_path = String(repo_path);
    if (base_branch !== undefined) patch.base_branch = String(base_branch);
    if (enabled !== undefined) patch.enabled = enabled ? 1 : 0;
    if (docs_path !== undefined) patch.docs_path = String(docs_path).trim() || null;
    if (req.body?.context_repo_paths !== undefined) patch.context_repo_paths = normalizeContextPaths(req.body.context_repo_paths) ?? null;
    RepoConfigRepository.update(existing.id, patch);
    registry.reconcile();   // restart worker nếu repo/branch/docs/enabled đổi
    res.json({ ok: true, item: RepoConfigRepository.getById(existing.id) });
  }));

  // Sinh tài liệu dự án (gen-docs) cho repo — chạy NỀN (việc nặng), người review + commit docs sau.
  // body.mode: 'continue' = giữ file cũ, bổ sung phần thiếu · 'deepen' = giữ mọi file, viết lại sâu file mỏng ·
  //            'full' = sinh lại toàn bộ · (trống) = auto/incremental.
  router.post('/repos/:id/gen-docs', wrap(async (req, res) => {
    const cfg = RepoConfigRepository.getById(String(req.params.id));
    if (!cfg) { res.status(404).json({ error: 'Cấu hình không tồn tại.' }); return; }
    const docsPath = cfg.docs_path?.trim() || join(cfg.repo_path, 'docs');
    const mode = String(req.body?.mode || '');
    const opts = { full: mode === 'full', continue: mode === 'continue', deepen: mode === 'deepen' };
    void generateDocs(cfg.repo_path, docsPath, opts).catch(err =>
      log.error({ repoPath: cfg.repo_path, err: (err as Error).message }, 'gen-docs nền lỗi'));
    log.info({ repoPath: cfg.repo_path, docsPath, mode: mode || 'auto' }, 'gen-docs nền: bắt đầu');
    const label = mode === 'continue' ? 'bổ sung phần thiếu' : mode === 'deepen' ? 'làm sâu file mỏng' : mode === 'full' ? 'sinh lại toàn bộ' : 'auto';
    res.json({ ok: true, message: `Đang sinh tài liệu (${label}) nền vào ${docsPath}. Xem log; xong thì review + commit.` });
  }));

  // Xoá cấu hình repo.
  router.delete('/repos/:id', wrap(async (req, res) => {
    const existing = RepoConfigRepository.getById(String(req.params.id));
    if (!existing) { res.status(404).json({ error: 'Cấu hình không tồn tại.' }); return; }
    RepoConfigRepository.remove(existing.id);
    registry.reconcile();   // dừng worker của dự án đã xoá
    log.info({ id: existing.id, boardId: existing.board_id }, 'Repo config deleted');
    res.json({ ok: true });
  }));

  return router;
}
