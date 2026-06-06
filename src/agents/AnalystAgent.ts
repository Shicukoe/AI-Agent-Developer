import { ClaudeCliClient } from '../claude/ClaudeCliClient.js';
import { ConversationStore } from '../claude/ConversationStore.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { WorktreeManager } from '../git/WorktreeManager.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { ParsedTask } from '../claude/types.js';

const log = childLogger('analyst-agent');

function buildAnalystPrompt(card: Parameters<typeof PromptBuilder.analyst>[0]): string {
  return `You are an expert software analyst for a construction project reporting system (Odoo 16 + React 18).

## Your Job
1. Read the Trello card carefully
2. Use your Read/Glob/Grep tools to explore the relevant parts of the codebase at: ${config.GIT_REPO_PATH}
3. Identify EXACTLY which files need to change, at which lines, and how
4. Produce a precise implementation plan

${PromptBuilder.analyst(card, []).replace(/\nRespond ONLY via.*$/s, '')}

## Required JSON response schema
Return a JSON code block with this exact structure:
\`\`\`json
{
  "intent": "one-sentence description of what needs to be done",
  "scope": ["file or area 1", "file or area 2"],
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "estimated_complexity": "simple|medium|complex",
  "confidence": 0.9,
  "missing_info": [],
  "files_to_change": [
    {
      "path": "relative/path/to/file.ts",
      "line_start": 42,
      "line_end": 55,
      "change_description": "what to change and why",
      "before_snippet": "existing code (optional)",
      "after_snippet": "new code (optional)"
    }
  ],
  "approach": "overall approach in 2-3 sentences",
  "trello_comment": "formatted comment to post on Trello with full analysis details"
}
\`\`\`

If information is missing or unclear, set confidence < 0.7 and list what's missing in missing_info.`;
}

export const AnalystAgent = {
  async run(task: Task): Promise<{ parsed: ParsedTask; branchName: string; comment: string }> {
    log.info({ taskId: task.id, cardId: task.card_id }, 'AnalystAgent starting');

    const card = await TrelloClient.getCard(task.card_id);

    const analysis = await ClaudeCliClient.runForJson<ParsedTask & {
      files_to_change: unknown[];
      approach: string;
      trello_comment: string;
    }>(buildAnalystPrompt(card), {
      allowedTools: ['Read', 'Glob', 'Grep'],
      cwd: config.GIT_REPO_PATH,
      maxTurns: 20,
    });

    log.info(
      { taskId: task.id, confidence: analysis.confidence, complexity: analysis.estimated_complexity },
      'Task analyzed'
    );

    const parsed: ParsedTask = {
      intent: analysis.intent,
      scope: analysis.scope ?? [],
      acceptance_criteria: analysis.acceptance_criteria ?? [],
      context: analysis.approach ?? '',
      estimated_complexity: analysis.estimated_complexity ?? 'simple',
      confidence: analysis.confidence ?? 1,
      missing_info: analysis.missing_info ?? [],
    };

    // If confidence too low, ask for more info
    if (parsed.confidence < RuleEngine.getConfidenceThreshold() || parsed.missing_info.length > 0) {
      const question =
        `🤖 [AI AGENT] Tôi cần thêm thông tin để xử lý task này.\n\n` +
        (parsed.missing_info.length > 0
          ? `**Thông tin còn thiếu:**\n${parsed.missing_info.map(i => `- ❓ ${i}`).join('\n')}\n\n`
          : '') +
        `Vui lòng bổ sung vào description của card rồi reply \`RETRY\`.`;

      await TrelloClient.addComment(task.card_id, question);
      TaskRepository.setStatus(task.id, 'paused_for_confirmation', { error_message: 'Waiting for more info' });
      return { parsed, branchName: '', comment: question };
    }

    // Create branch
    const slug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const branchName = `fix/${task.card_id.slice(0, 8)}-${slug}`;
    const worktreePath = await WorktreeManager.add(task.id, branchName, config.GIT_DEFAULT_BASE_BRANCH);
    TaskRepository.update(task.id, { branch_name: branchName, worktree_path: worktreePath });

    // Post analysis comment
    const comment = analysis.trello_comment || `**Approach:** ${analysis.approach}\n\n**Files to change:** ${(analysis.files_to_change ?? []).length} file(s)`;
    await TrelloClient.addComment(
      task.card_id,
      `📍 **[AI AGENT] Phân tích hoàn tất**\n\n${comment}\n\n✅ Branch tạo: \`${branchName}\``
    );

    ConversationStore.append(task.id, 'assistant', comment);
    log.info({ taskId: task.id, branchName }, 'AnalystAgent done');

    return { parsed, branchName, comment };
  },
};
