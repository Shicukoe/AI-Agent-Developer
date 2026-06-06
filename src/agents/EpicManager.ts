import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { CardMemory } from './CardMemory.js';
import { config, firstPlanningListName } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { PlanResponse, SubTaskSpec } from '../claude/types.js';

const log = childLogger('epic-manager');

interface ChildMeta {
  epic_card_id: string;
  epic_check_item_id?: string;
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
   * Sau khi epic được chốt plan: tạo 1 card con cho mỗi sub-task, link về epic, pre-approve sẵn
   * (có plan_file_path + status 'plan_approved') để người dùng kéo thẳng sang Dev.
   */
  async createChildren(epicTask: Task, plan: PlanResponse): Promise<number> {
    const boardId = epicTask.board_id;
    const epicShort = epicTask.card_id.slice(0, 6);

    // List đích cho card con + nhãn AI (gắn sẵn để khi kéo sang Dev được nhận diện)
    const lists = await TrelloClient.getLists(boardId);
    const planningName = firstPlanningListName().toUpperCase();
    const childList = lists.find(l => l.name.toUpperCase() === planningName) ?? lists[0];
    if (!childList) throw new Error('Không tìm thấy list để đặt card con');

    const labels = await TrelloClient.getLabels(boardId).catch(() => []);
    const aiLabel = labels.find(l => l.name.toLowerCase() === config.TRELLO_AI_LABEL_NAME.toLowerCase());
    const idLabels = aiLabel ? [aiLabel.id] : [];

    const checklistId = await TrelloClient.addChecklist(epicTask.card_id, 'Tasks').catch(() => null);

    const planDir = join(config.DATA_DIR, 'plans');
    mkdirSync(planDir, { recursive: true });

    const subTasks = plan.sub_tasks ?? [];
    for (const st of subTasks) {
      const desc =
        `${st.description}\n\n` +
        `**Tiêu chí nghiệm thu:**\n${(st.acceptance_criteria ?? []).map(c => `- ${c}`).join('\n') || '—'}\n\n` +
        `---\nEpic: ${epicTask.card_id}`;

      const child = await TrelloClient.createCard(childList.id, `[${epicShort}] ${st.title}`, desc, idLabels);

      // Pre-approve: ghi PLAN.md cho card con
      const planPath = join(planDir, `${child.id}.md`);
      writeFileSync(planPath, formatChildPlan(st, epicTask.card_id), 'utf8');

      // Tick item trên checklist epic để theo dõi tiến độ
      const checkItemId = checklistId
        ? await TrelloClient.addCheckItem(checklistId, st.title).catch(() => undefined)
        : undefined;

      const meta: ChildMeta = { epic_card_id: epicTask.card_id, epic_check_item_id: checkItemId };
      const childTask = TaskRepository.create({
        card_id: child.id,
        board_id: boardId,
        list_id: childList.id,
        card_name: `[${epicShort}] ${st.title}`,
        task_type: 'small',
        parent_task_id: epicTask.id,
        metadata: meta as unknown as Record<string, unknown>,
      });
      TaskRepository.update(childTask.id, { status: 'plan_approved', plan_file_path: planPath });

      log.info({ epicCardId: epicTask.card_id, childCardId: child.id, title: st.title }, 'Child card created');
    }

    await TrelloClient.addComment(epicTask.card_id,
      `🧩 **[AI AGENT]** Đã tạo **${subTasks.length}** card con trong list **${childList.name}** (đã pre-approve plan).\n` +
      `Kéo từng card con sang **Dev** khi muốn bắt đầu. Tiến độ theo dõi ở checklist **Tasks**.`);

    return subTasks.length;
  },

  /** Khi card con hoàn thành (Test PASS): tick mục tương ứng trên checklist của epic. */
  async markChildDone(childTask: Task): Promise<void> {
    if (!childTask.metadata) return;
    let meta: ChildMeta;
    try {
      meta = JSON.parse(childTask.metadata) as ChildMeta;
    } catch {
      return;
    }
    if (!meta.epic_card_id || !meta.epic_check_item_id) return;
    await TrelloClient.updateChecklistItem(meta.epic_card_id, meta.epic_check_item_id, 'complete').catch(() => {});
    await CardMemory.post(meta.epic_card_id, 'Tiến độ',
      `✅ Hoàn thành card con: **${childTask.card_name}** (branch \`${childTask.branch_name ?? '—'}\`).`).catch(() => {});
    log.info({ epicCardId: meta.epic_card_id, childCardId: childTask.card_id }, 'Epic checklist item ticked');
  },
};
