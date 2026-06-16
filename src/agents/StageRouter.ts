import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { TrelloClient } from '../trello/TrelloClient.js';
import { WorktreeManager } from '../git/WorktreeManager.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { ProjectKnowledge } from './ProjectKnowledge.js';
import { RepoRegistry, type ResolvedRepo } from '../repos/RepoRegistry.js';
import { TriageAgent } from './TriageAgent.js';
import { BusinessAnalystAgent } from './BusinessAnalystAgent.js';
import { TechnicalRefinerAgent } from './TechnicalRefinerAgent.js';
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
import { config, hasPlanApproveLabel, hasQuickLabel } from '../config.js';
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
function findOrCreateTask(card: TrelloCard, listId: string, repo: ResolvedRepo): Task {
  const existing = TaskRepository.findByCardId(card.id);
  if (existing) {
    TaskRepository.update(existing.id, {
      list_id: listId, card_name: card.name,
      repo_key: repo.repoKey, repo_path: repo.repoPath,
    });
    return TaskRepository.findById(existing.id)!;
  }
  return TaskRepository.create({
    card_id: card.id,
    board_id: card.idBoard,
    list_id: listId,
    card_name: card.name,
    repo_key: repo.repoKey,
    repo_path: repo.repoPath,
  });
}

export const StageRouter = {
  /** Entry point when a card enters a stage list (caller has already verified the AI label). */
  dispatch(stage: Stage, card: TrelloCard, listId: string): void {
    // Xác định repo của card theo BOARD. Board chưa cấu hình (khi đã có cấu hình khác) → nhắc admin, KHÔNG tạo Task.
    const repo = RepoRegistry.resolveForBoard(card.idBoard);
    if ('error' in repo) {
      log.warn({ cardId: card.id, boardId: card.idBoard, stage }, 'Repo chưa xác định cho board — chờ cấu hình admin');
      TrelloClient.addComment(card.id, `🗂️ **[AI AGENT]** ${repo.error}`).catch(() => {});
      return;
    }

    const isNew = !TaskRepository.findByCardId(card.id);
    const task = findOrCreateTask(card, listId, repo);
    log.info({ taskId: task.id, cardId: card.id, stage, repo: repo.name }, 'Dispatching stage');

    TaskQueue.run(task.id, async () => {
      const fresh = TaskRepository.findById(task.id)!;
      // Báo cho người dùng biết agent đã nhận task và bắt đầu xử lý (job vừa rời hàng đợi).
      await TrelloClient.addComment(fresh.card_id,
        `🤖 **[AI AGENT]** Đã nhận task, bắt đầu xử lý: **${STAGE_LABEL[stage]}**…`).catch(() => {});
      // Lần đầu nhận card: comment xác nhận repo + base branch để người dùng biết card thuộc dự án nào.
      if (isNew) {
        await TrelloClient.addComment(fresh.card_id,
          `📦 **[AI AGENT]** Dự án/repo: **${repo.name}** (\`${repo.repoPath}\`) · base branch \`${repo.baseBranch}\``).catch(() => {});
      }
      switch (stage) {
        case 'refine': await this.runRefine(fresh); break;
        case 'epic': await this.runEpicPlanning(fresh); break;
        case 'planning': await this.runPlanning(fresh); break;
        case 'dev': await this.runDev(fresh); break;
        case 'test': await this.runTest(fresh); break;
      }
    });
  },

  /** Refine stage: triage (fast-path task tí hon) → nếu không, làm rõ & chuẩn hoá. */
  async runRefine(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'runRefine');
    try {
      TaskRepository.setStatus(task.id, 'processing');
      TaskRepository.heartbeat(task.id);

      const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
      // Dựng/cập nhật cache hiểu dự án CHẠY NỀN — KHÔNG chặn refine. Cold-start quét repo lớn rất nặng
      // (có thể timeout); để nền thì refine đi tiếp ngay, agent đọc repo trực tiếp khi chưa có cache,
      // cache sẵn sàng cho các task sau.
      void ProjectKnowledge.ensureFresh(repoPath).catch(err =>
        log.warn({ taskId: task.id, err: (err as Error).message }, 'ensureFresh cache nền lỗi — bỏ qua'));

      const card = await TrelloClient.getCard(task.card_id);

      // Triage rẻ: task tí hon → fast-path thẳng Dev (bỏ Refine + Planning).
      const triage = await TriageAgent.run(card, repoPath);
      TaskRepository.mergeMetadata(task.id, { triage: { trivial: triage.trivial, source: triage.source } });
      if (triage.trivial) {
        await this.fastPathToDev(task, card, triage.spec ?? card.desc ?? card.name, triage.source);
        return;
      }

      // BA phân tích nghiệp vụ (KHÔNG tạo card con) → truyền in-flight cho Tech (kỹ thuật).
      const analyst = await BusinessAnalystAgent.run(task);

      // Thiếu thông tin → chờ admin làm rõ.
      const needsInfo = (analyst.open_questions?.length ?? 0) > 0 || (analyst.confidence ?? 1) < RuleEngine.getConfidenceThreshold();
      if (needsInfo) {
        TaskRepository.setStatus(task.id, 'awaiting_clarification', { error_message: 'Waiting for clarification' });
        const qs = (analyst.open_questions ?? []).map(q => `- ❓ ${q}`).join('\n');
        await TrelloClient.addComment(task.card_id,
          `📝 **[AI AGENT] Cần làm rõ thêm (nghiệp vụ)**\n**Mục tiêu:** ${analyst.intent}\n\n${qs || '- (độ tin cậy thấp)'}\n\nBổ sung vào card rồi reply \`REFINE\` (hoặc kéo lại list **Refine**).`);
        return;
      }

      // Refine kỹ thuật + định tuyến (Dev/Planning/Epic). Nếu BA thấy nhiều đầu việc nghiệp vụ
      // (business_subtasks), Tech sẽ tự quyết epic_solve → Epic để Planner phân rã kỹ thuật.
      await TechnicalRefinerAgent.run(task, analyst);
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /** Task tí hon: ghi spec ngắn + pre-approve + hướng dẫn kéo sang Dev (bỏ Refine/Planning). */
  async fastPathToDev(task: Task, card: TrelloCard, spec: string, source: string): Promise<void> {
    const planDir = join(config.DATA_DIR, 'plans');
    mkdirSync(planDir, { recursive: true });
    const planPath = join(planDir, `${task.id}.md`);
    writeFileSync(planPath, `# Task tí hon (fast-path): ${card.name}\n\n${spec}\n`, 'utf8');
    TaskRepository.update(task.id, { plan_file_path: planPath, task_type: 'small' });
    TaskRepository.setStatus(task.id, 'plan_approved');
    await CardMemory.post(task.card_id, 'Triage (fast-path)',
      `Task tí hon (nguồn: ${source}) — bỏ qua Refine & Planning, code thẳng ở Dev để đỡ tốn token.`).catch(() => {});
    await TrelloClient.addComment(task.card_id,
      '⚡ **[AI AGENT]** Task tí hon — **bỏ qua Refine & Planning**. Kéo card sang list **Dev** để code ngay.');
    log.info({ taskId: task.id, source }, 'Fast-path: trivial → Dev');
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
        // Idempotent: nếu epic đã có card con thì KHÔNG tạo lại (tránh trùng khi onPlanApprove chạy 2 lần).
        const existing = TaskRepository.findSubTasks(task.id);
        if (existing.length > 0) {
          await TrelloClient.addComment(cardId,
            `ℹ️ **[AI AGENT]** Epic này đã có **${existing.length}** card con — bỏ qua việc tạo lại. Nếu muốn làm lại từ đầu, hãy xoá các card con cũ trước.`);
          log.info({ taskId: task.id, existing: existing.length }, 'Epic children already exist — skip createChildren');
          return;
        }
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
    // Nhãn "quick" (làm luôn) cho phép thả thẳng card vào Dev: coi card.desc là spec (fast-path từ Dev).
    const quick = hasQuickLabel(card.labels ?? []);

    // Task còn chờ làm rõ (Refine đã đặt câu hỏi) → hướng dẫn hoàn tất Refine trước, không báo "thiếu plan".
    if (!hasPlanFile && task.status === 'awaiting_clarification' && !quick) {
      await TrelloClient.addComment(task.card_id,
        '⚠️ **[AI AGENT]** Task chưa được làm rõ xong (còn câu hỏi chờ trả lời). Bổ sung thông tin vào card rồi reply `REFINE` (hoặc kéo card về list **Refine**) trước khi sang Dev.');
      return;
    }

    // Plan được coi là đã duyệt nếu: status đã ở/đi qua giai đoạn duyệt (plan_approved, hoặc đã từng
    // dev/test — re-dev sau review_failed) HOẶC card đang có nhãn plan-approve (tránh đua khi gắn nhãn
    // lúc planner còn chạy). Card nhỏ qua Refine không có nhãn nên dựa vào status.
    const PAST_APPROVAL = new Set(['plan_approved', 'developing', 'dev_done', 'testing', 'review_failed']);
    const approved = PAST_APPROVAL.has(task.status) || hasPlanApproveLabel(card.labels ?? []) || quick;
    if (!approved) {
      await TrelloClient.addComment(task.card_id,
        '⚠️ **[AI AGENT]** Task chưa sẵn sàng để code. Kéo vào list **Refine** (task nhỏ) hoặc **Planning** để chuẩn bị, hoặc gắn nhãn **`plan approve`**/**`quick`**.');
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

    // Base branch theo repo của task (đa-repo); epic child sẽ override bằng integration branch bên dưới.
    const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
    let baseBranch = RepoConfigRepository.getById(task.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
    const childMeta = EpicManager.getChildMeta(task);
    if (childMeta) {
      const epicTask = TaskRepository.findByCardId(childMeta.epic_card_id);
      if (epicTask) {
        const mySeq = childMeta.sequence ?? 0;
        const blocking = TaskRepository.findSubTasks(epicTask.id)
          .filter(s => s.id !== task.id && EpicManager.childSequence(s) < mySeq && s.status !== 'completed')
          .sort((a, b) => EpicManager.childSequence(a) - EpicManager.childSequence(b));
        if (blocking.length > 0) {
          const names = blocking.map(b => `#${EpicManager.childSequence(b)} ${b.card_name}`).join('\n- ');
          await TrelloClient.addComment(task.card_id,
            `⏳ **[AI AGENT]** Chưa tới lượt card con này (sequence ${mySeq}). Cần hoàn thành trước:\n- ${names}\n\n` +
            `Kéo lại **Dev** sau khi các card đó PASS (code của chúng sẽ có sẵn trên integration branch).`);
          log.info({ taskId: task.id, mySeq, blocking: blocking.length }, 'Dev blocked by sequence gate');
          return;
        }
      }
      if (childMeta.base_branch) baseBranch = childMeta.base_branch;
    }

    try {
      TaskRepository.setStatus(task.id, 'developing');
      TaskRepository.heartbeat(task.id);

      // Reuse an existing worktree (e.g. re-dev after review_failed); otherwise create a fresh one.
      let branchName = task.branch_name ?? undefined;
      let worktreePath = task.worktree_path ?? undefined;
      if (!worktreePath || !WorktreeManager.exists(task.id)) {
        branchName = `feature/${task.card_id.slice(0, 8)}-${slugify(card.name)}`;
        worktreePath = await WorktreeManager.add(task.id, repoPath, branchName, baseBranch);
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

    // Không có worktree của agent (luồng người tự code) → review nhánh chỉ-định trong card (read-only).
    if (!task.worktree_path || !WorktreeManager.exists(task.id)) {
      await this.runBranchReview(task);
      return;
    }

    try {
      TaskRepository.setStatus(task.id, 'testing');
      TaskRepository.heartbeat(task.id);

      const fresh = TaskRepository.findById(task.id)!;
      const result = await ReviewAgent.review(fresh, []);

      if (result.verdict === 'PASS') {
        // Card con epic (có integration branch): merge vào integration branch TRƯỚC khi đánh dấu completed.
        const childMeta = EpicManager.getChildMeta(fresh);
        if (childMeta?.base_branch) {
          const merge = await EpicManager.mergeChildIntoIntegration(fresh);
          if (!merge.ok) {
            TaskRepository.setStatus(task.id, 'review_failed');
            await CardMemory.post(task.card_id, 'Merge conflict',
              `Review PASS nhưng merge vào \`${childMeta.base_branch}\` bị conflict:\n\`\`\`\n${merge.output.slice(0, 600)}\n\`\`\``).catch(() => {});
            await TrelloClient.addComment(task.card_id,
              `⚠️ **[AI AGENT]** Review PASS nhưng **merge vào integration branch \`${childMeta.base_branch}\` bị CONFLICT**. ` +
              `Kéo lại **Dev** để rebase/sửa rồi Test lại (chi tiết đã ghi memory).`);
            return;
          }
        }

        TaskRepository.setStatus(task.id, 'completed');
        const repoBase = RepoConfigRepository.getById(fresh.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
        const mergedNote = childMeta?.base_branch
          ? ` Đã merge vào integration branch \`${childMeta.base_branch}\`.`
          : ` Branch \`${fresh.branch_name}\` sẵn sàng merge vào \`${repoBase}\`.`;
        await TrelloClient.addComment(task.card_id, `✅ **[AI AGENT]** Review PASS.${mergedNote}`);
        // Card con epic: tick tiến độ + nhắc card con kế tiếp (hoặc báo epic hoàn tất).
        if (childMeta) {
          await EpicManager.markChildDone(fresh);
          await EpicManager.announceNext(fresh);
        }
      } else {
        TaskRepository.setStatus(task.id, 'review_failed');
        // Ghi memory các vấn đề cần sửa để khi kéo lại Dev, DevAgent nạp được
        const issueLines = result.issues
          .map(i => `- ${i.file ? `\`${i.file}${i.line ? `:${i.line}` : ''}\`: ` : ''}${i.description}${i.suggestion ? ` → ${i.suggestion}` : ''}`)
          .join('\n');
        await CardMemory.post(task.card_id, 'Review FAIL — cần sửa',
          `${result.summary}\n\n**Vấn đề:**\n${issueLines || '—'}`).catch(() => {});
        await TrelloClient.addComment(task.card_id,
          '❌ **[AI AGENT]** Review FAIL. Kéo card lại list **Dev** để sửa — **không cần** qua Refine (kế hoạch/spec vẫn giữ, chi tiết lỗi đã ghi vào memory). Đang ở Dev thì chỉ cần reply `RETRY`.');
      }
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /**
   * Test cho luồng "agent làm tester": người tự code + push 1 nhánh, ghi `Branch: <tên>` trong mô tả
   * card, kéo sang Test → agent review diff `base...branch` (READ-ONLY, không đụng base). PASS thì
   * người tự merge. Không tạo worktree, không commit, không merge.
   */
  async runBranchReview(task: Task): Promise<void> {
    try {
      const card = await TrelloClient.getCard(task.card_id);
      const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
      const baseBranch = RepoConfigRepository.getById(task.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
      const branch = parseReviewBranch(card.desc);
      if (!branch) {
        await TrelloClient.addComment(task.card_id,
          '⚠️ **[AI AGENT] Chưa rõ nhánh cần review.**\n\n' +
          '**Cách dùng (bạn tự code, agent làm tester):**\n' +
          `1. Tạo nhánh từ \`${baseBranch}\`, đặt tên \`feature/<mô-tả-ngắn>\`, code xong rồi \`git push\` (đừng merge vào \`${baseBranch}\` trước).\n` +
          '2. Thêm 1 dòng vào **mô tả card**: `Branch: feature/<mô-tả-ngắn>` (đúng tên nhánh đã push).\n' +
          '3. Kéo lại list **Test**.\n\n' +
          `Agent sẽ review **chỉ-đọc** diff \`${baseBranch}...nhánh\` (không đụng \`${baseBranch}\`, không tự merge). ` +
          'Hoặc dùng luồng **Dev** nếu muốn agent tự code.');
        return;
      }

      TaskRepository.setStatus(task.id, 'testing');
      TaskRepository.heartbeat(task.id);
      await TrelloClient.addComment(task.card_id,
        `🧪 **[AI AGENT]** Đang review (chỉ-đọc) nhánh \`${branch}\` so với \`${baseBranch}\`.\n` +
        'Sẽ kiểm: ✅ tiêu chí nghiệm thu · 🐞 bug logic / xử lý lỗi-null / edge case · ♻️ nguy cơ hồi quy · 🔒 bảo mật · 📐 quy ước (CLAUDE.md).\n' +
        'Nếu FAIL, mỗi lỗi sẽ kèm **`file:dòng`** + gợi ý sửa.').catch(() => {});

      const fresh = TaskRepository.findById(task.id)!;
      const result = await ReviewAgent.reviewBranch(fresh, repoPath, branch, baseBranch);

      if (result.verdict === 'PASS') {
        TaskRepository.setStatus(task.id, 'completed');
        await TrelloClient.addComment(task.card_id,
          `✅ **[AI AGENT]** Review PASS nhánh \`${branch}\` (so với \`${baseBranch}\`). ` +
          `Bạn có thể **merge \`${branch}\` vào \`${baseBranch}\`** (agent không tự merge).`);
      } else {
        TaskRepository.setStatus(task.id, 'review_failed');
        await TrelloClient.addComment(task.card_id,
          `❌ **[AI AGENT]** Review FAIL nhánh \`${branch}\` — xem chi tiết vấn đề ở comment review phía trên. ` +
          `Sửa trên nhánh, \`push\` lại rồi kéo lại **Test** (hoặc reply \`RETRY\`).`);
      }
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },
};

/** Đọc `Branch: <tên-nhánh>` từ mô tả card (1 dòng riêng). Trả null nếu không có. */
function parseReviewBranch(desc: string | null | undefined): string | null {
  const m = (desc ?? '').match(/(?:^|\n)\s*Branch:\s*(\S+)/i);
  return m ? m[1].trim() : null;
}
