import { existsSync, readFileSync } from 'fs';
import { TrelloClient } from '../trello/TrelloClient.js';
import { WorktreeManager } from '../git/WorktreeManager.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { RefineAgent } from './RefineAgent.js';
import { PlannerAgent } from './PlannerAgent.js';
import { DevAgent } from './DevAgent.js';
import { taskKind } from './executors/types.js';
import { pickExecutor } from './executors/registry.js';
import { ReviewAgent } from './ReviewAgent.js';
import { CardMemory } from './CardMemory.js';
import { EpicManager } from './EpicManager.js';
import { OrchestratorAgent } from './OrchestratorAgent.js';
import type { PlanResponse } from '../claude/types.js';
import { TaskQueue } from '../queue/TaskQueue.js';
import { config, hasPlanApproveLabel } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { Stage, TrelloCard } from '../trello/types.js';

const log = childLogger('stage-router');

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Nhãn tiếng Việt cho từng stage, dùng trong comment "đã nhận xử lý". */
const STAGE_LABEL: Record<Stage, string> = {
  refine: 'Làm rõ task (Refine)',
  epic: 'Lập kế hoạch Epic',
  planning: 'Lập kế hoạch (Planning)',
  dev: 'Code (Dev)',
  test: 'Review (Test)',
};

/** Find the single Task for a card, or create one. One Task per card across all stages. */
function findOrCreateTask(card: TrelloCard, listId: string): Task {
  const existing = TaskRepository.findByCardId(card.id);
  if (existing) {
    TaskRepository.update(existing.id, { list_id: listId, card_name: card.name });
    return TaskRepository.findById(existing.id)!;
  }
  return TaskRepository.create({
    card_id: card.id,
    board_id: card.idBoard,
    list_id: listId,
    card_name: card.name,
  });
}

export const StageRouter = {
  /** Entry point when a card enters a stage list (caller has already verified the AI label). */
  dispatch(stage: Stage, card: TrelloCard, listId: string): void {
    const task = findOrCreateTask(card, listId);
    log.info({ taskId: task.id, cardId: card.id, stage }, 'Dispatching stage');

    TaskQueue.run(task.id, async () => {
      const fresh = TaskRepository.findById(task.id)!;
      // Báo cho người dùng biết agent đã nhận task và bắt đầu xử lý (job vừa rời hàng đợi).
      await TrelloClient.addComment(fresh.card_id,
        `🤖 **[AI AGENT]** Đã nhận task, bắt đầu xử lý: **${STAGE_LABEL[stage]}**…`).catch(() => {});
      switch (stage) {
        case 'refine': await this.runRefine(fresh); break;
        case 'epic': await this.runEpicPlanning(fresh); break;
        case 'planning': await this.runPlanning(fresh); break;
        case 'dev': await this.runDev(fresh); break;
        case 'test': await this.runTest(fresh); break;
      }
    });
  },

  /** Refine stage: làm rõ & chuẩn hoá task sơ sài trước khi sang Planning/Dev. */
  async runRefine(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'runRefine');
    try {
      TaskRepository.setStatus(task.id, 'processing');
      TaskRepository.heartbeat(task.id);
      await RefineAgent.run(task);
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /** Epic stage: lập kế hoạch tổng cho feature lớn; khi chốt sẽ sinh card con (xem onPlanApprove). */
  async runEpicPlanning(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'runEpicPlanning');
    try {
      TaskRepository.setStatus(task.id, 'processing');
      TaskRepository.heartbeat(task.id);

      const plan = await PlannerAgent.run(task);
      // Lưu plan JSON để khi chốt còn sinh card con (PLAN.md là markdown, không tiện parse lại)
      TaskRepository.update(task.id, {
        task_type: 'epic',
        metadata: JSON.stringify({ epic_plan: plan }),
      });
      TaskRepository.setStatus(task.id, 'awaiting_plan_approval');
      await TrelloClient.addComment(task.card_id,
        '🧩 **[AI AGENT]** Đây là **EPIC**. Khi bạn gắn nhãn **`plan approve`**, tôi sẽ tự tạo các card con để thực thi.');

      // If the approval label was added while planning was still running, create children now.
      const card = await TrelloClient.getCard(task.card_id);
      if (hasPlanApproveLabel(card.labels ?? [])) {
        await this.onPlanApprove(task.card_id);
      }
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /** Planning stage: classify + produce/refine an overall plan, then wait for the plan-approve label. */
  async runPlanning(task: Task, modifyInstruction?: string): Promise<void> {
    log.info({ taskId: task.id, modify: !!modifyInstruction }, 'runPlanning');
    try {
      TaskRepository.setStatus(task.id, 'processing');
      TaskRepository.heartbeat(task.id);

      const card = await TrelloClient.getCard(task.card_id);
      const decision = RuleEngine.evaluate(card);
      TaskRepository.update(task.id, {
        task_type: decision.taskType,
        rule_decision: JSON.stringify(decision),
      });

      await PlannerAgent.run(task, modifyInstruction);

      TaskRepository.setStatus(task.id, 'awaiting_plan_approval');
      log.info({ taskId: task.id }, 'Plan posted, awaiting plan-approve label');
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /** Plan-approve label added: lock the plan and wait for the user to drag the card to Dev. */
  async onPlanApprove(cardId: string): Promise<void> {
    const task = TaskRepository.findByCardId(cardId);
    if (!task) {
      log.debug({ cardId }, 'Plan-approve label on untracked card — ignored');
      return;
    }
    // Nếu planner vẫn đang chạy (status 'processing'/'queued'), không set vội — khi planner xong sẽ
    // chuyển sang 'awaiting_plan_approval', và Dev vẫn nhận diện được qua NHÃN trên card (xem runDev).
    if (task.status !== 'awaiting_plan_approval' && task.status !== 'plan_approved') {
      log.info({ taskId: task.id, status: task.status }, 'Plan-approve label nhận trước khi plan xong — sẽ dựa vào nhãn ở bước Dev');
      return;
    }
    if (task.status === 'plan_approved') return;
    TaskRepository.setStatus(task.id, 'plan_approved');

    // Epic: sinh card con thay vì chờ kéo sang Dev
    if (task.task_type === 'epic') {
      try {
        const meta = task.metadata ? JSON.parse(task.metadata) as { epic_plan?: PlanResponse } : {};
        if (!meta.epic_plan) {
          await TrelloClient.addComment(cardId, '⚠️ **[AI AGENT]** Không tìm thấy plan của epic để tạo card con. Hãy lập lại plan (reply `RETRY`).');
          return;
        }
        const n = await EpicManager.createChildren(task, meta.epic_plan);
        log.info({ taskId: task.id, children: n }, 'Epic children created');
      } catch (err) {
        await OrchestratorAgent.handleError(task, err);
      }
      return;
    }

    await TrelloClient.addComment(cardId,
      '✅ **[AI AGENT]** Kế hoạch đã chốt. Kéo card sang list **Dev** để bắt đầu code.');
    log.info({ taskId: task.id }, 'Plan approved');
  },

  /** Dev stage: implement directly per the approved plan on a single feature branch. */
  async runDev(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'runDev');

    const card = await TrelloClient.getCard(task.card_id);
    const hasPlanFile = !!task.plan_file_path && existsSync(task.plan_file_path);

    // Task còn chờ làm rõ (Refine đã đặt câu hỏi) → hướng dẫn hoàn tất Refine trước, không báo "thiếu plan".
    if (!hasPlanFile && task.status === 'awaiting_clarification') {
      await TrelloClient.addComment(task.card_id,
        '⚠️ **[AI AGENT]** Task chưa được làm rõ xong (còn câu hỏi chờ trả lời). Bổ sung thông tin vào card rồi reply `REFINE` (hoặc kéo card về list **Refine**) trước khi sang Dev.');
      return;
    }

    // Plan được coi là đã duyệt nếu: status đã ở/đi qua giai đoạn duyệt (plan_approved, hoặc đã từng
    // dev/test — re-dev sau review_failed) HOẶC card đang có nhãn plan-approve (tránh đua khi gắn nhãn
    // lúc planner còn chạy). Card nhỏ qua Refine không có nhãn nên dựa vào status.
    const PAST_APPROVAL = new Set(['plan_approved', 'developing', 'dev_done', 'testing', 'review_failed']);
    const approved = PAST_APPROVAL.has(task.status) || hasPlanApproveLabel(card.labels ?? []);
    if (!approved) {
      await TrelloClient.addComment(task.card_id,
        '⚠️ **[AI AGENT]** Task chưa sẵn sàng để code. Kéo vào list **Refine** (task nhỏ) hoặc **Planning** để chuẩn bị, hoặc gắn nhãn **`plan approve`**.');
      return;
    }

    // Chọn executor theo kind đã phân loại (RefineAgent). 'code' → DevAgent (luồng git bên dưới);
    // các kind khác → executor chuyên biệt. Không có executor phù hợp → báo admin và dừng.
    const kind = taskKind(task);
    if (kind !== 'code') {
      const executor = pickExecutor(kind);
      if (!executor) {
        TaskRepository.setStatus(task.id, 'halted', { error_message: `Không có executor cho kind '${kind}'` });
        await TrelloClient.addComment(task.card_id,
          `🛑 **[AI AGENT]** Không tìm thấy agent phù hợp để thực thi task loại \`${kind}\`. ` +
          `Admin cần bổ sung executor cho loại này hoặc đổi loại task (kéo về **Refine** để phân loại lại). Task tạm dừng.`);
        log.warn({ taskId: task.id, kind }, 'No executor registered for kind');
        return;
      }
      try {
        TaskRepository.setStatus(task.id, 'developing');
        TaskRepository.heartbeat(task.id);
        log.info({ taskId: task.id, kind, executor: executor.label }, 'Running executor');
        await executor.run(task);
      } catch (err) {
        await OrchestratorAgent.handleError(task, err);
      }
      return;
    }

    try {
      TaskRepository.setStatus(task.id, 'developing');
      TaskRepository.heartbeat(task.id);

      // Reuse an existing worktree (e.g. re-dev after review_failed); otherwise create a fresh one.
      let branchName = task.branch_name ?? undefined;
      let worktreePath = task.worktree_path ?? undefined;
      if (!worktreePath || !WorktreeManager.exists(task.id)) {
        branchName = `feature/${task.card_id.slice(0, 8)}-${slugify(card.name)}`;
        worktreePath = await WorktreeManager.add(task.id, branchName, config.GIT_DEFAULT_BASE_BRANCH);
        TaskRepository.update(task.id, { branch_name: branchName, worktree_path: worktreePath });
      }

      const fresh = TaskRepository.findById(task.id)!;
      // Spec cho DevAgent: ưu tiên PLAN.md; nếu không có (task nhỏ qua Refine), dùng mô tả card đã chuẩn hoá.
      const planContext = hasPlanFile
        ? readFileSync(task.plan_file_path!, 'utf8')
        : `# ${card.name}\n\n${card.desc || '(không có mô tả)'}`;
      const result = await DevAgent.run(fresh, planContext);

      // DevAgent sets status 'halted' on its own failure — don't overwrite that.
      const after = TaskRepository.findById(task.id)!;
      if (after.status === 'halted' || after.status === 'paused_for_confirmation') return;

      // Không có thay đổi file → KHÔNG báo "Code xong"/không cho sang Test (sẽ FAIL "No changes").
      if (!result.committed) {
        TaskRepository.setStatus(task.id, 'review_failed', { error_message: 'DevAgent không tạo thay đổi file' });
        await TrelloClient.addComment(task.card_id,
          '⚠️ **[AI AGENT]** DevAgent kết thúc nhưng **không tạo thay đổi file nào** — chưa thể sang Test.\n' +
          'Nếu là task viết tài liệu, hãy nêu rõ **đường dẫn file cần tạo** (vd `docs/huong-dan-firebase.md`) trong mô tả card rồi kéo lại **Dev**.');
        return;
      }

      TaskRepository.setStatus(task.id, 'dev_done');
      await TrelloClient.addComment(task.card_id,
        `✅ **[AI AGENT]** Code xong trên branch \`${branchName}\`. Kéo card sang list **Test** để review.`);
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /** Test stage: independent AI code review of the branch diff. */
  async runTest(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'runTest');

    if (!task.worktree_path || !WorktreeManager.exists(task.id)) {
      await TrelloClient.addComment(task.card_id,
        '⚠️ **[AI AGENT]** Chưa có code để review. Kéo card qua list **Dev** trước.');
      return;
    }

    try {
      TaskRepository.setStatus(task.id, 'testing');
      TaskRepository.heartbeat(task.id);

      const fresh = TaskRepository.findById(task.id)!;
      const result = await ReviewAgent.review(fresh, []);

      if (result.verdict === 'PASS') {
        TaskRepository.setStatus(task.id, 'completed');
        await TrelloClient.addComment(task.card_id,
          `✅ **[AI AGENT]** Review PASS. Branch \`${fresh.branch_name}\` sẵn sàng merge vào \`${config.GIT_DEFAULT_BASE_BRANCH}\`.`);
        // Nếu là card con của một epic: tick tiến độ trên epic
        await EpicManager.markChildDone(fresh);
      } else {
        TaskRepository.setStatus(task.id, 'review_failed');
        // Ghi memory các vấn đề cần sửa để khi kéo lại Dev, DevAgent nạp được
        const issueLines = result.issues
          .map(i => `- ${i.file ? `\`${i.file}${i.line ? `:${i.line}` : ''}\`: ` : ''}${i.description}${i.suggestion ? ` → ${i.suggestion}` : ''}`)
          .join('\n');
        await CardMemory.post(task.card_id, 'Review FAIL — cần sửa',
          `${result.summary}\n\n**Vấn đề:**\n${issueLines || '—'}`).catch(() => {});
        await TrelloClient.addComment(task.card_id,
          '❌ **[AI AGENT]** Review FAIL. Kéo card lại list **Dev** để sửa (chi tiết đã ghi vào memory).');
      }
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },
};
