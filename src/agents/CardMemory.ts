import { readFileSync, existsSync } from 'fs';
import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('card-memory');

/** Mốc nhận dạng comment memory do agent ghi. */
export const MEMORY_MARKER = '🧠 [AI MEMORY]';

/** Mốc trong mô tả card con để trỏ về epic cha. */
const EPIC_RE = /Epic:\s*([A-Za-z0-9]+)/;

const MAX_ADMIN_COMMENTS = 5;     // số comment admin gần nhất nạp lại
const MAX_LEN_EACH = 1500;        // cắt mỗi comment cho gọn token

function truncate(s: string, n = MAX_LEN_EACH): string {
  return s.length > n ? s.slice(0, n) + ' …(cắt bớt)' : s;
}

export const CardMemory = {
  /** Agent ghi một khối memory mới (append) vào card sau mỗi stage. */
  async post(cardId: string, title: string, body: string): Promise<void> {
    const text = `${MEMORY_MARKER} — ${title}\n\n${body.trim()}`;
    await TrelloClient.addComment(cardId, text);
    log.info({ cardId, title }, 'Memory comment posted');
  },

  /**
   * Nạp lại bối cảnh từ comment của card để đưa vào prompt khi chạy lại / có yêu cầu mới:
   * - Khối AI MEMORY mới nhất (memory cô đọng agent tự ghi)
   * - Vài comment admin gần nhất (MODIFY / phản hồi / yêu cầu mới)
   * Trả về '' nếu chưa có gì đáng nạp.
   */
  async loadContext(cardId: string): Promise<string> {
    let comments: Array<{ id: string; text: string; memberId: string; date: string }>;
    try {
      comments = await TrelloClient.getCardComments(cardId, 50);
    } catch (err) {
      log.warn({ cardId, err }, 'Không lấy được comment — bỏ qua memory context');
      return '';
    }

    // comments: mới nhất trước. Lấy tối đa 2 khối memory gần nhất (mới → cũ).
    const memories = comments.filter(c => c.text.startsWith(MEMORY_MARKER)).slice(0, 2);

    const adminComments = comments
      .filter(c => config.ADMIN_TRELLO_MEMBER_IDS.includes(c.memberId))
      .filter(c => !c.text.startsWith(MEMORY_MARKER))
      .slice(0, MAX_ADMIN_COMMENTS)
      .reverse(); // cũ → mới cho dễ đọc

    if (memories.length === 0 && adminComments.length === 0) return '';

    const parts: string[] = ['## Bối cảnh đã ghi nhớ từ card (đọc kỹ trước khi làm)'];

    if (memories.length > 0) {
      const blocks = memories
        .map(m => truncate(m.text.replace(MEMORY_MARKER, '').trim()))
        .join('\n\n---\n\n');
      parts.push(`### Ghi nhớ gần nhất của agent (mới → cũ)\n${blocks}`);
    }
    if (adminComments.length > 0) {
      const lines = adminComments.map(c => `- ${truncate(c.text, 600)}`).join('\n');
      parts.push(`### Phản hồi / yêu cầu gần nhất của admin\n${lines}`);
    }
    parts.push('> Lưu ý: phần "Mô tả card" bên dưới là yêu cầu MỚI NHẤT — nếu mâu thuẫn với ghi nhớ cũ, ưu tiên mô tả card và phản hồi admin.');

    return '\n\n' + parts.join('\n\n') + '\n';
  },

  /** Lấy id epic cha từ mô tả card con (dòng "Epic: <id>"), hoặc null. */
  parseEpicId(desc: string | null | undefined): string | null {
    const m = (desc ?? '').match(EPIC_RE);
    return m ? m[1] : null;
  },

  /**
   * Bối cảnh từ epic cha: PLAN.md tổng + memory gần nhất của epic.
   * Dùng cho card con / card điều chỉnh có dòng "Epic: <id>" trong mô tả.
   */
  async epicContext(epicCardId: string): Promise<string> {
    const parts: string[] = [];

    const epicTask = TaskRepository.findByCardId(epicCardId);
    if (epicTask?.plan_file_path && existsSync(epicTask.plan_file_path)) {
      parts.push(`### Kế hoạch tổng của feature (epic)\n${truncate(readFileSync(epicTask.plan_file_path, 'utf8'), 4000)}`);
    }

    try {
      const comments = await TrelloClient.getCardComments(epicCardId, 30);
      const epicMem = comments.filter(c => c.text.startsWith(MEMORY_MARKER)).slice(0, 2);
      if (epicMem.length > 0) {
        const blocks = epicMem.map(m => truncate(m.text.replace(MEMORY_MARKER, '').trim())).join('\n\n---\n\n');
        parts.push(`### Ghi nhớ của epic (mới → cũ)\n${blocks}`);
      }
    } catch (err) {
      log.warn({ epicCardId, err }, 'Không lấy được comment epic');
    }

    if (parts.length === 0) return '';
    return `\n\n## Bối cảnh từ FEATURE LỚN (epic ${epicCardId}) — task này là một phần của feature đó\n\n` + parts.join('\n\n') + '\n';
  },
};
