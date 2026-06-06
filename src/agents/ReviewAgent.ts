import { randomUUID } from 'crypto';
import { ClaudeCliClient } from '../claude/ClaudeCliClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { GitClient } from '../git/GitClient.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { getDb } from '../state/db.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { ReviewResponse } from '../claude/types.js';

const log = childLogger('review-agent');

function buildReviewPrompt(diff: string, taskDescription: string, acceptanceCriteria: string[]): string {
  const base = PromptBuilder.reviewer(diff, taskDescription, acceptanceCriteria)
    .replace(/\nRespond via.*$/s, '');

  return `${base}

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
  async review(task: Task, acceptanceCriteria: string[], attempt: number = 1): Promise<ReviewResponse> {
    log.info({ taskId: task.id, branch: task.branch_name, attempt }, 'ReviewAgent starting');

    const worktreePath = task.worktree_path!;

    let diff: string;
    try {
      diff = await GitClient.getDiff(worktreePath, config.GIT_DEFAULT_BASE_BRANCH);
    } catch {
      diff = await GitClient.getDiff(worktreePath, 'HEAD~1').catch(() => '(no diff available)');
    }

    if (!diff || diff.trim().length === 0) {
      const result: ReviewResponse = {
        verdict: 'FAIL',
        issues: [{ file: '', severity: 'error', description: 'No changes detected in diff' }],
        conventions_check: false,
        summary: 'No changes to review',
      };
      await this.persistResult(task.id, undefined, attempt, result);
      return result;
    }

    const card = await TrelloClient.getCard(task.card_id);
    const taskDescription = `${card.name}\n\n${card.desc}`;

    const result = await ClaudeCliClient.runForJson<ReviewResponse>(
      buildReviewPrompt(diff, taskDescription, acceptanceCriteria),
      {
        // No file tools — diff is provided in prompt, review is independent
        maxTurns: 3,
      }
    );

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
