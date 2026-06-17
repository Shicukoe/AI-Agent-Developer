import { LlmClient } from '../claude/LlmClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { CardMemory } from './CardMemory.js';
import { ProjectKnowledge } from './ProjectKnowledge.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { TrelloCard } from '../trello/types.js';
import type { AnalystResponse } from '../claude/types.js';

const log = childLogger('business-analyst');

function buildBaPrompt(card: TrelloCard, cacheSummary: string, memory: string, repoPath: string): string {
  const base = PromptBuilder.planner(card, '', config.MODEL_REFINE, repoPath).replace(/\nAnalyze.*$/s, '');
  return `Bạn là BUSINESS ANALYST. Phân tích yêu cầu theo góc NGHIỆP VỤ (người dùng muốn gì, vì sao) — CHƯA đi vào kỹ thuật.
${cacheSummary ? `\n## Bản đồ dự án (để hiểu bối cảnh)\n${cacheSummary}\n` : ''}
${base}
${memory}

## Nhiệm vụ
1. Làm rõ MỤC TIÊU nghiệp vụ + bối cảnh/phạm vi.
2. Liệt kê YÊU CẦU nghiệp vụ đã giải nghĩa + TIÊU CHÍ NGHIỆM THU (góc người dùng).
3. Thiếu thông tin quan trọng → đặt \`open_questions\`, để \`confidence\` thấp (< 0.7).
4. Nếu yêu cầu gồm NHIỀU đầu việc nghiệp vụ độc lập → liệt kê vào \`business_subtasks\` (để bước kỹ thuật biết phân rã). KHÔNG tự tạo card. Nếu 1 việc đơn → [].
Đọc code chỉ để HIỂU bối cảnh (Read/Glob/Grep theo bản đồ dự án) — KHÔNG quyết định kỹ thuật.

NGÔN NGỮ: tiếng Việt; giữ nguyên tên file/biến/hàm/code.

## Required JSON response schema
\`\`\`json
{
  "intent": "mục tiêu nghiệp vụ",
  "context": "bối cảnh / phạm vi",
  "requirements": ["yêu cầu nghiệp vụ 1", "..."],
  "acceptance_criteria": ["tiêu chí 1", "..."],
  "open_questions": [],
  "confidence": 0.9,
  "business_subtasks": [{ "title": "Đầu việc A", "description": "mô tả nghiệp vụ" }]
}
\`\`\`
business_subtasks = [] nếu là 1 việc đơn. open_questions = [] nếu đủ thông tin.`;
}

export const BusinessAnalystAgent = {
  /** Phân tích nghiệp vụ rồi CHUYỂN cho Technical Refiner (in-flight) — KHÔNG tạo card con. */
  async run(task: Task): Promise<AnalystResponse> {
    log.info({ taskId: task.id }, 'BusinessAnalyst starting');
    const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
    const card = await TrelloClient.getCard(task.card_id);
    const memory = await CardMemory.loadContext(task.card_id);
    // Overview (tổng thể) + kiến trúc luồng LIÊN QUAN (chọn theo card) → đọc ít, tập trung đúng luồng.
    const cacheSummary = await ProjectKnowledge.contextForTask(task, `${card.name}\n${card.desc ?? ''}`, 3000);

    let analyst: AnalystResponse;
    try {
      analyst = await LlmClient.runForJson<AnalystResponse>(
        buildBaPrompt(card, cacheSummary, memory, repoPath),
        config.MODEL_REFINE,
        { allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 12, timeoutMs: config.REFINE_TIMEOUT_MS, label: `ba:${task.card_id.slice(0, 6)}` },
      );
    } catch (err) {
      // CLI thi thoảng chỉ "chào" rồi dừng (không trả JSON). KHÔNG để crash cả task — dùng phân tích
      // tối thiểu từ card và chuyển sang bước KỸ THUẬT (Tech sẽ đọc code + làm spec thật).
      log.warn({ taskId: task.id, err: (err as Error).message }, 'BA LLM không trả JSON — fallback phân tích từ card');
      await CardMemory.post(task.card_id, 'Business Analysis (fallback)',
        'BA không trả kết quả hợp lệ (Claude CLI thất thường) — dùng phân tích tối thiểu từ card, chuyển sang bước kỹ thuật.').catch(() => {});
      return {
        intent: card.name,
        context: '',
        requirements: [(card.desc ?? '').slice(0, 1500) || card.name],
        acceptance_criteria: [],
        open_questions: [],
        confidence: 0.8,            // đủ cao để KHÔNG kẹt ở "chờ làm rõ" → đi tiếp Tech
        business_subtasks: [],
      };
    }

    const nSub = (analyst.business_subtasks ?? []).length;
    await CardMemory.post(task.card_id, 'Business Analysis',
      `**Mục tiêu:** ${analyst.intent}\n**Yêu cầu:** ${(analyst.requirements ?? []).join('; ') || '—'}` +
      `${nSub > 1 ? `\n**Đầu việc nghiệp vụ (gợi ý phân rã):** ${analyst.business_subtasks.map(s => s.title).join('; ')}` : ''}`).catch(() => {});

    return analyst;
  },
};
