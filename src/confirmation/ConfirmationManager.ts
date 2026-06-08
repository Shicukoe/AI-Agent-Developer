import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { StageRouter } from '../agents/StageRouter.js';
import { config, stageForListName } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';

const log = childLogger('confirmation');

// Từ khoá lệnh (không phân biệt hoa thường, cho cả tiếng Việt). MODIFY xử lý riêng theo tiền tố.
const RETRY_WORDS = ['RETRY', 'THỬ LẠI', 'CHẠY LẠI', 'CHẠY TIẾP', 'TIẾP TỤC', 'LÀM LẠI'];
const REFINE_WORDS = ['REFINE', 'LÀM RÕ', 'PHÂN TÍCH', 'CHUẨN HOÁ', 'CHUẨN HÓA'];
const REJECT_WORDS = ['REJECT', 'HUỶ', 'HỦY', 'TỪ CHỐI', 'BỎ'];

// Status đang chạy dở — không can thiệp giữa chừng.
const IN_FLIGHT = new Set(['processing', 'developing', 'testing']);

/**
 * Handles admin comments during the Planning stage.
 * Plan approval itself is done via the `plan approve` label (see StageRouter.onPlanApprove);
 * comments only drive re-planning (RETRY / MODIFY) or cancellation (REJECT).
 */
export const ConfirmationManager = {
  async handleAdminReply(cardId: string, memberId: string, text: string): Promise<void> {
    if (!config.ADMIN_TRELLO_MEMBER_IDS.includes(memberId)) {
      log.debug({ memberId }, 'Reply not from admin — ignored');
      return;
    }

    // Tìm task bất kỳ trạng thái (kể cả 'failed') để có thể chạy lại task lỗi.
    const task = TaskRepository.findByCardId(cardId);
    if (!task) return;

    const textUpper = text.trim().toUpperCase();
    const isRetry = RETRY_WORDS.some(w => textUpper === w || textUpper.startsWith(w));
    const isRefine = REFINE_WORDS.some(w => textUpper === w || textUpper.startsWith(w));
    const isReject = REJECT_WORDS.some(w => textUpper === w || textUpper.startsWith(w));
    const isModify = textUpper.startsWith('MODIFY');

    // REFINE: làm rõ lại task (sau khi admin bổ sung thông tin / trả lời câu hỏi).
    if (isRefine) {
      if (IN_FLIGHT.has(task.status)) {
        await TrelloClient.addComment(cardId, '⏳ **[AI AGENT]** Task đang chạy, vui lòng đợi xong rồi gửi REFINE.');
        return;
      }
      await TrelloClient.addComment(cardId, '🔄 **[AI AGENT]** Đang làm rõ lại task...');
      log.info({ taskId: task.id, memberId, prevStatus: task.status }, 'Re-refining on REFINE');
      await StageRouter.runRefine(task);
      return;
    }

    if (isRetry) {
      if (IN_FLIGHT.has(task.status)) {
        await TrelloClient.addComment(cardId, '⏳ **[AI AGENT]** Task đang chạy, vui lòng đợi xong rồi thử lại.');
        return;
      }
      // RETRY chạy lại ĐÚNG stage hiện tại của card (không cần kéo qua lại):
      //   Refine → làm rõ lại · Dev → code lại · Test → review lại · còn lại → lập lại plan.
      const stage = await this.currentStage(task);
      log.info({ taskId: task.id, memberId, stage, prevStatus: task.status }, 'RETRY by stage');
      switch (stage) {
        case 'refine':
          await TrelloClient.addComment(cardId, '🔄 **[AI AGENT]** Đang làm rõ lại task...');
          await StageRouter.runRefine(task);
          return;
        case 'dev':
          await TrelloClient.addComment(cardId, '🔄 **[AI AGENT]** Đang chạy lại Dev (code lại theo phản hồi)...');
          await StageRouter.runDev(task);
          return;
        case 'test':
          await TrelloClient.addComment(cardId, '🔄 **[AI AGENT]** Đang review lại...');
          await StageRouter.runTest(task);
          return;
        default:
          await TrelloClient.addComment(cardId, '🔄 **[AI AGENT]** Đang lập lại kế hoạch...');
          await StageRouter.runPlanning(task);
          return;
      }
    }

    if (isModify) {
      const instruction = text.replace(/^MODIFY[:\s]*/i, '').trim();
      if (IN_FLIGHT.has(task.status)) {
        await TrelloClient.addComment(cardId, '⏳ **[AI AGENT]** Task đang chạy, vui lòng đợi xong rồi gửi MODIFY.');
        return;
      }
      await TrelloClient.addComment(cardId, `🔄 **[AI AGENT]** Đang cập nhật kế hoạch theo yêu cầu:\n> ${instruction}`);
      log.info({ taskId: task.id, instruction }, 'Re-planning on MODIFY');
      await StageRouter.runPlanning(task, instruction);
      return;
    }

    if (isReject) {
      TaskRepository.setStatus(task.id, 'failed', { error_message: `Rejected by admin: ${memberId}` });
      await TrelloClient.addComment(cardId, `❌ **[AI AGENT]** Task bị từ chối bởi admin.`);
      log.info({ taskId: task.id, memberId }, 'Task rejected');
      return;
    }
  },

  /** Xác định stage hiện tại của card (theo list nó đang nằm), null nếu không phải stage list. */
  async currentStage(task: Task): Promise<ReturnType<typeof stageForListName>> {
    try {
      const card = await TrelloClient.getCard(task.card_id);
      const lists = await TrelloClient.getLists(card.idBoard);
      const list = lists.find(l => l.id === card.idList);
      return list ? stageForListName(list.name) : null;
    } catch (err) {
      log.warn({ taskId: task.id, err }, 'Không xác định được stage hiện tại');
      return null;
    }
  },
};
