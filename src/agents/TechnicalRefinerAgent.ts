import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { LlmClient } from '../claude/LlmClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { CardMemory } from './CardMemory.js';
import { ProjectKnowledge } from './ProjectKnowledge.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task, TaskType } from '../state/TaskRepository.js';
import type { TrelloCard } from '../trello/types.js';
import type { AnalystResponse, TechRefineResponse } from '../claude/types.js';

const log = childLogger('tech-refiner');
const ORIGINAL_MARKER = '## 📌 Yêu cầu gốc (giữ nguyên)';

function extractOriginal(desc: string): string {
  const idx = desc.indexOf(ORIGINAL_MARKER);
  if (idx >= 0) return desc.slice(idx + ORIGINAL_MARKER.length).trim();
  return desc.trim();
}

/** Card con business (không có AnalystResponse riêng) → dựng phân tích tối thiểu từ chính card. */
function deriveAnalyst(card: TrelloCard): AnalystResponse {
  return {
    intent: card.name,
    context: '',
    requirements: [(card.desc ?? '').slice(0, 1500) || card.name],
    acceptance_criteria: [],
    open_questions: [],
    confidence: 1,
    business_subtasks: [],
  };
}

function buildTechPrompt(card: TrelloCard, analyst: AnalystResponse, memory: string, cacheSummary: string): string {
  const base = PromptBuilder.planner(card, '', config.MODEL_REFINE).replace(/\nAnalyze.*$/s, '');
  const subs = (analyst.business_subtasks ?? []);
  return `Bạn là chuyên viên KỸ THUẬT (Technical Refiner). Đã có phân tích NGHIỆP VỤ cho task này:
- Mục tiêu: ${analyst.intent}
- Yêu cầu nghiệp vụ: ${analyst.requirements.join('; ') || '—'}
- Tiêu chí nghiệm thu (business): ${analyst.acceptance_criteria.join('; ') || '—'}
${subs.length > 1 ? `- ⚠️ Gồm ${subs.length} đầu việc nghiệp vụ độc lập: ${subs.map(s => s.title).join('; ')} → nhiều khả năng là **epic_solve** (để Epic/Planner phân rã kỹ thuật).` : ''}
${cacheSummary ? `\n## Bản đồ dự án (tham khảo — đọc file cụ thể khi cần)\n${cacheSummary}\n` : ''}
${base}
${memory}

## Nhiệm vụ
Đọc code liên quan (Read/Glob/Grep, dùng bản đồ dự án để biết đọc đâu) và QUYẾT ĐỊNH cách giải quyết KỸ THUẬT khớp yêu cầu nghiệp vụ:
- "trivial_solve": thay đổi nhỏ rõ ràng → code ngay, KHÔNG cần plan.
- "design_solve": cần lập kế hoạch chi tiết → Planning.
- "epic_solve": feature lớn nhiều phần việc → Epic.
Phân loại \`kind\`: "code" (sửa/viết code) hoặc "doc_card" (sản phẩm là 1 card tài liệu, không đụng repo).
\`standardized_description\`: markdown spec SẠCH (mục tiêu, yêu cầu chi tiết, field nếu có, tiêu chí nghiệm thu). KHÔNG thêm phần "Yêu cầu gốc".

NGÔN NGỮ: toàn bộ nội dung trả về bằng TIẾNG VIỆT; giữ nguyên tên file/biến/hàm/code.

## Required JSON response schema
\`\`\`json
{
  "decision": "trivial_solve|design_solve|epic_solve",
  "kind": "code|doc_card",
  "standardized_description": "markdown spec",
  "field_details": [],
  "acceptance_criteria": ["..."],
  "test_cases": [{ "name": "...", "description": "...", "expected": "..." }],
  "target_list": "",
  "reason": "vì sao chọn decision này"
}
\`\`\``;
}

function specFromTech(tech: TechRefineResponse, cardName: string): string {
  const fields = (tech.field_details ?? [])
    .map(f => `- \`${f.name}\` — kiểu: ${f.data_type}; hiển thị: ${f.display_label}; model: ${f.model}` +
      `${f.validation ? `; validation: ${f.validation}` : ''}${f.default ? `; default: ${f.default}` : ''}`)
    .join('\n');
  return (
    `# Spec: ${cardName}\n\n${tech.standardized_description}\n\n` +
    (fields ? `## Field cần thêm/sửa\n${fields}\n\n` : '') +
    `## Tiêu chí nghiệm thu\n${(tech.acceptance_criteria ?? []).map(c => `- ${c}`).join('\n') || '- —'}\n`
  );
}

export const TechnicalRefinerAgent = {
  /** Nhận AnalystResponse (hoặc null cho card business) → quyết định kỹ thuật + định tuyến. */
  async run(task: Task, analyst: AnalystResponse | null): Promise<TechRefineResponse> {
    log.info({ taskId: task.id }, 'TechnicalRefiner starting');
    const card = await TrelloClient.getCard(task.card_id);
    const analystResp = analyst ?? deriveAnalyst(card);

    let memory = await CardMemory.loadContext(task.card_id);
    const epicId = CardMemory.parseEpicId(card.desc);
    if (epicId) memory += await CardMemory.epicContext(epicId);
    const cacheSummary = ProjectKnowledge.summary(config.GIT_REPO_PATH, 3000);

    const tech = await LlmClient.runForJson<TechRefineResponse>(
      buildTechPrompt(card, analystResp, memory, cacheSummary),
      config.MODEL_REFINE,
      { allowedTools: ['Read', 'Glob', 'Grep'], cwd: config.GIT_REPO_PATH, maxTurns: 15, label: `tech:${task.card_id.slice(0, 6)}` },
    );

    // Ghi đè mô tả card theo spec chuẩn (giữ yêu cầu gốc).
    const original = extractOriginal(card.desc ?? '');
    const newDesc = `${tech.standardized_description?.trim() || '(không có)'}\n\n---\n${ORIGINAL_MARKER}\n${original || '(trống)'}`;
    await TrelloClient.updateCardDescription(task.card_id, newDesc).catch(err =>
      log.warn({ taskId: task.id, err }, 'Không ghi đè được mô tả card'));

    const kind = tech.kind ?? 'code';
    const targetList = (tech.target_list ?? '').trim();
    TaskRepository.mergeMetadata(task.id, { kind, refine_decision: tech.decision, ...(targetList ? { doc_target_list: targetList } : {}) });
    await CardMemory.post(task.card_id, 'Technical Refine',
      `Quyết định kỹ thuật: **${tech.decision}** (kind=${kind}). ${tech.reason ?? ''}`).catch(() => {});

    // doc_card → pre-approve thẳng Dev (DocCardExecutor).
    if (kind === 'doc_card') {
      TaskRepository.setStatus(task.id, 'plan_approved');
      const where = targetList ? ` (đặt trong list **${targetList}**)` : '';
      await TrelloClient.addComment(task.card_id,
        `📄 **[AI AGENT]** Task tạo **card tài liệu** đã làm rõ${where}. Kéo sang **Dev**.`);
      return tech;
    }

    const taskType: TaskType = tech.decision === 'epic_solve' ? 'epic' : tech.decision === 'design_solve' ? 'large' : 'small';
    TaskRepository.update(task.id, { task_type: taskType });

    if (tech.decision === 'trivial_solve') {
      const planDir = join(config.DATA_DIR, 'plans');
      mkdirSync(planDir, { recursive: true });
      const planPath = join(planDir, `${task.id}.md`);
      writeFileSync(planPath, specFromTech(tech, card.name), 'utf8');
      TaskRepository.update(task.id, { plan_file_path: planPath });
      TaskRepository.setStatus(task.id, 'plan_approved');
      await TrelloClient.addComment(task.card_id,
        '✅ **[AI AGENT]** Đã làm rõ — giải quyết được ngay (không cần Planning). Kéo card sang **Dev**.');
    } else if (tech.decision === 'epic_solve') {
      await TrelloClient.addComment(task.card_id,
        '🧩 **[AI AGENT]** Feature lớn (**EPIC**). Kéo card sang list **Epic** để lập kế hoạch tổng + sinh card con.');
    } else {
      await TrelloClient.addComment(task.card_id,
        '📋 **[AI AGENT]** Đã làm rõ. Kéo card sang list **Planning** để lập kế hoạch đầy đủ.');
    }

    log.info({ taskId: task.id, decision: tech.decision, kind }, 'TechnicalRefiner done');
    return tech;
  },
};
