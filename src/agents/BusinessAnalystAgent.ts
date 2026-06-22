import { LlmClient } from '../claude/LlmClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { CardMemory } from './CardMemory.js';
import { ProjectDocs } from './ProjectDocs.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { TrelloCard } from '../trello/types.js';
import type { AnalystResponse } from '../claude/types.js';

const log = childLogger('business-analyst');

function buildBaPrompt(card: TrelloCard, docsGuidance: string, memory: string, repoPath: string, docsExist: boolean): string {
  const base = PromptBuilder.planner(card, '', config.MODEL_REFINE, repoPath).replace(/\nAnalyze.*$/s, '');
  const sourceRule = docsExist
    ? 'CHỈ đọc TÀI LIỆU dự án (docs) + card, KHÔNG đọc mã nguồn'
    : 'CHƯA có docs → đọc TRỰC TIẾP mã nguồn (Read/Glob/Grep) + card để hiểu nghiệp vụ';
  return `Bạn là BUSINESS ANALYST. Phân tích yêu cầu theo góc NGHIỆP VỤ (người dùng muốn gì, vì sao) — CHƯA đi vào kỹ thuật.

${docsGuidance}

${base}
${memory}

## Nhiệm vụ
1. Làm rõ MỤC TIÊU nghiệp vụ + bối cảnh/phạm vi (${sourceRule}).
2. Liệt kê YÊU CẦU nghiệp vụ đã giải nghĩa + TIÊU CHÍ NGHIỆM THU (góc người dùng).
   ⮑ Mỗi tiêu chí viết dạng **ĐIỀU KIỆN quan sát được** (tình huống → kết quả/hành vi mong đợi), KHÔNG
   ràng buộc cách hiện thực. Đủ rộng để **mọi cách giải thoả điều kiện đều được chấp nhận** — tester sẽ
   chấm theo điều kiện này, nên đừng mô tả thành một cách làm cụ thể.
3. Thiếu thông tin quan trọng → đặt \`open_questions\`, để \`confidence\` thấp (< 0.7).
4. Nếu yêu cầu gồm NHIỀU đầu việc nghiệp vụ độc lập → liệt kê vào \`business_subtasks\`. KHÔNG tự tạo card. Nếu 1 việc đơn → [].
5. Nếu dự án CHƯA có tài liệu (docs) → đặt \`docs_missing: true\`.
6. ĐỊNH TUYẾN \`decision\` (mức nghiệp vụ): "trivial_solve" = thay đổi nhỏ rõ ràng, code ngay được;
   "design_solve" = cần lập kế hoạch; "epic_solve" = feature lớn nhiều đầu việc (business_subtasks > 1).

## NGẮN GỌN — quan trọng
Viết để người đọc hiểu trong **5–10 phút**: súc tích, gạch đầu dòng, KHÔNG lan man/lặp lại/diễn giải dài.
\`intent\` 1–2 câu; \`context\` ≤ 3 câu; mỗi \`requirements\`/\`acceptance_criteria\` 1 dòng ngắn. Bỏ chữ thừa.

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
  "business_subtasks": [{ "title": "Đầu việc A", "description": "mô tả nghiệp vụ" }],
  "docs_missing": false,
  "decision": "design_solve"
}
\`\`\`
business_subtasks = [] nếu là 1 việc đơn. open_questions = [] nếu đủ thông tin.`;
}

export const BusinessAnalystAgent = {
  /** Phân tích nghiệp vụ (đọc TÀI LIỆU thật trong repo) rồi CHUYỂN cho Technical Refiner — KHÔNG tạo card con. */
  async run(task: Task): Promise<AnalystResponse> {
    log.info({ taskId: task.id }, 'BusinessAnalyst starting');
    const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
    const docsPath = RepoRegistry.docsPathForTask(task);
    const docsExist = ProjectDocs.exists(docsPath);
    const card = await TrelloClient.getCard(task.card_id);
    const memory = await CardMemory.loadContext(task.card_id);
    const docsGuidance = ProjectDocs.guidance(repoPath, docsPath);

    let analyst: AnalystResponse;
    try {
      analyst = await LlmClient.runForJson<AnalystResponse>(
        buildBaPrompt(card, docsGuidance, memory, repoPath, docsExist),
        config.MODEL_REFINE,
        { allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 12, timeoutMs: config.REFINE_TIMEOUT_MS, label: `ba:${task.card_id.slice(0, 6)}` },
      );
    } catch (err) {
      // CLI thi thoảng chỉ "chào" rồi dừng (không trả JSON). KHÔNG để crash cả task — fallback từ card.
      log.warn({ taskId: task.id, err: (err as Error).message }, 'BA LLM không trả JSON — fallback phân tích từ card');
      await CardMemory.post(task.card_id, 'Business Analysis (fallback)',
        'BA không trả kết quả hợp lệ — dùng phân tích tối thiểu từ card, chuyển sang bước kỹ thuật.').catch(() => {});
      return {
        intent: card.name, context: '',
        requirements: [(card.desc ?? '').slice(0, 1500) || card.name],
        acceptance_criteria: [], open_questions: [], confidence: 0.8,
        business_subtasks: [], docs_missing: !docsExist,
      };
    }

    const docsMissing = analyst.docs_missing || !docsExist;
    const nSub = (analyst.business_subtasks ?? []).length;
    await CardMemory.post(task.card_id, 'Business Analysis',
      `**Mục tiêu:** ${analyst.intent}\n**Yêu cầu:** ${(analyst.requirements ?? []).join('; ') || '—'}` +
      `${nSub > 1 ? `\n**Đầu việc nghiệp vụ (gợi ý phân rã):** ${analyst.business_subtasks.map(s => s.title).join('; ')}` : ''}`).catch(() => {});

    if (docsMissing) {
      await TrelloClient.addComment(task.card_id,
        '⚠️ **[AI AGENT]** Dự án **chưa có tài liệu** — kết quả nghiệp vụ dựa trên card là chính. ' +
        'Chạy `npm run gen-docs` (hoặc nút **Generate docs** ở admin) để sinh tài liệu rồi reply `REFINE` để làm rõ chính xác hơn.').catch(() => {});
    }
    return { ...analyst, docs_missing: docsMissing };
  },
};
