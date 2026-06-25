import { TrelloClient } from './TrelloClient.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('board-provisioner');

export interface ProvisionResult { createdLists: string[]; createdLabels: string[]; renamedLabels: string[]; }

/**
 * Chuẩn bị board cho agent: tự tạo các LIST stage + LABEL điều khiển còn THIẾU (idempotent — chạy lại an toàn).
 * Gọi khi map board→repo trong admin để khỏi phải tạo tay.
 */
export const BoardProvisioner = {
  async provision(boardId: string): Promise<ProvisionResult> {
    const result: ProvisionResult = { createdLists: [], createdLabels: [], renamedLabels: [] };

    // LISTS cần có — lấy tên đầu mỗi nhóm stage (đúng tên agent route theo) + Done (cuối luồng).
    const wantLists = [
      config.TRELLO_REFINE_LIST_NAMES[0],
      config.TRELLO_PLANNING_LIST_NAMES[0],
      config.TRELLO_DEV_LIST_NAMES[0],
      config.TRELLO_TEST_LIST_NAMES[0],
      config.TRELLO_EPIC_LIST_NAMES[0],
      config.TRELLO_DONE_LIST_NAMES[0],
      config.TRELLO_INFO_LIST_NAMES[0],
      config.TRELLO_DOCS_LIST_NAMES[0],
    ].filter((n): n is string => !!n && n.trim().length > 0);

    const existingLists = await TrelloClient.getLists(boardId);
    const haveList = new Set(existingLists.map(l => l.name.trim().toLowerCase()));
    for (const name of wantLists) {
      if (haveList.has(name.toLowerCase())) continue;
      await TrelloClient.createList(boardId, name);   // pos 'bottom' → tạo theo thứ tự Refine→…→Done→Docs
      result.createdLists.push(name);
      haveList.add(name.toLowerCase());
    }

    // LABELS điều khiển cần có (name → màu Trello). Ưu tiên ĐỔI TÊN nhãn màu RỖNG-TÊN sẵn có (board mới có
    // 6 nhãn mặc định không tên) để khỏi sinh chip trùng màu; không còn nhãn rỗng cùng màu → tạo mới.
    const wantLabels: Array<[string, string]> = [
      [config.TRELLO_AI_LABEL_NAME, 'blue'],
      [config.TRELLO_PLAN_APPROVE_LABEL_NAME, 'green'],
      [config.TRELLO_QUICK_LABEL_NAME, 'yellow'],
      [config.TRELLO_TECH_REFINE_LABEL_NAME, 'purple'],
    ];
    const existingLabels = await TrelloClient.getLabels(boardId);
    const haveLabel = new Set(existingLabels.map(l => (l.name ?? '').trim().toLowerCase()).filter(Boolean));
    const usedBlank = new Set<string>();   // id nhãn rỗng đã được "mượn" để đặt tên (không mượn lại)
    for (const [name, color] of wantLabels) {
      if (!name || haveLabel.has(name.toLowerCase())) continue;
      const blank = existingLabels.find(l =>
        !(l.name ?? '').trim() && l.color === color && !usedBlank.has(l.id));
      if (blank) {
        await TrelloClient.updateLabel(blank.id, name);   // đặt tên cho nhãn màu rỗng → giữ nguyên màu
        usedBlank.add(blank.id);
        result.renamedLabels.push(name);
      } else {
        await TrelloClient.createLabel(boardId, name, color);
        result.createdLabels.push(name);
      }
      haveLabel.add(name.toLowerCase());
    }

    log.info({ boardId, ...result }, 'Board provisioned (list + label: đổi tên nhãn rỗng / tạo phần còn thiếu)');
    return result;
  },
};
