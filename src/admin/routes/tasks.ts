import { Router } from 'express';
import type { Request, Response } from 'express';
import { TaskRepository } from '../../state/TaskRepository.js';
import type { TaskStatus } from '../../state/TaskRepository.js';
import { GitOperationRepository } from '../../state/GitOperationRepository.js';
import { UsageRepository } from '../../state/UsageRepository.js';
import { getDb } from '../../state/db.js';
import { TrelloClient } from '../../trello/TrelloClient.js';
import { config } from '../../config.js';
import { childLogger } from '../../utils/logger.js';
import type { WorkerRegistry } from '../../supervisor/WorkerRegistry.js';

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

export function tasksRouter(registry: WorkerRegistry): Router {
  const router = Router();

  // Gửi lệnh tới worker (qua IPC) rồi map kết quả → HTTP.
  const sendCmd = async (res: Response, repoKey: string, cmd: 'rerun' | 'modify' | 'cancel', taskId: string, payload?: { instruction?: string }): Promise<void> => {
    const r = await registry.sendCommand(repoKey, cmd, taskId, payload);
    if (r.ok) { res.json({ ok: true, ...(r.data && typeof r.data === 'object' ? r.data : {}) }); return; }
    const code = r.code ?? 'error';
    const status = code === 'in_flight' ? 409 : code === 'not_found' ? 404 : code === 'bad_request' ? 400 : code === 'no_worker' ? 503 : code === 'timeout' ? 504 : 500;
    res.status(status).json({ error: r.error ?? 'Lỗi thực thi' });
  };

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

    // Token/chi phí của task. Label các stage dùng key = card_id.slice(0,6) (xem *Agent.ts) → tra đúng prefix đó.
    const usage = UsageRepository.forTask(task.card_id.slice(0, 6));

    res.json({ task, gitOps, reviews, comments, usage });
  }));

  // Chạy lại task ở ĐÚNG stage hiện tại của card — worker thực thi (có ngữ cảnh repo).
  router.post('/tasks/:id/rerun', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }
    await sendCmd(res, task.repo_key || 'default', 'rerun', task.id);
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
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
    await TrelloClient.addComment(task.card_id,
      `👤 **[ADMIN]** Lập lại kế hoạch${instruction ? ` theo yêu cầu:\n> ${instruction}` : '.'}`).catch(() => {});
    await sendCmd(res, task.repo_key || 'default', 'modify', task.id, { instruction });
  }));

  // Hủy task — worker dọn worktree (có ngữ cảnh repo).
  router.post('/tasks/:id/cancel', wrap(async (req, res) => {
    const task = TaskRepository.findById(String(req.params.id));
    if (!task) { res.status(404).json({ error: 'Task không tồn tại' }); return; }
    await sendCmd(res, task.repo_key || 'default', 'cancel', task.id);
  }));

  return router;
}

function safeJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}
