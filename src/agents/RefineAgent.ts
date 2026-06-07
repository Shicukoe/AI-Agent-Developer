import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ClaudeCliClient } from '../claude/ClaudeCliClient.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { CardMemory } from './CardMemory.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { config, firstPlanningListName } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task, TaskType } from '../state/TaskRepository.js';
import type { RefineResponse } from '../claude/types.js';

const log = childLogger('refine-agent');

/** Mốc đầu phần mô tả đã chuẩn hoá và phần giữ nguyên yêu cầu gốc. */
const STD_MARKER = '## 🤖 Task đã chuẩn hoá';
const ORIGINAL_MARKER = '## 📌 Yêu cầu gốc (giữ nguyên)';

/** Lấy phần "yêu cầu gốc" để bảo toàn qua các lần refine (idempotent). */
function extractOriginal(desc: string): string {
  const idx = desc.indexOf(ORIGINAL_MARKER);
  if (idx >= 0) return desc.slice(idx + ORIGINAL_MARKER.length).trim();
  return desc.trim();
}

function buildRefinePrompt(card: Parameters<typeof PromptBuilder.planner>[0], memoryContext: string): string {
  return `Bạn là chuyên viên phân tích yêu cầu phần mềm cho hệ thống báo cáo dự án xây dựng (Odoo 16 + React 18).

## Nhiệm vụ
Người dùng vừa tạo một task còn SƠ SÀI, tuỳ tiện, chưa đúng format chuẩn. Hãy:
1. Đọc kỹ card Trello và dùng tool Read/Glob/Grep khám phá phần codebase liên quan tại: ${config.GIT_REPO_PATH}
2. LÀM RÕ và GIẢI NGHĨA từng chức năng còn mơ hồ.
3. Chuẩn hoá task về một format thống nhất (mục tiêu, bối cảnh, yêu cầu chi tiết, tiêu chí nghiệm thu, test case).
4. Với task kiểu "thêm/sửa field" (vd thêm cột employee_name): điền \`field_details\` đầy đủ — kiểu dữ liệu, tên hiển thị, model/bảng đích, validation, default.
5. Nếu còn thiếu thông tin để làm được task, ĐẶT CÂU HỎI rõ ràng trong \`open_questions\` và đặt \`confidence\` thấp (< 0.7).
6. Phân loại quy mô \`size\`: "small" (sửa nhỏ, không cần kế hoạch), "large" (cần lập plan), "epic" (feature lớn nhiều phần việc).
7. Phân loại năng lực \`kind\` — sản phẩm của task là gì:
   - "code": viết/sửa code hoặc file trong repo (mặc định cho hầu hết task).
   - "doc_card": sản phẩm là **một thẻ Trello chứa tài liệu/nội dung** (vd "tạo card hướng dẫn...", "tạo thẻ tổng hợp..."), KHÔNG đụng tới code/repo.
8. Nếu là "doc_card" và người dùng có **chỉ định tên list đích** để đặt card kết quả (vd "tạo hướng dẫn trong list INFO"), điền tên list đó vào \`target_list\`. Không nói rõ thì để rỗng.

${PromptBuilder.planner(card, '').replace(/\nAnalyze.*$/s, '')}
${memoryContext}
NGÔN NGỮ: Viết toàn bộ nội dung trả về bằng TIẾNG VIỆT. Giữ nguyên tên file/biến/hàm/model/code.

\`standardized_description\` phải là MARKDOWN sạch theo bố cục:
${STD_MARKER}
**Mục tiêu:** ...
**Bối cảnh / phạm vi:** ...
**Yêu cầu chi tiết:**
- ...
**(nếu có) Field cần thêm/sửa:**
- \`name\` — kiểu: ..., hiển thị: ..., model: ..., validation: ..., default: ...
**Tiêu chí nghiệm thu:**
- ...
**Test case (nếu cần):**
- ...

KHÔNG tự thêm phần "Yêu cầu gốc" — hệ thống tự nối phần đó.

## Required JSON response schema
Return a JSON code block with this exact structure:
\`\`\`json
{
  "intent": "một câu mô tả mục tiêu",
  "context": "bối cảnh / phạm vi",
  "requirements": ["yêu cầu 1 đã giải nghĩa rõ", "yêu cầu 2"],
  "field_details": [
    { "name": "employee_name", "data_type": "char", "display_label": "Tên nhân viên", "model": "hr.employee", "validation": "required", "default": "" }
  ],
  "acceptance_criteria": ["tiêu chí 1", "tiêu chí 2"],
  "test_cases": [{ "name": "...", "description": "...", "expected": "..." }],
  "open_questions": [],
  "size": "small|large|epic",
  "kind": "code|doc_card",
  "target_list": "",
  "confidence": 0.9,
  "standardized_description": "markdown đã chuẩn hoá theo bố cục ở trên"
}
\`\`\`
field_details để [] nếu task không liên quan tới field. open_questions để [] nếu đã đủ thông tin.`;
}

export const RefineAgent = {
  async run(task: Task): Promise<RefineResponse> {
    log.info({ taskId: task.id, cardId: task.card_id }, 'RefineAgent starting');

    const card = await TrelloClient.getCard(task.card_id);

    // Nạp memory đã ghi + (nếu là card thuộc epic) bối cảnh feature lớn
    let memoryContext = await CardMemory.loadContext(task.card_id);
    const epicId = CardMemory.parseEpicId(card.desc);
    if (epicId) memoryContext += await CardMemory.epicContext(epicId);

    const refined = await ClaudeCliClient.runForJson<RefineResponse>(
      buildRefinePrompt(card, memoryContext),
      { allowedTools: ['Read', 'Glob', 'Grep'], cwd: config.GIT_REPO_PATH, maxTurns: 20 },
    );

    // Ghi đè mô tả card theo format chuẩn, giữ nguyên yêu cầu gốc (idempotent).
    const original = extractOriginal(card.desc ?? '');
    const std = refined.standardized_description?.trim() || '(không có nội dung chuẩn hoá)';
    const newDesc =
      `${std}\n\n---\n${ORIGINAL_MARKER}\n${original || '(trống)'}`;
    await TrelloClient.updateCardDescription(task.card_id, newDesc).catch(err =>
      log.warn({ taskId: task.id, err }, 'Không ghi đè được mô tả card'),
    );

    const size = (refined.size ?? 'large') as RefineResponse['size'];
    const kind = (refined.kind ?? 'code') as RefineResponse['kind'];
    const taskType: TaskType = size === 'epic' ? 'epic' : size === 'large' ? 'large' : 'small';
    TaskRepository.update(task.id, { task_type: taskType });
    // Lưu kind để runDev chọn đúng executor (code → DevAgent, doc_card → DocCardExecutor...).
    // Với doc_card: lưu thêm tên list đích nếu người dùng chỉ định.
    const targetList = (refined.target_list ?? '').trim();
    TaskRepository.mergeMetadata(task.id, { kind, ...(targetList ? { doc_target_list: targetList } : {}) });

    await this.postRefineComment(task.card_id, refined);
    await CardMemory.post(task.card_id, 'Refine',
      `**Đã làm rõ task.** Phân loại: **${size}**. ${refined.intent}\n` +
      (refined.open_questions.length > 0 ? `Còn ${refined.open_questions.length} câu hỏi chờ trả lời.` : 'Thông tin đã đủ.'),
    ).catch(() => {});

    const needsInfo =
      refined.open_questions.length > 0 ||
      (refined.confidence ?? 1) < RuleEngine.getConfidenceThreshold();

    if (needsInfo) {
      TaskRepository.setStatus(task.id, 'awaiting_clarification', { error_message: 'Waiting for clarification' });
      log.info({ taskId: task.id, questions: refined.open_questions.length }, 'Refine: awaiting clarification');
      return refined;
    }

    // Task tạo card tài liệu: pre-approve để kéo thẳng sang Dev (DocCardExecutor sẽ chạy), bỏ qua Planning.
    if (kind === 'doc_card') {
      TaskRepository.setStatus(task.id, 'plan_approved');
      const where = targetList ? ` (sẽ đặt trong list **${targetList}**)` : '';
      await TrelloClient.addComment(task.card_id,
        `📄 **[AI AGENT]** Task tạo **card tài liệu** đã được làm rõ${where}. Kéo card sang list **Dev** — tôi sẽ sinh card tài liệu (không qua git/Test).`);
      log.info({ taskId: task.id, kind, targetList }, 'Refine done (doc_card)');
      return refined;
    }

    // Đủ thông tin → gợi ý bước kế tiếp theo quy mô.
    if (size === 'small') {
      // Task nhỏ: ghi spec làm plan_file_path để Dev dùng thẳng, pre-approve nhẹ.
      const planDir = join(config.DATA_DIR, 'plans');
      mkdirSync(planDir, { recursive: true });
      const planPath = join(planDir, `${task.id}.md`);
      writeFileSync(planPath, this.formatSpec(refined, card.name), 'utf8');
      TaskRepository.update(task.id, { plan_file_path: planPath });
      TaskRepository.setStatus(task.id, 'plan_approved');
      await TrelloClient.addComment(task.card_id,
        '✅ **[AI AGENT]** Task nhỏ đã được làm rõ và có sẵn spec. Kéo card sang list **Dev** để bắt đầu code (không cần qua Planning).');
    } else if (size === 'epic') {
      await TrelloClient.addComment(task.card_id,
        '🧩 **[AI AGENT]** Đây là feature lớn (**EPIC**). Kéo card sang list **Epic** để lập kế hoạch tổng và sinh card con.');
    } else {
      await TrelloClient.addComment(task.card_id,
        '📋 **[AI AGENT]** Task đã được làm rõ. Kéo card sang list **Planning** để lập kế hoạch đầy đủ.');
    }

    log.info({ taskId: task.id, size }, 'Refine done');
    return refined;
  },

  formatSpec(refined: RefineResponse, cardName: string): string {
    const fields = (refined.field_details ?? [])
      .map(f => `- \`${f.name}\` — kiểu: ${f.data_type}; hiển thị: ${f.display_label}; model: ${f.model}` +
        `${f.validation ? `; validation: ${f.validation}` : ''}${f.default ? `; default: ${f.default}` : ''}`)
      .join('\n');
    const tests = (refined.test_cases ?? [])
      .map(t => `- **${t.name}**: ${t.description} → Expected: ${t.expected}`)
      .join('\n');

    return (
      `# Spec (task nhỏ): ${cardName}\n\n` +
      `## Mục tiêu\n${refined.intent}\n\n` +
      `## Bối cảnh\n${refined.context || '—'}\n\n` +
      `## Yêu cầu chi tiết\n${refined.requirements.map(r => `- ${r}`).join('\n') || '- —'}\n\n` +
      (fields ? `## Field cần thêm/sửa\n${fields}\n\n` : '') +
      `## Tiêu chí nghiệm thu\n${refined.acceptance_criteria.map(c => `- ${c}`).join('\n') || '- —'}\n\n` +
      (tests ? `## Test case\n${tests}\n` : '')
    );
  },

  async postRefineComment(cardId: string, refined: RefineResponse): Promise<void> {
    const fields = (refined.field_details ?? [])
      .map(f => `- \`${f.name}\`: ${f.data_type} · ${f.display_label} · ${f.model}` +
        `${f.validation ? ` · ${f.validation}` : ''}`)
      .join('\n');
    const questions = refined.open_questions.map(q => `- ❓ ${q}`).join('\n');

    const comment =
      `📝 **[AI AGENT] Đã làm rõ task** (phân loại: **${refined.size}**)\n\n` +
      `**Mục tiêu:** ${refined.intent}\n\n` +
      (fields ? `**Field:**\n${fields}\n\n` : '') +
      `**Tiêu chí nghiệm thu:**\n${refined.acceptance_criteria.map(c => `- ${c}`).join('\n') || '- —'}\n\n` +
      (questions
        ? `**⚠️ Cần bạn làm rõ thêm:**\n${questions}\n\nTrả lời vào comment rồi reply \`REFINE\` để tôi cập nhật lại.\n`
        : '') +
      `---\nMô tả card đã được chuẩn hoá (yêu cầu gốc vẫn được giữ ở cuối).`;

    await TrelloClient.addComment(cardId, comment);
  },
};
