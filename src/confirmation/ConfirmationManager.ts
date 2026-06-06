import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { StageRouter } from '../agents/StageRouter.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('confirmation');

// Từ khoá lệnh (không phân biệt hoa thường, cho cả tiếng Việt). MODIFY xử lý riêng theo tiền tố.
const RETRY_WORDS = ['RETRY', 'THỬ LẠI', 'CHẠY LẠI', 'CHẠY TIẾP', 'TIẾP TỤC', 'LÀM LẠI'];
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
    const isReject = REJECT_WORDS.some(w => textUpper === w || textUpper.startsWith(w));
    const isModify = textUpper.startsWith('MODIFY');

    if (isRetry) {
      if (IN_FLIGHT.has(task.status)) {
        await TrelloClient.addComment(cardId, '⏳ **[AI AGENT]** Task đang chạy, vui lòng đợi xong rồi thử lại.');
        return;
      }
      await TrelloClient.addComment(cardId, '🔄 **[AI AGENT]** Đang lập lại kế hoạch...');
      log.info({ taskId: task.id, memberId, prevStatus: task.status }, 'Re-planning on RETRY');
      await StageRouter.runPlanning(task);
      return;
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
};
