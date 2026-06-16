import { LlmClient } from '../claude/LlmClient.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { ProjectKnowledge } from './ProjectKnowledge.js';
import { config, hasQuickLabel } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { TrelloCard } from '../trello/types.js';
import type { TriageResult } from '../claude/types.js';

const log = childLogger('triage');

/** Tiền tố tiêu đề báo hiệu task tí hon. */
const TRIVIAL_PREFIX = /^\s*\[(fix|hotfix|icon|button|text|copy|style|minor)\]/i;
/** Từ khoá "sửa nhỏ" — chỉ là TÍN HIỆU, vẫn cần các điều kiện khác (desc ngắn, không attach/checklist). */
const TRIVIAL_KEYWORDS = ['icon', 'nút', 'button', 'màu', 'color', 'text', 'chữ', 'label', 'rename', 'đổi tên', 'typo', 'format', 'padding', 'margin'];

function hasChecklistItems(card: TrelloCard): boolean {
  return (card.checklists ?? []).some(cl => (cl.checkItems ?? []).length > 0);
}

/** Trivial RÕ RÀNG theo rule (khỏi gọi LLM): tiền tố/keyword + desc ngắn + không attach/checklist. */
function strongRuleTrivial(card: TrelloCard): boolean {
  if ((card.attachments ?? []).length > 0 || hasChecklistItems(card)) return false;
  const desc = (card.desc ?? '').trim();
  if (desc.length > 160) return false;
  const text = `${card.name} ${desc}`.toLowerCase();
  return TRIVIAL_PREFIX.test(card.name) || TRIVIAL_KEYWORDS.some(k => text.includes(k));
}

const SYSTEM = (
  'Bạn phân loại 1 task phần mềm CÓ phải "tí hon, làm-ngay-được" không. ' +
  '"Tí hon" = một thay đổi nhỏ, rõ ràng, cục bộ (sửa icon/text/màu/1 nút/1 field) — code được ngay, ' +
  'KHÔNG cần phân tích nghiệp vụ hay kiến trúc. Trả về DUY NHẤT JSON: ' +
  '{"trivial": true|false, "reason": "...", "spec": "mô tả ngắn việc cần làm nếu trivial"}.'
);

function buildCardText(card: TrelloCard): string {
  return `Tiêu đề: ${card.name}\nMô tả:\n${(card.desc ?? '(trống)').slice(0, 1200)}`;
}

export const TriageAgent = {
  /** Phát hiện task tí hon RẺ (không quét repo). Trả TriageResult. */
  async run(card: TrelloCard, repoPath: string = config.GIT_REPO_PATH): Promise<TriageResult> {
    // 1) Nhãn "quick" → ép trivial, khỏi LLM.
    if (hasQuickLabel(card.labels ?? [])) {
      return { trivial: true, source: 'quick_label', reason: 'Nhãn quick (làm luôn)', spec: card.desc || card.name };
    }

    // 2) RuleEngine thấy LỚN rõ ràng → chắc chắn không trivial, khỏi LLM.
    const decision = RuleEngine.evaluate(card);
    if (decision.taskType === 'large') {
      return { trivial: false, source: 'rule', reason: 'RuleEngine: large' };
    }

    // 3) Trivial RÕ RÀNG theo rule → khỏi LLM.
    if (strongRuleTrivial(card)) {
      return { trivial: true, source: 'rule', reason: 'Rule: trivial rõ ràng', spec: card.desc || card.name };
    }

    // 4) Mơ hồ → 1 LLM call RẺ (chỉ text card + tóm tắt cache, KHÔNG đọc repo).
    try {
      const summary = ProjectKnowledge.summary(repoPath, 1500);
      const prompt =
        `${buildCardText(card)}\n\n` +
        (summary ? `Bối cảnh dự án (tóm tắt):\n${summary}\n\n` : '') +
        `Task này có "tí hon, làm-ngay-được" không?`;
      const res = await LlmClient.runForJson<{ trivial: boolean; reason?: string; spec?: string }>(
        `${SYSTEM}\n\n${prompt}`,
        config.MODEL_TRIAGE,
        { maxTurns: 1, label: `triage:${card.id.slice(0, 6)}` },   // KHÔNG allowedTools → không đọc repo
      );
      return {
        trivial: !!res.trivial,
        source: 'llm',
        reason: res.reason ?? '',
        spec: res.trivial ? (res.spec || card.desc || card.name) : undefined,
      };
    } catch (err) {
      // LLM lỗi → an toàn: coi là KHÔNG trivial (đi luồng phân tích đầy đủ).
      log.warn({ cardId: card.id, err: (err as Error).message }, 'Triage LLM lỗi — mặc định không trivial');
      return { trivial: false, source: 'llm', reason: 'Triage lỗi, mặc định an toàn' };
    }
  },
};
