import { randomUUID } from 'crypto';
import { LlmClient } from '../claude/LlmClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { GitClient } from '../git/GitClient.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { getDb } from '../state/db.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { ReviewResponse } from '../claude/types.js';

const log = childLogger('review-agent');

/** Lấy integration branch (base_branch) nếu task là card con của epic, ngược lại null. */
function parseChildBase(metadata: string | null): string | null {
  if (!metadata) return null;
  try {
    const m = JSON.parse(metadata) as { epic_card_id?: string; base_branch?: string };
    return m.epic_card_id && m.base_branch ? m.base_branch : null;
  } catch {
    return null;
  }
}

function buildReviewPrompt(diff: string, taskDescription: string, acceptanceCriteria: string[]): string {
  const base = PromptBuilder.reviewer(diff, taskDescription, acceptanceCriteria, config.MODEL_TEST)
    .replace(/\nRespond via.*$/s, '');

  return `${base}

## Vai trò: TESTER / QA độc lập (review nghiêm khắc)
Bạn thay cho một tester thật. Hãy soi kỹ — KHÔNG nể nang:
- Đối chiếu TỪNG tiêu chí nghiệm thu ở trên: tiêu chí nào diff CHƯA đáp ứng → liệt kê là issue \`error\`.
- Tìm bug logic, thiếu xử lý lỗi/null, off-by-one, rò rỉ, hardcode, thiếu validate input.
- Edge case & hồi quy: thay đổi này có làm hỏng chức năng cũ / phá vỡ giao diện/dữ liệu không?
- Bảo mật rõ ràng (lộ secret, injection) và vi phạm convention dự án (CLAUDE.md).
- Chỉ \`PASS\` khi đáp ứng ĐỦ tiêu chí nghiệm thu và không còn issue mức \`error\`. Còn nghi ngờ → \`FAIL\` kèm lý do cụ thể (file:line) để người sửa.

NGÔN NGỮ: Viết "summary", "description", "suggestion" bằng TIẾNG VIỆT. Giữ nguyên tên file/biến/hàm/code.

## Required JSON response schema
Return a JSON code block with this exact structure:
\`\`\`json
{
  "verdict": "PASS",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "error|warning|info",
      "description": "what is wrong",
      "suggestion": "how to fix"
    }
  ],
  "conventions_check": true,
  "summary": "2-3 sentence review summary"
}
\`\`\`

verdict MUST be "PASS" or "FAIL". Empty issues array means no problems found.`;
}

export const ReviewAgent = {
  /** Review worktree do chính agent tạo (luồng Dev → Test): diff worktree vs base. */
  async review(task: Task, acceptanceCriteria: string[], attempt: number = 1): Promise<ReviewResponse> {
    log.info({ taskId: task.id, branch: task.branch_name, attempt }, 'ReviewAgent starting (worktree)');

    const worktreePath = task.worktree_path!;
    // Base để so diff: card con epic review vs integration branch (epic/<short>); còn lại vs base của repo.
    let baseBranch = RepoConfigRepository.getById(task.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
    const childMeta = parseChildBase(task.metadata);
    if (childMeta) baseBranch = childMeta;

    let diff: string;
    try {
      diff = await GitClient.getDiff(worktreePath, baseBranch);
    } catch {
      diff = await GitClient.getDiff(worktreePath, 'HEAD~1').catch(() => '(no diff available)');
    }
    return this.runReviewOnDiff(task, diff, acceptanceCriteria, attempt);
  },

  /**
   * Review nhánh do NGƯỜI tự code (không qua Dev của agent): so diff `base...branch` trong repo,
   * READ-ONLY (chỉ fetch + diff, KHÔNG đụng base branch). Dùng cho luồng "agent làm tester".
   */
  async reviewBranch(task: Task, repoPath: string, branch: string, baseBranch: string, acceptanceCriteria: string[] = [], attempt: number = 1): Promise<ReviewResponse> {
    log.info({ taskId: task.id, branch, baseBranch }, 'ReviewAgent starting (branch mode)');
    // Cập nhật ref (read-only). Lỗi (không remote/quyền) → thử ref local bên dưới.
    await GitClient.fetch(repoPath, [baseBranch, branch]).catch(() => {});
    let diff = '';
    try {
      diff = await GitClient.getDiff(repoPath, `origin/${baseBranch}`, `origin/${branch}`);
    } catch {
      try { diff = await GitClient.getDiff(repoPath, baseBranch, branch); } catch { diff = ''; }
    }
    return this.runReviewOnDiff(task, diff, acceptanceCriteria, attempt);
  },

  /**
   * Review một DẢI commit/range tuỳ ý (vd "dev...staging", "<sha>..staging", "a..b") — dùng khi code
   * đã merge/push vào staging và cần soi đúng phần thay đổi. READ-ONLY (chỉ fetch + diff).
   */
  async reviewRange(task: Task, repoPath: string, expr: string, acceptanceCriteria: string[] = [], attempt: number = 1): Promise<ReviewResponse> {
    log.info({ taskId: task.id, expr }, 'ReviewAgent starting (range mode)');
    // Cập nhật ref liên quan (read-only, best-effort) để diff đúng trạng thái remote mới nhất.
    const refs = expr.split(/\.{2,3}/).map(s => s.trim()).filter(s => s && !/^[0-9a-f]{7,40}$/i.test(s));
    if (refs.length) await GitClient.fetch(repoPath, refs).catch(() => {});
    let diff = '';
    try { diff = await GitClient.getDiffExpr(repoPath, expr); } catch { diff = ''; }
    return this.runReviewOnDiff(task, diff, acceptanceCriteria, attempt);
  },

  /** Phần chung: nhận chuỗi diff → LLM review tĩnh → lưu kết quả + comment. */
  async runReviewOnDiff(task: Task, diff: string, acceptanceCriteria: string[], attempt: number): Promise<ReviewResponse> {
    if (!diff || diff.trim().length === 0) {
      const result: ReviewResponse = {
        verdict: 'FAIL',
        issues: [{ file: '', severity: 'error', description: 'Không phát hiện thay đổi nào để review (diff rỗng). Kiểm tra tên nhánh / nhánh đã push chưa.' }],
        conventions_check: false,
        summary: 'No changes to review',
      };
      await this.persistResult(task.id, undefined, attempt, result);
      await this.postReviewComment(task, result);
      return result;
    }

    const card = await TrelloClient.getCard(task.card_id);
    const taskDescription = `${card.name}\n\n${card.desc}`;

    let result: ReviewResponse;
    try {
      result = await LlmClient.runForJson<ReviewResponse>(
        buildReviewPrompt(diff, taskDescription, acceptanceCriteria),
        config.MODEL_TEST,
        {
          // No file tools — diff is provided in prompt, review is independent
          maxTurns: 8,
          label: `review:${task.card_id.slice(0, 6)}`,
        }
      );
    } catch (err) {
      // Không trích được JSON (vd hết lượt) → FAIL mềm, retry được, KHÔNG để task fail cứng.
      log.warn({ taskId: task.id, err: String(err).slice(0, 200) }, 'Review JSON parse failed — soft FAIL');
      const soft: ReviewResponse = {
        verdict: 'FAIL',
        issues: [{ file: '', severity: 'warning', description: 'Reviewer không trả về kết quả hợp lệ (có thể diff quá lớn hoặc hết lượt). Hãy thử review lại (reply RETRY ở Test) hoặc chia nhỏ thay đổi.' }],
        conventions_check: false,
        summary: 'Không nhận được kết quả review hợp lệ từ AI reviewer.',
      };
      await this.persistResult(task.id, undefined, attempt, soft);
      await this.postReviewComment(task, soft);
      return soft;
    }

    await this.persistResult(task.id, undefined, attempt, result);
    await this.postReviewComment(task, result);

    log.info({ taskId: task.id, verdict: result.verdict, issues: result.issues.length }, 'Review complete');
    return result;
  },

  async postReviewComment(task: Task, result: ReviewResponse): Promise<void> {
    const icon = result.verdict === 'PASS' ? '✅' : '❌';
    const issueLines = result.issues
      .map(i =>
        `- **${i.severity.toUpperCase()}** \`${i.file}${i.line ? `:${i.line}` : ''}\`: ${i.description}${i.suggestion ? ` → ${i.suggestion}` : ''}`
      )
      .join('\n');

    const comment =
      `${icon} **[AI AGENT - CODE REVIEW] ${result.verdict}**\n\n${result.summary}` +
      (result.issues.length > 0 ? `\n\n**Issues found:**\n${issueLines}` : '') +
      `\n\n*Conventions check: ${result.conventions_check ? '✅ passed' : '❌ failed'}*`;

    await TrelloClient.addComment(task.card_id, comment);
  },

  async persistResult(taskId: string, subTaskId: string | undefined, attempt: number, result: ReviewResponse): Promise<void> {
    getDb()
      .prepare(`INSERT INTO review_results VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), taskId, subTaskId ?? null, attempt, result.verdict, JSON.stringify(result.issues), result.summary, Date.now());
  },
};
