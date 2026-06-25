import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { TrelloClient } from '../trello/TrelloClient.js';
import { WorktreeManager } from '../git/WorktreeManager.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { ReviewMarkRepository } from '../state/ReviewMarkRepository.js';
import { GitClient } from '../git/GitClient.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { RepoRegistry, type ResolvedRepo } from '../repos/RepoRegistry.js';
import { TriageAgent } from './TriageAgent.js';
import { BusinessAnalystAgent } from './BusinessAnalystAgent.js';
import { TechnicalRefinerAgent } from './TechnicalRefinerAgent.js';
import { PlannerAgent } from './PlannerAgent.js';
import { DevAgent } from './DevAgent.js';
import { taskKind } from './executors/types.js';
import { pickExecutor } from './executors/registry.js';
import { ReviewAgent } from './ReviewAgent.js';
import { IndexAgent } from './IndexAgent.js';
import { generateFrameworkRules } from '../scripts/gen-framework-rules.js';
import { withKeyedLock } from '../utils/keyedMutex.js';
import { CardMemory } from './CardMemory.js';
import { EpicManager } from './EpicManager.js';
import { OrchestratorAgent } from './OrchestratorAgent.js';
import type { PlanResponse, TestCase, AnalystResponse } from '../claude/types.js';
import { TaskQueue } from '../queue/TaskQueue.js';
import { config, hasPlanApproveLabel, hasQuickLabel, hasTechRefineLabel } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task, TaskType } from '../state/TaskRepository.js';
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
      // Chỉ mục tĩnh (grep, rẻ) — dựng nếu chưa có để agent TRA thay vì đọc lặp. Lỗi không chặn task.
      const idxPath = join(repo.docsPath, '00_CHI_MUC.md');
      if (!existsSync(idxPath)) await IndexAgent.build(repo.repoPath, idxPath).catch(() => {});

      // SỔ LUẬT FRAMEWORK — TỰ tạo MỘT LẦN/repo khi thiếu (tri thức để ReviewAgent test đúng). Đây là LLM
      // run nặng → fire-and-forget + khóa theo repo (re-check trong khóa để chỉ chạy 1 lần), KHÔNG chặn task.
      const rulesPath = join(repo.docsPath, '00_FRAMEWORK_RULES.md');
      if (!existsSync(rulesPath)) {
        void withKeyedLock(`genrules:${repo.repoPath}`, async () => {
          if (existsSync(rulesPath)) return;                       // repo khác đã sinh xong trong lúc chờ khóa
          log.info({ repoPath: repo.repoPath }, 'Sổ luật framework chưa có → tự sinh nền (1 lần)');
          await generateFrameworkRules(repo.repoPath, repo.docsPath);
        }).catch(err => log.warn({ repoPath: repo.repoPath, err: (err as Error).message }, 'Tự sinh Sổ luật framework lỗi (bỏ qua)'));
      }

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
      // Tri thức dự án = TÀI LIỆU THẬT trong repo (docs/), agent tự đọc — không còn cache tự sinh.
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

      // MẶC ĐỊNH: chỉ nghiệp vụ (đỡ test fail oan vì spec kỹ thuật). Có nhãn "BA kỹ thuật" mới chạy Tech.
      if (hasTechRefineLabel(card.labels ?? [])) {
        // Refine kỹ thuật + định tuyến (Dev/Planning/Epic). business_subtasks > 1 → Tech tự quyết epic_solve.
        await TechnicalRefinerAgent.run(task, analyst);
      } else {
        await this.finalizeBusinessRefine(task, card, analyst);
      }
      // AUTO-PILOT: tự đẩy sang stage kế (chỉ board bật). needsInfo đã return ở trên nên tới đây refine đã quyết.
      if (RepoRegistry.autoPilotForTask(task)) await this.autoAdvanceAfterRefine(task);
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
    if (RepoRegistry.autoPilotForTask(task)) await autoPilotAdvance(task, config.TRELLO_DEV_LIST_NAMES, 'Dev').catch(() => {});
  },

  /**
   * Refine NGHIỆP VỤ-only (không bật BA kỹ thuật): chỉ ghi tiêu chí NGHIỆP VỤ + định tuyến theo
   * analyst.decision. KHÔNG sinh tiêu chí/test_cases kỹ thuật → test chỉ chấm nghiệp vụ (đỡ fail oan).
   */
  async finalizeBusinessRefine(task: Task, card: TrelloCard, analyst: AnalystResponse): Promise<void> {
    const nSub = (analyst.business_subtasks ?? []).length;
    const decision = analyst.decision ?? (nSub > 1 ? 'epic_solve' : 'design_solve');

    // Ghi đè mô tả card: chỉ nghiệp vụ + chỗ trống cho Ghi chú Dev + giữ yêu cầu gốc.
    const original = extractOriginalDesc(card.desc ?? '');
    await TrelloClient.updateCardDescription(task.card_id, businessCardDescription(analyst, original))
      .catch(err => log.warn({ taskId: task.id, err }, 'Không ghi đè được mô tả card (business-only)'));

    TaskRepository.mergeMetadata(task.id, {
      kind: 'code', refine_decision: decision, refine_mode: 'business',
      acceptance_criteria: analyst.acceptance_criteria ?? [],
      test_cases: [],
    });
    const taskType: TaskType = decision === 'epic_solve' ? 'epic' : decision === 'design_solve' ? 'large' : 'small';
    TaskRepository.update(task.id, { task_type: taskType });
    await CardMemory.post(task.card_id, 'Business Refine',
      `Chỉ làm rõ NGHIỆP VỤ (không bật BA kỹ thuật). Định tuyến: **${decision}**.`).catch(() => {});

    if (decision === 'trivial_solve') {
      const planDir = join(config.DATA_DIR, 'plans');
      mkdirSync(planDir, { recursive: true });
      const planPath = join(planDir, `${task.id}.md`);
      writeFileSync(planPath, businessSpecFull(analyst, card.name), 'utf8');
      TaskRepository.update(task.id, { plan_file_path: planPath });
      TaskRepository.setStatus(task.id, 'plan_approved');
      await TrelloClient.addComment(task.card_id,
        '✅ **[AI AGENT]** Đã làm rõ nghiệp vụ — giải quyết được ngay. Kéo card sang **Dev**. ' +
        '_(Cần phân tích kỹ thuật sâu hơn? Gắn nhãn **`BA kỹ thuật`** rồi reply `REFINE`.)_');
    } else if (decision === 'epic_solve') {
      await TrelloClient.addComment(task.card_id,
        '🧩 **[AI AGENT]** Feature lớn (**EPIC**). Kéo card sang list **Epic** để lập kế hoạch tổng + sinh card con.');
    } else {
      await TrelloClient.addComment(task.card_id,
        '📋 **[AI AGENT]** Đã làm rõ nghiệp vụ. Kéo card sang **Planning** để lập kế hoạch. ' +
        '_(Muốn AI phân tích kỹ thuật trước? Gắn nhãn **`BA kỹ thuật`** rồi reply `REFINE`.)_');
    }
    log.info({ taskId: task.id, decision }, 'finalizeBusinessRefine done');
  },

  /** Epic stage: lập kế hoạch tổng cho feature lớn; khi chốt sẽ sinh card con (xem onPlanApprove). */
  async runEpicPlanning(task: Task): Promise<void> {
    log.info({ taskId: task.id }, 'runEpicPlanning');
    try {
      TaskRepository.setStatus(task.id, 'processing');
      TaskRepository.heartbeat(task.id);

      const plan = await PlannerAgent.run(task, undefined, config.EPIC_MODEL);   // Epic → Opus
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

      // AUTO-PILOT: không có người gắn nhãn `plan approve` → TỰ chốt kế hoạch rồi đẩy sang Dev.
      if (RepoRegistry.autoPilotForTask(task)) {
        TaskRepository.setStatus(task.id, 'plan_approved');
        await TrelloClient.addComment(task.card_id,
          '🚀 **[AUTO-PILOT]** Đã tự chốt kế hoạch (không cần nhãn `plan approve`) → chuyển sang **Dev**.').catch(() => {});
        await autoPilotAdvance(task, config.TRELLO_DEV_LIST_NAMES, 'Dev').catch(() => {});
      }
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

    // Chọn executor theo kind đã phân loại (TechnicalRefiner). 'code' → DevAgent (luồng git bên dưới);
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
        // Auto-pilot: re-dev sẽ lại "no changes" → kẹt. Halt thẳng cho người xem (đừng loop).
        if (RepoRegistry.autoPilotForTask(task)) {
          TaskRepository.setStatus(task.id, 'halted', { error_message: 'Auto-pilot: DevAgent không tạo thay đổi (kẹt)' });
          await TrelloClient.addComment(task.card_id,
            '🛑 **[AUTO-PILOT]** DevAgent **không tạo thay đổi file nào** → kẹt, **dừng** để người xem (nêu rõ đường dẫn file cần tạo nếu là task tài liệu).');
          return;
        }
        TaskRepository.setStatus(task.id, 'review_failed', { error_message: 'DevAgent không tạo thay đổi file' });
        await TrelloClient.addComment(task.card_id,
          '⚠️ **[AI AGENT]** DevAgent kết thúc nhưng **không tạo thay đổi file nào** — chưa thể sang Test.\n' +
          'Nếu là task viết tài liệu, hãy nêu rõ **đường dẫn file cần tạo** (vd `docs/huong-dan-firebase.md`) trong mô tả card rồi kéo lại **Dev**.');
        return;
      }

      TaskRepository.setStatus(task.id, 'dev_done');
      await TrelloClient.addComment(task.card_id,
        `✅ **[AI AGENT]** Code xong trên branch \`${branchName}\`. Kéo card sang list **Test** để review.`);
      if (RepoRegistry.autoPilotForTask(task)) await autoPilotAdvance(task, config.TRELLO_TEST_LIST_NAMES, 'Test').catch(() => {});
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
      const { criteria, testCases } = await gatherReviewInputs(fresh);
      const result = await ReviewAgent.review(fresh, criteria, testCases);

      if (result.verdict === 'NEEDS_INFO') {
        // Chưa kết luận được đúng/sai (phụ thuộc config/UI/runtime/dữ liệu) → chờ làm rõ, KHÔNG merge.
        TaskRepository.setStatus(task.id, 'awaiting_clarification');
        const checks = (result.checks_needed ?? []).map(c => `- ${c}`).join('\n');
        await CardMemory.post(task.card_id, 'Review NEEDS_INFO — cần làm rõ',
          `${result.summary}\n\n**Cần kiểm tra/làm rõ:**\n${checks || '—'}`).catch(() => {});
        await TrelloClient.addComment(task.card_id,
          '❓ **[AI AGENT]** Chưa kết luận được đúng/sai — cần làm rõ (xem **checklist** ở comment trên: config/UI/dữ liệu cần kiểm tra). ' +
          'Bổ sung thông tin (hoặc tự kiểm theo checklist) rồi kéo lại **Test** (hoặc reply `RETRY`).');
        // Auto-pilot: không có người làm rõ ngay → halt cho người xem (đừng loop vô nghĩa).
        if (RepoRegistry.autoPilotForTask(task)) {
          TaskRepository.setStatus(task.id, 'halted', { error_message: 'Auto-pilot: review NEEDS_INFO (cần người làm rõ)' });
          await TrelloClient.addComment(task.card_id,
            '🛑 **[AUTO-PILOT]** Review chưa kết luận được (phụ thuộc config/UI/dữ liệu) → **dừng** để người xem theo checklist trên.').catch(() => {});
        }
        return;
      }

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
        } else if (RepoRegistry.autoPilotForTask(task)) {
          await TrelloClient.addComment(task.card_id,
            '🎉 **[AUTO-PILOT]** Hoàn tất! Test **PASS** — branch sẵn sàng, bạn review + merge tay khi muốn.').catch(() => {});
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
        // Auto-pilot: tự đẩy lại Dev (vòng dev↔test) cho tới khi PASS hoặc quá MAX_DEV_RETRY_ATTEMPTS → halt.
        if (RepoRegistry.autoPilotForTask(task)) await this.autoRetryOrHalt(task);
      }
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /**
   * Test cho luồng "agent làm tester": người tự code rồi chỉ định phần cần review trong mô tả card.
   * Agent review READ-ONLY (chỉ fetch + diff), KHÔNG worktree/commit/merge. Hỗ trợ:
   *  - `Branch: <ref>` (mình nó) → AUTO-INCREMENTAL: review commit MỚI trên nhánh đó kể từ lần review
   *    trước (mốc lưu trong DB, tiến mốc khi PASS). Lần đầu: so với base branch của repo.
   *  - `Branch: <ref>` + `Base: <ref>` → diff `base...branch` (3-dot, không tự ghi mốc). base nên là
   *    nhánh CHƯA chứa thay đổi (vd dev/main) → dù đã merge vào staging vẫn soi đúng.
   *  - `Range: a..b` / `Commits: a..b` → diff đúng dải. `Since: <sha>` (+ Branch) → `<sha>..<branch>`.
   */
  async runBranchReview(task: Task): Promise<void> {
    try {
      const card = await TrelloClient.getCard(task.card_id);
      const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
      const baseBranch = RepoConfigRepository.getById(task.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
      const repoKey = task.repo_key || task.repo_path || 'default';
      let spec = parseReviewSpec(card.desc);

      // KÉO-THẢ: không ghi directive → TỰ DÒ nhánh dev mới push (chắc chắn bắt được commit vừa đẩy lên).
      if (!spec.range && !spec.branch) {
        const auto = await autoDetectReviewBranch(repoPath);
        if (auto) {
          spec = { ...spec, branch: auto };
          await TrelloClient.addComment(task.card_id,
            `🔎 **[AI AGENT]** Tự dò nhánh mới push: \`${auto}\` → review **commit mới** trên nhánh này (auto-incremental). ` +
            'Nếu sai nhánh, ghi `Branch: <tên>` (hoặc `Base:`/`Range: a..b`) vào mô tả card rồi kéo lại **Test**.').catch(() => {});
        } else {
          await TrelloClient.addComment(task.card_id,
            '⚠️ **[AI AGENT] Không dò được nhánh để review** (repo chưa có remote/nhánh, hoặc chưa push). Thêm vào **mô tả card** rồi kéo lại **Test**:\n\n' +
            `• \`Branch: staging\` — review **commit mới kể từ lần trước** trên nhánh đó (lần đầu so với \`${baseBranch}\`).\n` +
            '• `Branch: feature/<x>` + `Base: dev` — so với nhánh **CHƯA** chứa thay đổi.\n' +
            '• `Range: dev..staging` / `Commits: <sha-cũ>..staging` — diff đúng dải commit.');
          return;
        }
      }

      TaskRepository.setStatus(task.id, 'testing');
      TaskRepository.heartbeat(task.id);

      // Tính biểu thức diff (expr) + nhãn mô tả; với auto-incremental thì ghi mốc commit khi PASS.
      let expr: string;
      let label: string;
      let markBranch: string | null = null;
      let markHead: string | null = null;

      if (spec.range) {
        expr = spec.range;
        label = `dải \`${spec.range}\``;
        const refs = spec.range.split(/\.{2,3}/).map(s => s.trim()).filter(s => s && !/^[0-9a-f]{7,40}$/i.test(s));
        if (refs.length) await GitClient.fetch(repoPath, refs).catch(() => {});
      } else {
        const branch = spec.branch!;
        await GitClient.fetch(repoPath, spec.base ? [branch, spec.base] : [branch, baseBranch]).catch(() => {});
        const head = (await GitClient.revParse(repoPath, `origin/${branch}`)) ?? (await GitClient.revParse(repoPath, branch));
        if (spec.base) {
          expr = `origin/${spec.base}...origin/${branch}`;
          label = `nhánh \`${branch}\` so với \`${spec.base}\``;
        } else {
          // AUTO-INCREMENTAL theo mốc đã lưu
          const last = ReviewMarkRepository.get(repoKey, branch);
          if (last && head && last === head) {
            await TrelloClient.addComment(task.card_id,
              `ℹ️ **[AI AGENT]** Không có commit mới trên \`${branch}\` kể từ lần review trước (\`${last.slice(0, 8)}\`). ` +
              'Muốn review lại từ nhánh ổn định → dùng `Base: <nhánh>` hoặc `Range:`.');
            TaskRepository.setStatus(task.id, 'completed');
            return;
          }
          if (last && head) {
            expr = `${last}..origin/${branch}`;
            label = `commit mới trên \`${branch}\` (\`${last.slice(0, 8)}\`..\`${head.slice(0, 8)}\`)`;
          } else {
            // LẦN ĐẦU (chưa có mốc): chỉ review N NGÀY mới nhất, tránh diff cả dải base...branch khổng lồ.
            const dayBase = await GitClient.recentDaysBase(repoPath, `origin/${branch}`, config.REVIEW_AUTODETECT_DAYS);
            if (dayBase) {
              expr = `${dayBase}..origin/${branch}`;
              label = `commit ${config.REVIEW_AUTODETECT_DAYS} ngày mới nhất trên \`${branch}\` (\`${dayBase.slice(0, 8)}\`..\`${head?.slice(0, 8) ?? branch}\`) — muốn rộng hơn: ghi \`Base:\`/\`Range:\``;
            } else {
              expr = `origin/${baseBranch}...origin/${branch}`;
              label = `nhánh \`${branch}\` so với \`${baseBranch}\` (lần đầu)`;
            }
          }
          markBranch = branch; markHead = head;
        }
      }

      await TrelloClient.addComment(task.card_id,
        `🧪 **[AI AGENT]** Đang review (chỉ-đọc) ${label}.\n` +
        'Sẽ kiểm: ✅ tiêu chí nghiệm thu · 🐞 bug / xử lý lỗi-null / edge case · ♻️ nguy cơ hồi quy · 🔒 bảo mật · 📐 quy ước. FAIL kèm **`file:dòng`** + gợi ý sửa.').catch(() => {});

      const fresh = TaskRepository.findById(task.id)!;
      const { criteria, testCases } = await gatherReviewInputs(fresh, card.desc);
      const result = await ReviewAgent.reviewExpr(fresh, repoPath, expr, criteria, testCases);

      if (result.verdict === 'NEEDS_INFO') {
        // Chưa kết luận được → chờ làm rõ, KHÔNG tiến mốc (lần sau vẫn review lại phần này).
        TaskRepository.setStatus(task.id, 'awaiting_clarification');
        await TrelloClient.addComment(task.card_id,
          `❓ **[AI AGENT]** Chưa kết luận được đúng/sai (${label}) — cần làm rõ (xem **checklist** ở comment trên). ` +
          'Bổ sung/kiểm tra theo checklist rồi kéo lại **Test**. _(Chưa ghi mốc → lần sau vẫn review phần này.)_');
      } else if (result.verdict === 'PASS') {
        TaskRepository.setStatus(task.id, 'completed');
        // Chỉ TIẾN mốc khi PASS → lần sau chỉ review commit mới hơn.
        if (markBranch && markHead) ReviewMarkRepository.set(repoKey, markBranch, markHead);
        await TrelloClient.addComment(task.card_id,
          `✅ **[AI AGENT]** Review PASS (${label}).` +
          (markBranch ? ` Đã ghi mốc — lần sau chỉ review commit mới hơn trên \`${markBranch}\`.` : ' Bạn có thể tiếp tục merge/promote.'));
      } else {
        TaskRepository.setStatus(task.id, 'review_failed');
        await TrelloClient.addComment(task.card_id,
          `❌ **[AI AGENT]** Review FAIL (${label}) — xem chi tiết phía trên. Sửa, \`push\` lại rồi kéo lại **Test** (hoặc reply \`RETRY\`).` +
          (markBranch ? ' _(Chưa ghi mốc → lần sau vẫn review cả phần này.)_' : ''));
      }
    } catch (err) {
      await OrchestratorAgent.handleError(task, err);
    }
  },

  /**
   * AUTO-PILOT sau Refine: định tuyến full-auto theo quyết định của BA/Tech:
   *  - `design_solve` (cần kế hoạch) → **Planning** (runPlanning sẽ TỰ chốt plan rồi sang Dev).
   *  - `trivial_solve` / `doc_card` (giải quyết ngay) → thẳng **Dev** (đặt plan_approved để runDev chạy).
   *  - `epic_solve` → tạm bỏ qua (epic cần lập kế hoạch tổng + sinh card con, xử lý tay).
   */
  async autoAdvanceAfterRefine(task: Task): Promise<void> {
    const fresh = TaskRepository.findById(task.id);
    if (!fresh) return;
    let decision = '';
    try { decision = (JSON.parse(fresh.metadata ?? '{}') as { refine_decision?: string }).refine_decision ?? ''; } catch { /* metadata trống */ }
    if (decision === 'epic_solve') {
      await TrelloClient.addComment(fresh.card_id,
        'ℹ️ **[AUTO-PILOT]** Task là **EPIC** — auto-pilot tạm bỏ qua (epic cần lập kế hoạch + duyệt). Xử lý tay.').catch(() => {});
      return;
    }
    if (decision === 'design_solve') {
      // Cần lập kế hoạch đầy đủ → Planning (Plan sẽ được TỰ chốt ở runPlanning khi auto-pilot).
      await autoPilotAdvance(fresh, config.TRELLO_PLANNING_LIST_NAMES, 'Planning').catch(() => {});
      return;
    }
    // trivial_solve / doc_card → giải quyết ngay, thẳng Dev (đảm bảo đã "duyệt" để runDev không chặn).
    if (fresh.status !== 'plan_approved') TaskRepository.setStatus(fresh.id, 'plan_approved');
    await autoPilotAdvance(fresh, config.TRELLO_DEV_LIST_NAMES, 'Dev').catch(() => {});
  },

  /**
   * AUTO-PILOT khi Test FAIL: nếu chưa quá `MAX_DEV_RETRY_ATTEMPTS` → tăng retry + đẩy lại **Dev** (vòng
   * dev↔test tự chạy). Quá ngưỡng → **halt** + comment (DỪNG vòng lặp, tránh đốt token vô hạn).
   */
  async autoRetryOrHalt(task: Task): Promise<void> {
    const fresh = TaskRepository.findById(task.id);
    if (!fresh) return;
    const used = fresh.retry_count ?? 0;
    const max = config.MAX_DEV_RETRY_ATTEMPTS;
    if (used >= max) {
      TaskRepository.setStatus(fresh.id, 'halted', { error_message: `Auto-pilot: FAIL quá ${max} lần` });
      await TrelloClient.addComment(fresh.card_id,
        `🛑 **[AUTO-PILOT]** Đã tự sửa **${used}/${max}** lần vẫn FAIL → **dừng** để người xem (tránh đốt token vô hạn). Lỗi ở các comment trên.`).catch(() => {});
      log.warn({ taskId: fresh.id, used, max }, 'Auto-pilot: max retry reached → halted');
      return;
    }
    TaskRepository.update(fresh.id, { retry_count: used + 1 });
    await autoPilotAdvance(fresh, config.TRELLO_DEV_LIST_NAMES, `Dev (sửa lần ${used + 1}/${max})`).catch(() => {});
  },
};

/**
 * Tự dò nhánh cần review khi dev chỉ KÉO card (không ghi directive): fetch tất cả rồi chọn nhánh remote
 * có commit MỚI NHẤT (nhánh dev vừa push), loại nhánh "đích cuối" (main/master/production). Null nếu không có.
 */
async function autoDetectReviewBranch(repoPath: string): Promise<string | null> {
  await GitClient.fetchAll(repoPath);
  const branches = await GitClient.remoteBranchesByDate(repoPath);
  if (!branches.length) return null;
  const FINAL = new Set(['main', 'master', 'production', 'prod', 'release']);
  const candidate = branches.find(b => !FINAL.has(b.branch.toLowerCase())) ?? branches[0];
  return candidate.branch || null;
}

/** Tìm list id của 1 stage trên board theo tên cấu hình (khớp không phân biệt hoa thường). null nếu không có. */
async function findStageListId(boardId: string, listNames: string[]): Promise<string | null> {
  try {
    const lists = await TrelloClient.getLists(boardId);
    const want = new Set(listNames.map(n => n.trim().toLowerCase()).filter(Boolean));
    return lists.find(l => want.has(l.name.trim().toLowerCase()))?.id ?? null;
  } catch { return null; }
}

/**
 * AUTO-PILOT: chuyển card sang list của stage kế → poller tự dispatch stage đó (CÙNG cơ chế kéo tay,
 * không double-run). CHỈ gọi khi repo bật `auto_pilot`. Trả true nếu đã chuyển.
 */
async function autoPilotAdvance(task: Task, listNames: string[], stageLabel: string): Promise<boolean> {
  const listId = await findStageListId(task.board_id, listNames);
  if (!listId) {
    log.warn({ taskId: task.id, stageLabel }, 'Auto-pilot: không thấy list đích → dừng auto, chờ người');
    await TrelloClient.addComment(task.card_id,
      `⚠️ **[AUTO-PILOT]** Không thấy list **${stageLabel}** trên board để tự chuyển — kéo tay giúp (kiểm tra tên list cấu hình).`).catch(() => {});
    return false;
  }
  await TrelloClient.moveCard(task.card_id, listId);
  await TrelloClient.addComment(task.card_id, `🚀 **[AUTO-PILOT]** Tự chuyển card sang **${stageLabel}**…`).catch(() => {});
  log.info({ taskId: task.id, stageLabel }, 'Auto-pilot: moved card to next stage');
  return true;
}

/** Heading mục Ghi chú Dev — DevAgent/tester dùng chung để ghi & đọc (F2). */
const DEV_NOTE_HEADING = '## 🛠️ Ghi chú Dev (cách đã làm & hướng test)';
const DEV_NOTE_PLACEHOLDER = '_(Dev điền sau khi code: đã sửa gì, vì sao, tester nên kiểm theo luồng nào — hoặc viết comment bắt đầu bằng `DEV:`)_';
/** Nhắc nhở ĐẬM: dev PHẢI ghi nhánh vào mô tả trước khi kéo sang Test (chống auto-dò cả dải lớn → chậm/tốn token/sai). */
const DEV_NOTE_BRANCH_REMINDER = `> 🚨 **TRƯỚC KHI KÉO SANG \`Test\` — DEV BẮT BUỘC GHI NHÁNH VÀO MÔ TẢ NÀY.**
> ❗ Không ghi → agent phải TỰ DÒ và review **CẢ DẢI LỚN** (CHẬM · TỐN TOKEN · DỄ SAI verdict).
> - **\`Branch: <tên-nhánh>\`** — review commit MỚI của nhánh (vd \`Branch: NgocLuan2\`).
> - Muốn soi ĐÚNG dải: thêm **\`Base: <nhánh-gốc>\`** (so nhánh CHƯA chứa thay đổi) **hoặc** **\`Range: <sha-cũ>..<nhánh>\`**.`;
const ORIGINAL_HEADING = '## 📌 Yêu cầu gốc (giữ nguyên)';

/** Lấy phần "yêu cầu gốc" để không lồng marker khi refine lại; không có marker → cả desc. */
function extractOriginalDesc(desc: string): string {
  const idx = desc.indexOf(ORIGINAL_HEADING);
  return (idx >= 0 ? desc.slice(idx + ORIGINAL_HEADING.length) : desc).trim();
}

/** Mô tả card NGHIỆP VỤ-only — ngắn gọn (F5), kèm chỗ trống Ghi chú Dev + giữ yêu cầu gốc. */
function businessCardDescription(analyst: AnalystResponse, original: string): string {
  const reqs = (analyst.requirements ?? []).map(r => `- ${r}`).join('\n');
  const ac = (analyst.acceptance_criteria ?? []).map(c => `- ${c}`).join('\n') || '- —';
  return `## 🎯 Yêu cầu nghiệp vụ
**Mục tiêu:** ${analyst.intent || '—'}
${analyst.context ? `**Bối cảnh:** ${analyst.context}\n` : ''}${reqs ? `\n${reqs}\n` : ''}
## ✅ Tiêu chí nghiệm thu (nghiệp vụ)
${ac}

${DEV_NOTE_HEADING}
${DEV_NOTE_PLACEHOLDER}

${DEV_NOTE_BRANCH_REMINDER}

---
${ORIGINAL_HEADING}
${original || '(trống)'}`;
}

/** Spec ghi plan file cho Dev (trivial) — nghiệp vụ-only. */
function businessSpecFull(analyst: AnalystResponse, cardName: string): string {
  const reqs = (analyst.requirements ?? []).map(r => `- ${r}`).join('\n');
  const ac = (analyst.acceptance_criteria ?? []).map(c => `- ${c}`).join('\n') || '- —';
  return `# Spec: ${cardName}\n\n## 🎯 Yêu cầu nghiệp vụ\n**Mục tiêu:** ${analyst.intent || '—'}\n` +
    `${analyst.context ? `**Bối cảnh:** ${analyst.context}\n` : ''}${reqs ? `\n${reqs}\n` : ''}\n## ✅ Tiêu chí nghiệm thu\n${ac}\n`;
}

/** Trích tiêu chí nghiệm thu (bullet) từ mục `## ✅ Tiêu chí nghiệm thu` của mô tả card (fallback khi metadata trống). */
function parseCriteriaFromDesc(desc: string | null | undefined): string[] {
  const d = (desc ?? '').replace(/\r/g, '');
  const m = d.match(/##\s*✅[^\n]*\n([\s\S]*?)(?=\n##\s|\n---|$)/);
  if (!m) return [];
  return m[1].split('\n').map(l => l.replace(/^\s*[-*]\s*/, '').trim()).filter(l => l && l !== '—');
}

/** Đọc tiêu chí + test_cases để đưa vào reviewer: ưu tiên metadata (do Tech ghi), thiếu thì parse mô tả card. */
async function gatherReviewInputs(task: Task, cardDesc?: string): Promise<{ criteria: string[]; testCases: TestCase[] }> {
  let criteria: string[] = [];
  let testCases: TestCase[] = [];
  try {
    const meta = task.metadata ? JSON.parse(task.metadata) as Record<string, unknown> : {};
    if (Array.isArray(meta.acceptance_criteria)) criteria = meta.acceptance_criteria.filter((x): x is string => typeof x === 'string');
    if (Array.isArray(meta.test_cases)) {
      testCases = meta.test_cases.filter((t): t is TestCase =>
        !!t && typeof (t as TestCase).name === 'string' && typeof (t as TestCase).expected === 'string');
    }
  } catch { /* metadata hỏng → bỏ qua, dùng fallback */ }
  if (!criteria.length) {
    const desc = cardDesc ?? (await TrelloClient.getCard(task.card_id).then(c => c.desc).catch(() => ''));
    criteria = parseCriteriaFromDesc(desc);
  }
  return { criteria, testCases };
}

interface ReviewSpec { branch?: string; base?: string; range?: string; }

/** Đọc chỉ định review từ mô tả card: Branch/Base/Range|Commits/Since. */
function parseReviewSpec(desc: string | null | undefined): ReviewSpec {
  // Bỏ backtick/sao/markdown để nhận cả khi người dùng gõ dạng code `Range: ...` hay **Branch:** ...
  const d = (desc ?? '').replace(/[`*]/g, '');
  const grab = (re: RegExp) => { const m = d.match(re); return m ? m[1].trim() : undefined; };
  const branch = grab(/(?:^|\n)\s*Branch:\s*(\S+)/i);
  const base = grab(/(?:^|\n)\s*Base:\s*(\S+)/i);
  let range = grab(/(?:^|\n)\s*(?:Range|Commits):\s*(\S+)/i);
  const since = grab(/(?:^|\n)\s*Since:\s*(\S+)/i);
  if (!range && since && branch) range = `${since}..${branch}`;
  return { branch, base, range };
}
