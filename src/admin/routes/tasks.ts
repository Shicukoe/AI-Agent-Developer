import { Router } from 'express';
import type { Request, Response } from 'express';
import { TaskRepository } from '../../state/TaskRepository.js';
import type { TaskStatus } from '../../state/TaskRepository.js';
import { GitOperationRepository } from '../../state/GitOperationRepository.js';
import { getDb } from '../../state/db.js';
import { TrelloClient } from '../../trello/TrelloClient.js';
import { StageRouter } from '../../agents/StageRouter.js';
import { WorktreeManager } from '../../git/WorktreeManager.js';
import { config, stageForListName } from '../../config.js';
import { childLogger } from '../../utils/logger.js';

const log = childLogger('admin-tasks');

/** Nhóm status "cần admin để mắt" — mặc định của bộ lọc dashboard. */
const PROBLEM_STATUSES: TaskStatus[] = ['failed', 'halted', 'review_failed', 'awaiting_clarification'];
/** Status đang chạy dở — không cho can thiệp giữa chừng (giống ConfirmationManager.IN_FLIGHT). */
const IN_FLIGHT: ReadonlySet<string> = new Set(['processing', 'developing', 'testing']);

const ALL_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
  'queued', 'processing', 'paused_for_confirmation', 'paused_for_plan_approval', 'waiting_review',
  'completed', 'failed', 'halted', 'awaiting_clarification', 'awaiting_plan_approval',
  'plan_approved', 'developing', 'dev_done', 'testing', 'review_failed',
]);

/** Bọc handler async: lỗi trả JSON 500, không throw ra ngoài làm chết process agent. */
function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response): void => {
    fn(req, res).catch((err: unknown) => {
      log.error({ err, path: req.path }, 'Admin route error');
      if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    });
  };
}

interface ReviewRow {
  id: string; task_id: string; attempt: number; verdict: string;
  issues: string | null; summary: string | null; reviewed_at: number;
}

export function tasksRouter(): Router {
  const router = Router();

  // Thống kê cho dashboard: tổng + gom theo status + số task "có vấn đề".
  router.get('/stats', wrap(async (_req, res) => {
    const byStatus = TaskRepository.countByStatus();
    res.json({
      total: TaskRepository.count(),
      byStatus,
      problems: TaskRepository.count(PROBLEM_STATUSES),
    });
  }));

  // Danh sách task, lọc theo status (CSV) hoặc nhóm "problems", tìm theo tên, phân trang.
  router.get('/tasks', wrap(async (req, res) => {
    let statuses: TaskStatus[] | undefined;
    const statusParam = typeof req.query.status === 'string' ? req.query.status : '';
    if (statusParam === 'problems') {
      statuses = PROBLEM_STATUSES;
    } else if (statusParam) {
      statuses = statusParam.split(',').map(s => s.trim()).filter(s => ALL_STATUSES.has(s)) as TaskStatus[];
    }
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;

    const items = TaskRepository.list({ statuses, q, limit, offset });
    res.json({
      items,
      total: TaskRepository.count(statuses),
      limit,
      offset,
      defaultRepoPath: config.GIT_REPO_PATH,
    });
  }));

  // Chi tiết 1 task: bản ghi + git ops + review results + comment Trello (best-effort).
  router.get('/tasks/:id', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }

    const gitOps = GitOperationRepository.getByTask(task.id);
    const reviews = (getDb()
      .prepare('SELECT * FROM review_results WHERE task_id = ? ORDER BY reviewed_at ASC')
      .all(task.id) as ReviewRow[])
      .map(r => ({ ...r, issues: safeJson(r.issues) }));

    // Comment Trello (gồm 🧠 memory + phản hồi admin). Lỗi mạng không được làm hỏng response.
    let comments: Array<{ id: string; text: string; memberId: string; date: string }> = [];
    try {
      comments = await TrelloClient.getCardComments(task.card_id, 30);
    } catch (err) {
      log.warn({ taskId: task.id, err }, 'Không lấy được comment Trello cho chi tiết task');
    }

    res.json({ task, gitOps, reviews, comments });
  }));

  // Chạy lại task ở ĐÚNG stage hiện tại của card (kéo card = chuyển stage, ở đây ta tự suy ra).
  router.post('/tasks/:id/rerun', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }
    if (IN_FLIGHT.has(task.status)) {
      res.status(409).json({ error: `Task đang chạy (${task.status}), không thể chạy lại lúc này.` });
      return;
    }

    const card = await TrelloClient.getCard(task.card_id);
    const lists = await TrelloClient.getLists(card.idBoard);
    const list = lists.find(l => l.id === card.idList);
    const stage = list ? stageForListName(list.name) : null;
    if (!stage) {
      res.status(400).json({ error: 'Card hiện không nằm trong list stage nào (Refine/Planning/Dev/Test/Epic).' });
      return;
    }

    StageRouter.dispatch(stage, card, card.idList);
    log.info({ taskId: task.id, stage }, 'Admin rerun dispatched');
    res.json({ ok: true, stage });
  }));

  // Bổ sung thông tin: đẩy comment lên card để agent nạp lại khi chạy lại (cơ chế CardMemory).
  router.post('/tasks/:id/comment', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) { res.status(400).json({ error: 'Thiếu nội dung comment.' }); return; }

    await TrelloClient.addComment(task.card_id, `👤 **[ADMIN]** ${text}`);
    res.json({ ok: true });
  }));

  // Lập lại kế hoạch theo hướng dẫn mới (tương đương comment "MODIFY: ..." nhưng gọi thẳng lever,
  // không vướng gating ADMIN_TRELLO_MEMBER_IDS của ConfirmationManager).
  router.post('/tasks/:id/modify', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }
    if (IN_FLIGHT.has(task.status)) {
      res.status(409).json({ error: `Task đang chạy (${task.status}), không thể lập lại kế hoạch lúc này.` });
      return;
    }
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
    await TrelloClient.addComment(task.card_id,
      `👤 **[ADMIN]** Lập lại kế hoạch${instruction ? ` theo yêu cầu:\n> ${instruction}` : '.'}`).catch(() => {});
    // Chạy nền (runPlanning tự enqueue/handle lỗi) — không chờ để response nhanh.
    void StageRouter.runPlanning(task, instruction || undefined);
    log.info({ taskId: task.id }, 'Admin modify/re-plan dispatched');
    res.json({ ok: true });
  }));

  // Hủy task: đánh dấu failed, dọn worktree, báo lên card.
  router.post('/tasks/:id/cancel', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }

    TaskRepository.setStatus(task.id, 'failed', { error_message: 'Hủy bởi admin (backend)' });
    if (task.worktree_path) await WorktreeManager.remove(task.id).catch(() => {});
    await TrelloClient.addComment(task.card_id, '❌ **[ADMIN]** Task đã bị hủy từ admin backend.').catch(() => {});
    log.info({ taskId: task.id }, 'Admin cancelled task');
    res.json({ ok: true });
  }));

  return router;
}

function safeJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}
