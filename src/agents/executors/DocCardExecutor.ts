import { LlmClient } from '../../claude/LlmClient.js';
import { TrelloClient } from '../../trello/TrelloClient.js';
import { TaskRepository } from '../../state/TaskRepository.js';
import { CardMemory } from '../CardMemory.js';
import { ProjectDocs } from '../ProjectDocs.js';
import { RepoRegistry } from '../../repos/RepoRegistry.js';
import { config } from '../../config.js';
import { childLogger } from '../../utils/logger.js';
import type { Task } from '../../state/TaskRepository.js';
import type { Executor } from './types.js';

const log = childLogger('doc-card-executor');

// Trello giới hạn mô tả card ~16384 ký tự — chừa biên an toàn.
const MAX_DESC = 16000;

interface DocResult {
  card_title: string;
  card_body: string;
}

/** Đọc tên list đích do người dùng chỉ định (RefineAgent lưu vào metadata). */
function metaTargetList(task: Task): string {
  if (!task.metadata) return '';
  try {
    const m = JSON.parse(task.metadata) as { doc_target_list?: string };
    return (m.doc_target_list ?? '').trim();
  } catch {
    return '';
  }
}

/** Fallback: bắt chỉ định "list <TÊN>" / "trong list <TÊN>" ngay trong mô tả card. */
function parseTargetList(desc: string): string {
  const m = (desc ?? '').match(/(?:trong\s+|vào\s+)?list[:\s]+["'`]?([\p{L}0-9_\- ]{1,40}?)["'`]?(?:[.,\n]|$)/iu);
  return m ? m[1].trim() : '';
}

function buildPrompt(cardName: string, cardDesc: string, memoryContext: string, cacheSummary: string, repoPath: string): string {
  const cacheBlock = cacheSummary
    ? `\n## Bản đồ dự án (tham khảo — dùng để biết đọc file nào, đừng quét lại toàn repo)\n${cacheSummary}\n`
    : '';
  return `Bạn là người viết tài liệu kỹ thuật cho dự án tại ${repoPath}.
${cacheBlock}
## Nhiệm vụ
Sản phẩm của task này là **một thẻ (card) Trello chứa tài liệu** — KHÔNG phải code.
Hãy đọc yêu cầu, dựa vào bản đồ dự án để biết đọc file nào, dùng Read/Glob/Grep cho các file trọng điểm khi cần,
rồi viết NỘI DUNG TÀI LIỆU hoàn chỉnh (markdown) để đặt vào mô tả của card mới.

## Yêu cầu (từ card nguồn)
**Tiêu đề:** ${cardName}
**Mô tả:**
${cardDesc || '(trống)'}
${memoryContext}
## Quy tắc
- Viết bằng TIẾNG VIỆT, rõ ràng, có cấu trúc (heading, bước, ví dụ). Giữ nguyên tên file/biến/code.
- Nội dung phải đầy đủ, chính xác theo codebase thực tế (đừng bịa).
- \`card_title\` ngắn gọn. \`card_body\` là markdown, tối đa ~${MAX_DESC} ký tự.

## Required JSON response schema
\`\`\`json
{
  "card_title": "Tiêu đề card tài liệu",
  "card_body": "toàn bộ nội dung tài liệu dạng markdown"
}
\`\`\``;
}

export const DocCardExecutor: Executor = {
  kind: 'doc_card',
  label: 'Tạo card tài liệu',

  async run(task: Task): Promise<void> {
    log.info({ taskId: task.id, cardId: task.card_id }, 'DocCardExecutor starting');

    const card = await TrelloClient.getCard(task.card_id);
    let memoryContext = await CardMemory.loadContext(task.card_id);
    const epicId = CardMemory.parseEpicId(card.desc);
    if (epicId) memoryContext += await CardMemory.epicContext(epicId);

    const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
    const cacheSummary = ProjectDocs.guidance(repoPath, RepoRegistry.docsPathForTask(task));
    const doc = await LlmClient.runForJson<DocResult>(
      buildPrompt(card.name, card.desc, memoryContext, cacheSummary, repoPath),
      config.MODEL_DEV,
      { allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 20, timeoutMs: config.REFINE_TIMEOUT_MS, label: `doc:${task.card_id.slice(0, 6)}` },
    );

    const title = (doc.card_title || `Tài liệu: ${card.name}`).slice(0, 200);
    let body = doc.card_body || '(không có nội dung)';
    if (body.length > MAX_DESC) body = body.slice(0, MAX_DESC) + '\n\n…(đã cắt bớt do giới hạn Trello)';

    // Chọn list đích:
    //  1) List người dùng chỉ định trong task (metadata từ Refine, hoặc parse từ mô tả) — tạo mới nếu chưa có.
    //  2) TRELLO_DOCS_LIST_NAMES → 3) Info list → 4) list nguồn → 5) list đầu tiên.
    const lists = await TrelloClient.getLists(task.board_id);
    const inNames = (names: string[], name: string) => names.map(n => n.toUpperCase()).includes(name.toUpperCase());
    const findByName = (name: string) => lists.find(l => l.name.toUpperCase() === name.toUpperCase());

    const requested = metaTargetList(task) || parseTargetList(card.desc);
    let target;
    if (requested) {
      target = findByName(requested);
      if (!target) {
        target = await TrelloClient.createList(task.board_id, requested);
        log.info({ taskId: task.id, list: requested }, 'Created requested target list');
      }
    } else {
      target =
        lists.find(l => inNames(config.TRELLO_DOCS_LIST_NAMES, l.name)) ??
        lists.find(l => inNames(config.TRELLO_INFO_LIST_NAMES, l.name)) ??
        lists.find(l => l.id === task.list_id) ??
        lists[0];
    }
    if (!target) throw new Error('Không tìm thấy list để đặt card tài liệu');

    const created = await TrelloClient.createCard(target.id, title, body);

    await TrelloClient.addComment(task.card_id,
      `✅ **[AI AGENT]** Đã tạo card tài liệu: **${title}** trong list **${target.name}**.\n${created.url ?? ''}`);
    await CardMemory.post(task.card_id, 'Doc',
      `Đã sinh card tài liệu **${title}** (list ${target.name}).`).catch(() => {});

    TaskRepository.setStatus(task.id, 'completed');
    log.info({ taskId: task.id, docCardId: created.id, list: target.name }, 'Doc card created');
  },
};
