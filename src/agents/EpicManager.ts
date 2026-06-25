import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { WorktreeManager } from '../git/WorktreeManager.js';
import { GitClient } from '../git/GitClient.js';
import { CardMemory } from './CardMemory.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { config, firstPlanningListName } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { PlanResponse, SubTaskSpec } from '../claude/types.js';

const log = childLogger('epic-manager');

interface ChildMeta {
  epic_card_id: string;
  epic_check_item_id?: string;
  sequence?: number;       // thứ tự thực thi (từ plan)
  base_branch?: string;    // integration branch của epic (epic/<short>)
}

interface EpicMeta {
  epic_plan?: PlanResponse;
  integration_branch?: string;
  integration_worktree?: string;
}

/** Khoá merge theo epic: tránh 2 card con cùng merge vào integration worktree một lúc. */
const mergeLocks = new Map<string, Promise<unknown>>();
async function withEpicLock<T>(epicId: string, fn: () => Promise<T>): Promise<T> {
  const prev = mergeLocks.get(epicId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  mergeLocks.set(epicId, next);
  try {
    return await next;
  } finally {
    if (mergeLocks.get(epicId) === next) mergeLocks.delete(epicId);
  }
}

function parseMeta<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function formatChildPlan(st: SubTaskSpec, epicCardId: string): string {
  return (
    `# ${st.title}\n\n` +
    `> Thuộc feature (epic): \`${epicCardId}\`\n\n` +
    `## Mô tả\n${st.description}\n\n` +
    `## Tiêu chí nghiệm thu\n${(st.acceptance_criteria ?? []).map(c => `- ${c}`).join('\n') || '—'}\n\n` +
    `## File dự kiến\n${(st.files_expected ?? []).join(', ') || '—'}\n`
  );
}

export const EpicManager = {
  /**
   * Sau khi epic được chốt plan: tạo integration branch epic/<short> (từ base branch), rồi 1 card con
   * cho mỗi sub-task (theo thứ tự sequence), link về epic, pre-approve sẵn. Card con sẽ branch TỪ
   * integration branch (không phải dev) để thấy code của các card con trước (xem StageRouter.runDev).
   */
  async createChildren(epicTask: Task, plan: PlanResponse): Promise<number> {
    const boardId = epicTask.board_id;
    const epicShort = epicTask.card_id.slice(0, 6);
    const repoPath = epicTask.repo_path ?? config.GIT_REPO_PATH;
    const repoBase = RepoConfigRepository.getById(epicTask.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;

    const lists = await TrelloClient.getLists(boardId);
    const planningName = firstPlanningListName().toUpperCase();
    const childList = lists.find(l => l.name.toUpperCase() === planningName) ?? lists[0];
    if (!childList) throw new Error('Không tìm thấy list để đặt card con');

    const labels = await TrelloClient.getLabels(boardId).catch(() => []);
    const aiLabel = labels.find(l => l.name.toLowerCase() === config.TRELLO_AI_LABEL_NAME.toLowerCase());
    const idLabels = aiLabel ? [aiLabel.id] : [];

    // Integration branch + worktree cho epic (tách từ base branch). Card con merge dần vào đây.
    const integrationBranch = `epic/${epicShort}`;
    const integrationWorktree = await WorktreeManager.add(
      `epic-${epicShort}`, repoPath, integrationBranch, repoBase,
    );
    TaskRepository.mergeMetadata(epicTask.id, {
      integration_branch: integrationBranch,
      integration_worktree: integrationWorktree,
    });
    log.info({ epicCardId: epicTask.card_id, integrationBranch }, 'Integration branch created');

    const checklistId = await TrelloClient.addChecklist(epicTask.card_id, 'Tasks').catch(() => null);

    const planDir = join(config.DATA_DIR, 'plans');
    mkdirSync(planDir, { recursive: true });

    // Thực thi tuần tự theo sequence.
    const subTasks = [...(plan.sub_tasks ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    for (const st of subTasks) {
      const seq = st.sequence ?? 0;
      const desc =
        `# ${st.title}\n\n` +
        `**Thuộc feature (EPIC):** ${epicTask.card_id}\n\n` +
        `**Thứ tự (sequence):** ${seq}\n\n` +
        `**Mô tả chi tiết:**\n${st.description || '—'}\n\n` +
        `**Tiêu chí nghiệm thu:**\n${(st.acceptance_criteria ?? []).map(c => `- ${c}`).join('\n') || '- —'}\n\n` +
        `**File dự kiến:**\n${(st.files_expected ?? []).map(f => `- ${f}`).join('\n') || '- —'}\n\n` +
        `**Hướng dẫn bắt đầu:**\n- Kéo card này sang list *Dev* để agent bắt đầu (theo đúng thứ tự sequence).\n` +
        `- Branch tạo tự động từ integration branch \`${integrationBranch}\`; khi Test PASS sẽ tự merge vào đó.\n\n` +
        `**Ghi chú:**\n- Giữ nguyên nhãn \`AI\`.\n- ID Epic: ${epicTask.card_id}\n`;

      const child = await TrelloClient.createCard(childList.id, `[${epicShort}] ${st.title}`, desc, idLabels);

      const planPath = join(planDir, `${child.id}.md`);
      writeFileSync(planPath, formatChildPlan(st, epicTask.card_id), 'utf8');

      const checkItemId = checklistId
        ? await TrelloClient.addCheckItem(checklistId, `[${seq}] ${st.title}`).catch(() => undefined)
        : undefined;

      const meta: ChildMeta = {
        epic_card_id: epicTask.card_id,
        epic_check_item_id: checkItemId,
        sequence: seq,
        base_branch: integrationBranch,
      };
      const childTask = TaskRepository.create({
        card_id: child.id,
        board_id: boardId,
        list_id: childList.id,
        card_name: `[${epicShort}] ${st.title}`,
        task_type: 'small',
        parent_task_id: epicTask.id,
        metadata: meta as unknown as Record<string, unknown>,
        repo_key: epicTask.repo_key ?? undefined,
        repo_path: epicTask.repo_path ?? undefined,
      });
      TaskRepository.update(childTask.id, { status: 'plan_approved', plan_file_path: planPath });

      log.info({ epicCardId: epicTask.card_id, childCardId: child.id, seq, title: st.title }, 'Child card created');
    }

    await TrelloClient.addComment(epicTask.card_id,
      `🧩 **[AI AGENT]** Đã tạo **${subTasks.length}** card con (đã pre-approve) trong list **${childList.name}**.\n` +
      `Code sẽ tích hợp dần vào branch \`${integrationBranch}\`. **Làm theo thứ tự sequence**: kéo card #1 sang Dev → Test PASS → mới tới card #2…\n` +
      `Tiến độ theo dõi ở checklist **Tasks**.`);

    return subTasks.length;
  },

  /** Đọc metadata card con (nếu là card con của epic). */
  getChildMeta(task: Task): ChildMeta | null {
    const meta = parseMeta<ChildMeta>(task.metadata);
    return meta?.epic_card_id ? meta : null;
  },

  childSequence(task: Task): number {
    return parseMeta<ChildMeta>(task.metadata)?.sequence ?? 0;
  },

  /** Đảm bảo integration worktree tồn tại (tái tạo nếu bị xoá; branch giữ nguyên các merge cũ). */
  async ensureIntegrationWorktree(epicTask: Task): Promise<{ branch: string; worktree: string } | null> {
    const meta = parseMeta<EpicMeta>(epicTask.metadata);
    const branch = meta?.integration_branch;
    if (!branch) return null;
    const key = `epic-${epicTask.card_id.slice(0, 6)}`;
    const repoPath = epicTask.repo_path ?? config.GIT_REPO_PATH;
    const repoBase = RepoConfigRepository.getById(epicTask.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
    let worktree = meta?.integration_worktree;
    if (!worktree || !existsSync(worktree)) {
      worktree = await WorktreeManager.add(key, repoPath, branch, repoBase);
      TaskRepository.mergeMetadata(epicTask.id, { integration_worktree: worktree });
    }
    return { branch, worktree };
  },

  /** Merge branch của card con vào integration branch (serialize theo epic). */
  async mergeChildIntoIntegration(childTask: Task): Promise<{ ok: boolean; output: string }> {
    const meta = this.getChildMeta(childTask);
    // Không phải card con có integration branch (vd epic cũ) → bỏ qua merge (no-op).
    if (!meta?.epic_card_id || !meta.base_branch || !childTask.branch_name) return { ok: true, output: 'no-integration' };
    const epicTask = TaskRepository.findByCardId(meta.epic_card_id);
    if (!epicTask) return { ok: false, output: 'epic task not found' };

    return withEpicLock(meta.epic_card_id, async () => {
      const integ = await this.ensureIntegrationWorktree(epicTask);
      if (!integ) return { ok: false, output: 'integration worktree unavailable' };
      return GitClient.tryMerge(childTask.id, integ.worktree, childTask.branch_name!);
    });
  },

  /** Khi card con hoàn thành (Test PASS + merged): tick mục tương ứng trên checklist của epic. */
  async markChildDone(childTask: Task): Promise<void> {
    const meta = this.getChildMeta(childTask);
    if (!meta?.epic_card_id || !meta.epic_check_item_id) return;
    await TrelloClient.updateChecklistItem(meta.epic_card_id, meta.epic_check_item_id, 'complete').catch(() => {});
    await CardMemory.post(meta.epic_card_id, 'Tiến độ',
      `✅ Hoàn thành + merged card con: **${childTask.card_name}** (branch \`${childTask.branch_name ?? '—'}\`).`).catch(() => {});
    log.info({ epicCardId: meta.epic_card_id, childCardId: childTask.card_id }, 'Epic checklist item ticked');
  },

  /** Sau khi một card con PASS: nhắc card con kế tiếp (sequence nhỏ nhất chưa xong), hoặc báo epic xong. */
  async announceNext(childTask: Task): Promise<void> {
    const meta = this.getChildMeta(childTask);
    if (!meta?.epic_card_id) return;
    const epicTask = TaskRepository.findByCardId(meta.epic_card_id);
    if (!epicTask) return;

    const siblings = TaskRepository.findSubTasks(epicTask.id);
    const pending = siblings
      .filter(s => s.status !== 'completed')
      .sort((a, b) => this.childSequence(a) - this.childSequence(b));

    if (pending.length === 0) {
      const branch = parseMeta<EpicMeta>(epicTask.metadata)?.integration_branch;
      if (branch) {
        // Epic mới: push integration branch lên remote để bạn thấy được (best-effort).
        const integ = await this.ensureIntegrationWorktree(epicTask).catch(() => null);
        const pushed = integ
          ? await GitClient.push(epicTask.id, integ.worktree, branch).then(() => true).catch(() => false)
          : false;
        await TrelloClient.addComment(epicTask.card_id,
          `🎉 **[AI AGENT]** Tất cả **${siblings.length}** card con đã hoàn thành và tích hợp vào \`${branch}\`. ` +
          (pushed
            ? 'Branch đã được **push lên remote** — '
            : 'Branch hiện chỉ ở **local** (push thất bại/không có quyền) — ') +
          `sẵn sàng để bạn merge vào \`${RepoConfigRepository.getById(epicTask.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH}\`.`).catch(() => {});
      } else {
        // Epic cũ: không có integration branch → code nằm rải ở từng branch card con.
        const branches = siblings.map(s => s.branch_name).filter(Boolean);
        await TrelloClient.addComment(epicTask.card_id,
          `🎉 **[AI AGENT]** Tất cả **${siblings.length}** card con đã hoàn thành. Epic này **không dùng integration branch** ` +
          `(tạo trước cơ chế mới) nên KHÔNG có branch \`epic/...\`. Hãy merge thủ công các branch card con vào \`${RepoConfigRepository.getById(epicTask.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH}\`:\n` +
          branches.map(b => `- \`${b}\``).join('\n')).catch(() => {});
      }
      log.info({ epicCardId: epicTask.card_id, integration: !!branch }, 'Epic complete');
      return;
    }

    const next = pending[0];
    const seq = this.childSequence(next);
    // Auto-pilot: TỰ kéo card con kế sang Dev (không chờ người) → chuỗi epic chạy liền mạch.
    if (RepoRegistry.autoPilotForTask(epicTask)) {
      const lists = await TrelloClient.getLists(next.board_id).catch(() => []);
      const want = new Set(config.TRELLO_DEV_LIST_NAMES.map(n => n.trim().toLowerCase()));
      const devList = lists.find(l => want.has(l.name.trim().toLowerCase()));
      if (devList) {
        await TrelloClient.moveCard(next.card_id, devList.id).catch(() => {});
        await TrelloClient.addComment(next.card_id,
          `🚀 **[AUTO-PILOT]** Tới lượt card con #${seq} → tự chuyển sang **Dev**.`).catch(() => {});
        return;
      }
    }
    await TrelloClient.addComment(next.card_id,
      `▶️ **[AI AGENT]** Tới lượt card con này (sequence ${seq}). Kéo sang **Dev** để làm.`).catch(() => {});
  },
};
