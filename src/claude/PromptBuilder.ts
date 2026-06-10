import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';
import type { TrelloCard } from '../trello/types.js';
import type { ConversationMessage } from '../state/ConversationRepository.js';

function repoContext(): string {
  let ctx = '';

  // Bọc 2 khối quy ước nặng bằng sentinel HTML-comment để LlmClient.optimizeFirstMessage CẮT
  // CHÍNH XÁC ở các lượt sau (robust kể cả khi nội dung tự chứa heading "##" của riêng nó).
  const claudeMd = join(config.GIT_REPO_PATH, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    ctx += `\n\n<!--AUTOPILOT_CONV_START-->\n## Project Conventions (from CLAUDE.md)\n${readFileSync(claudeMd, 'utf8')}\n<!--AUTOPILOT_CONV_END-->`;
  }

  // Context priming: always load the project overview so the agent starts with
  // the big picture instead of spending exploration turns rediscovering it.
  // The full docs map lives in CLAUDE.md (above) — the agent reads the rest on demand.
  const overview = join(config.GIT_REPO_PATH, 'cons_weekly_report', 'docs', '00_TONG_THE.md');
  if (existsSync(overview)) {
    ctx += `\n\n<!--AUTOPILOT_OVERVIEW_START-->\n## Project Overview (from docs/00_TONG_THE.md)\n${readFileSync(overview, 'utf8')}` +
      `\n\n> Đây chỉ là tổng quan. Trước khi sửa code, hãy đọc tài liệu màn hình/lĩnh vực liên quan` +
      ` (xem bảng "Bản đồ tài liệu" trong CLAUDE.md) bằng tool Read.\n<!--AUTOPILOT_OVERVIEW_END-->`;
  }

  return ctx;
}

function cardContext(card: TrelloCard): string {
  const checklists = card.checklists.map(cl =>
    `### ${cl.name}\n${cl.checkItems.map(i => `- [${i.state === 'complete' ? 'x' : ' '}] ${i.name}`).join('\n')}`
  ).join('\n\n');

  const labels = card.labels.map(l => l.name).filter(Boolean).join(', ');
  const attachments = card.attachments.map(a => `- ${a.name} (${a.mimeType})`).join('\n');

  return `## Trello Card
**Title:** ${card.name}
**Description:**
${card.desc || '(empty)'}
${labels ? `**Labels:** ${labels}` : ''}
${card.checklists.length > 0 ? `\n**Checklists:**\n${checklists}` : ''}
${card.attachments.length > 0 ? `\n**Attachments:**\n${attachments}` : ''}
**Card URL:** ${card.url}`;
}

function historyContext(history: ConversationMessage[]): string {
  if (history.length === 0) return '';
  return `\n\n## Previous Conversation\n${history.map(m => `**${m.role}:** ${m.content}`).join('\n---\n')}`;
}

export const PromptBuilder = {
  analyst(card: TrelloCard, history: ConversationMessage[]): string {
    return `You are an expert software analyst for a construction project reporting system (Odoo 16 + React 18).
Your job: analyze the Trello task, locate the exact file(s) and line(s) that need to change, and produce a precise implementation plan as a Trello comment.
${repoContext()}

${cardContext(card)}
${historyContext(history)}

Respond ONLY via the \`post_analysis\` tool. Be specific: exact file paths, line numbers, before/after code snippets.`;
  },

  dev(card: TrelloCard, planContext: string, history: ConversationMessage[]): string {
    return `You are an expert developer implementing a task for a construction project reporting system (Odoo 16 + React 18).
Follow ALL conventions in CLAUDE.md strictly. Write minimal, correct code — no extra features, no refactoring beyond the task scope.
${repoContext()}

${cardContext(card)}

## Implementation Plan
${planContext}
${historyContext(history)}

Use the \`take_actions\` tool to write files and commit your changes. Work step by step.`;
  },

  reviewer(diff: string, taskDescription: string, acceptanceCriteria: string[]): string {
    return `You are an independent code reviewer for a construction project reporting system (Odoo 16 + React 18).
Review the following diff strictly against the project conventions and acceptance criteria.
DO NOT be lenient. Flag any violation of CLAUDE.md conventions as an error.
${repoContext()}

## Task Description
${taskDescription}

## Acceptance Criteria
${acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Code Diff
\`\`\`diff
${diff}
\`\`\`

Respond via the \`submit_review\` tool with verdict PASS or FAIL, and specific issues if any.`;
  },

  planner(card: TrelloCard, codeContext: string): string {
    return `You are a senior software architect planning implementation for a construction project reporting system.
${repoContext()}

${cardContext(card)}

## Relevant Existing Code
${codeContext}

Analyze the requirements (including any attached design images) and produce a detailed implementation plan via the \`create_plan\` tool.
Break large work into small, independently implementable sub-tasks. Each sub-task should be completable by one developer in isolation.`;
  },

  taskParser(card: TrelloCard): string {
    return `You are a task analyst. Parse the following Trello card into a structured format via the \`parse_task\` tool.
Determine: intent, scope, acceptance criteria, complexity, and what information (if any) is missing.

${cardContext(card)}`;
  },
};
