import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ClaudeCliClient } from '../claude/ClaudeCliClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { CardMemory } from './CardMemory.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { getDb } from '../state/db.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { PlanResponse } from '../claude/types.js';

const log = childLogger('planner-agent');

function readCodeContext(repoPath: string, card: { name: string; desc: string }): string {
  const claudeMd = join(repoPath, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    return `CLAUDE.md:\n${readFileSync(claudeMd, 'utf8').slice(0, 2000)}`;
  }
  return '';
}

function buildPlannerPrompt(card: Parameters<typeof PromptBuilder.planner>[0], codeContext: string, modifyInstruction?: string, memoryContext = ''): string {
  const base = PromptBuilder.planner(card, codeContext)
    .replace(/\nAnalyze.*$/s, '');

  const revision = modifyInstruction
    ? `\n\n## Revision requested by admin\nĐiều chỉnh kế hoạch theo yêu cầu sau:\n> ${modifyInstruction}\n`
    : '';

  return `${base}
${memoryContext}${revision}
NGÔN NGỮ: Viết TẤT CẢ nội dung trả về cho người dùng — summary, description, acceptance_criteria, risks, test_cases — bằng TIẾNG VIỆT. Giữ nguyên tên file/biến/hàm/code.

Analyze the requirements and explore the codebase at: ${config.GIT_REPO_PATH}
Use Read/Glob/Grep tools to understand the existing code structure before planning.

## Required JSON response schema
Return a JSON code block with this exact structure:
\`\`\`json
{
  "summary": "overall summary of what will be built",
  "sub_tasks": [
    {
      "title": "Sub-task title",
      "description": "detailed description",
      "acceptance_criteria": ["criterion 1", "criterion 2"],
      "files_expected": ["path/to/file.ts"],
      "sequence": 1
    }
  ],
  "test_cases": [
    {
      "name": "test name",
      "description": "what to test",
      "expected": "expected outcome"
    }
  ],
  "risks": ["risk 1", "risk 2"],
  "estimated_complexity": 5
}
\`\`\`

estimated_complexity is 1-10. Break large work into 2-5 focused sub-tasks.`;
}

export const PlannerAgent = {
  async run(task: Task, modifyInstruction?: string): Promise<PlanResponse> {
    log.info({ taskId: task.id }, 'PlannerAgent starting');

    const card = await TrelloClient.getCard(task.card_id);
    const codeContext = readCodeContext(config.GIT_REPO_PATH, card);

    // Describe attachments as text context (no vision API needed)
    let attachmentContext = '';
    if (card.attachments.length > 0) {
      attachmentContext = `\n\n## Attachments\n${card.attachments.map(a => `- ${a.name} (${a.mimeType}, ${Math.round(a.bytes / 1024)}KB)`).join('\n')}`;
    }

    // Nạp lại memory đã ghi trên card (ghi nhớ trước đó + phản hồi admin) để re-plan có ngữ cảnh
    let memoryContext = await CardMemory.loadContext(task.card_id);
    // Nếu card thuộc một epic (mô tả có "Epic: <id>"), nạp thêm bối cảnh feature lớn
    const epicId = CardMemory.parseEpicId(card.desc);
    if (epicId) memoryContext += await CardMemory.epicContext(epicId);

    const plan = await ClaudeCliClient.runForJson<PlanResponse>(
      buildPlannerPrompt(card, codeContext + attachmentContext, modifyInstruction, memoryContext),
      {
        allowedTools: ['Read', 'Glob', 'Grep'],
        cwd: config.GIT_REPO_PATH,
        maxTurns: config.PLANNING_MAX_TURNS,
        timeoutMs: config.PLANNING_TIMEOUT_MS,
      }
    );

    // Write PLAN.md
    const planDir = join(config.DATA_DIR, 'plans');
    mkdirSync(planDir, { recursive: true });
    const planPath = join(planDir, `${task.id}.md`);
    writeFileSync(planPath, this.formatPlan(plan, card.name), 'utf8');
    TaskRepository.update(task.id, { plan_file_path: planPath });

    // Post plan summary to Trello
    const comment = this.formatTrelloComment(plan);
    await TrelloClient.addComment(task.card_id, comment);

    // Ghi memory cô đọng để lần chạy sau / Dev nạp lại
    const memoryBody =
      `**Tóm tắt kế hoạch:** ${plan.summary}\n` +
      `**Các phần việc:** ${plan.sub_tasks.map(st => st.title).join('; ')}\n` +
      `**Rủi ro/Lưu ý:** ${(plan.risks ?? []).join('; ') || '—'}`;
    await CardMemory.post(task.card_id, 'Planning', memoryBody);

    log.info({ taskId: task.id, subTasks: plan.sub_tasks.length }, 'Plan created, awaiting approval');
    return plan;
  },

  formatPlan(plan: PlanResponse, cardName: string): string {
    const subTasksSection = plan.sub_tasks
      .map(
        (st, i) =>
          `### Sub-task ${i + 1}: ${st.title}\n${st.description}\n\n**Acceptance Criteria:**\n${st.acceptance_criteria.map(c => `- ${c}`).join('\n')}\n\n**Files:** ${(st.files_expected ?? []).join(', ')}`
      )
      .join('\n\n');

    const testSection = plan.test_cases
      .map(tc => `- **${tc.name}**: ${tc.description} → Expected: ${tc.expected}`)
      .join('\n');

    return (
      `# Implementation Plan: ${cardName}\n\n` +
      `## Summary\n${plan.summary}\n\n` +
      `## Sub-tasks\n${subTasksSection}\n\n` +
      `## Test Cases\n${testSection}\n\n` +
      `## Risks\n${(plan.risks ?? []).map(r => `- ${r}`).join('\n')}\n\n` +
      `## Complexity Score\n${plan.estimated_complexity}/10\n`
    );
  },

  formatTrelloComment(plan: PlanResponse): string {
    const subTaskList = plan.sub_tasks.map((st, i) => `${i + 1}. **${st.title}**`).join('\n');
    return (
      `📋 **[AI AGENT] Kế hoạch thực hiện — CHỜ XÁC NHẬN**\n\n` +
      `**Tóm tắt:** ${plan.summary}\n\n` +
      `**Sub-tasks (${plan.sub_tasks.length}):**\n${subTaskList}\n\n` +
      `**Độ phức tạp:** ${plan.estimated_complexity}/10\n\n` +
      `**Rủi ro:**\n${(plan.risks ?? []).map(r => `- ${r}`).join('\n')}\n\n` +
      `---\nGắn nhãn **\`plan approve\`** để chốt kế hoạch · reply **\`MODIFY: {hướng dẫn}\`** để chỉnh · **\`REJECT\`** để huỷ.\n` +
      `Sau khi chốt, kéo card sang list **Dev** để bắt đầu code.`
    );
  },
};
