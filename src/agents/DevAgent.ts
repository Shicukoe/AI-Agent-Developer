import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execa } from 'execa';
import { TrelloClient } from '../trello/TrelloClient.js';
import { CardMemory } from './CardMemory.js';
import { GitClient } from '../git/GitClient.js';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { ConversationStore } from '../claude/ConversationStore.js';
import { RiskGuard } from '../risk/RiskGuard.js';
import { LlmClient } from '../claude/LlmClient.js';
import { makeStreamHandler } from '../claude/claudeStream.js';
import { conventionsBlock } from '../claude/conventions.js';
import { ProjectDocs } from './ProjectDocs.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';

const log = childLogger('dev-agent');

// Resolve the claude CLI executable path
// Priority: CLAUDE_CLI_PATH env → npx claude-code → system PATH
function resolveClaudeCli(): string {
  if (config.CLAUDE_CLI_PATH) return config.CLAUDE_CLI_PATH;

  // Common install locations on Windows
  const candidates = [
    `${process.env.APPDATA}\\npm\\claude.cmd`,
    `${process.env.APPDATA}\\npm\\claude`,
    `${process.env.LOCALAPPDATA}\\Programs\\Claude\\claude.exe`,
    'claude.cmd',
    'claude',
  ];

  for (const c of candidates) {
    if (c.includes('\\') && existsSync(c)) return c;
  }

  return 'claude'; // fall back to PATH
}

// Write .claude/settings.json in the worktree to pre-approve only the tools we need.
// This avoids --dangerously-skip-permissions while still running non-interactively.
function writeWorktreeSettings(worktreePath: string): void {
  const settingsDir = join(worktreePath, '.claude');
  mkdirSync(settingsDir, { recursive: true });
  const settings = {
    permissions: {
      allow: [
        'Read(*)',
        'Edit(*)',
        'Write(*)',
        'Glob(*)',
        'Grep(*)',
      ],
      deny: [
        'Bash(*)',   // no shell execution — git handled by GitClient
        'WebFetch(*)',
        'WebSearch(*)',
      ],
    },
  };
  writeFileSync(join(settingsDir, 'settings.json'), JSON.stringify(settings, null, 2));
}

function buildPrompt(task: Task, planContext: string, worktreePath: string, repoPath: string, projectContext: string, memoryContext = ''): string {
  // Khi MODEL_DEV=claude (CLI): bỏ inject CLAUDE.md vì Claude Code tự nạp từ worktree → tiết kiệm token.
  const conventions = conventionsBlock(config.MODEL_DEV, repoPath);
  // Kiến trúc tổng thể + luồng liên quan (cache) → biết file ở đâu, sửa tập trung. Vẫn Read file cụ thể khi cần.
  const projectMap = projectContext ? `\n${projectContext}\n` : '';

  return `You are implementing a software task. Work ONLY inside: ${worktreePath}
${conventions}${projectMap}${memoryContext}
## Task
${planContext}

## Rules
- Read existing code before making changes
- Follow ALL project conventions strictly
- Do NOT run git commands — commit is handled externally
- Do NOT install packages unless the task explicitly requires it
- Stay inside the working directory above
- Nếu task là viết TÀI LIỆU/văn bản (hướng dẫn, README, doc...), bạn PHẢI TẠO file thật (vd \`.md\`) trong thư mục phù hợp — KHÔNG chỉ in nội dung ra output. Không có file thay đổi = task chưa hoàn thành.
- When done, print a short summary of what files you changed and why
- NGÔN NGỮ: phần tóm tắt cuối cùng viết bằng TIẾNG VIỆT (giữ nguyên tên file/biến/code)`;
}

export const DevAgent = {
  /** Trả về { committed } để runDev biết có thay đổi file thật hay không (tránh báo "Code xong" khi rỗng). */
  async run(task: Task, planContext: string): Promise<{ committed: boolean }> {
    log.info({ taskId: task.id, cardId: task.card_id }, 'DevAgent starting (claude CLI)');

    const worktreePath = task.worktree_path!;
    RiskGuard.assertBranchSafe(task.branch_name ?? '');

    const claudeExe = resolveClaudeCli();
    let memoryContext = await CardMemory.loadContext(task.card_id);
    // Card con/điều chỉnh thuộc epic: nạp thêm kế hoạch + ghi nhớ của feature lớn
    const card = await TrelloClient.getCard(task.card_id).catch(() => null);
    const epicId = card ? CardMemory.parseEpicId(card.desc) : null;
    if (epicId) memoryContext += await CardMemory.epicContext(epicId);
    const projectContext = ProjectDocs.frameworkRules(RepoRegistry.docsPathForTask(task))
      + ProjectDocs.guidance(task.repo_path ?? config.GIT_REPO_PATH, RepoRegistry.docsPathForTask(task)) + RepoRegistry.contextGuidanceForTask(task);
    const prompt = buildPrompt(task, planContext, worktreePath, task.repo_path ?? config.GIT_REPO_PATH, projectContext, memoryContext);
    const timeoutMs = config.MAX_TASK_PROCESSING_MINUTES * 60 * 1000;

    // Pre-approve tools via settings.json instead of --dangerously-skip-permissions
    writeWorktreeSettings(worktreePath);

    await TrelloClient.addComment(
      task.card_id,
      `⚙️ **[AI AGENT]** DevAgent bắt đầu...\nBranch: \`${task.branch_name}\``,
    );

    let summary = '';
    let hasError = false;

    if (config.MODEL_DEV === 'claude') {
      // stream-json để bắt token usage; parser lo việc stream console + heartbeat + gom text.
      const tag = `[dev:${task.card_id.slice(0, 6)}]`;
      const handler = makeStreamHandler(tag, `dev:${task.card_id.slice(0, 6)}`, () => TaskRepository.heartbeat(task.id));
      try {
        log.info({ claudeExe, cwd: worktreePath }, 'Spawning claude CLI');

        const proc = execa(claudeExe, [
          '--print',                                          // non-interactive, print and exit
          '--allowedTools', 'Edit,Write,Read,Grep,Glob',     // restrict to file tools only
          '--max-turns', String(config.CLAUDE_MAX_TURNS_PER_TASK),
          '--output-format', 'stream-json',
          '--verbose',
        ], {
          cwd: worktreePath,
          timeout: timeoutMs,
          input: prompt,                    // pipe prompt via stdin
          env: (() => {
            // Strip ANTHROPIC_API_KEY so Claude CLI uses its own stored credentials (~/.claude)
            const { ANTHROPIC_API_KEY: _unused, ...clean } = process.env;
            return clean;
          })(),
        });

        proc.stdout?.on('data', (chunk: Buffer) => handler.feed(chunk.toString()));
        proc.stderr?.on('data', (chunk: Buffer) => {
          if (config.AGENT_VERBOSE) process.stderr.write(`  \x1b[2m${tag}!\x1b[0m ${chunk.toString().trim()}\n`);
          else log.warn({ taskId: task.id, stderr: chunk.toString().slice(0, 200) }, 'claude stderr');
        });

        await proc;
        handler.flush();
        summary = handler.result();
        TaskRepository.incrementTurns(task.id);

      } catch (err: unknown) {
        handler.flush();
        const e = err as { timedOut?: boolean; killed?: boolean; exitCode?: number; stderr?: string; message?: string };

        if (e.timedOut || e.killed) {
          hasError = true;
          summary = `Timed out after ${config.MAX_TASK_PROCESSING_MINUTES} minutes`;
        } else {
          // Claude CLI thường exit code 1 dù ĐÃ làm việc xong — vẫn lấy text đã parse được
          // để có thể commit các file đã ghi. Chỉ coi là lỗi khi không có output VÀ stderr báo error.
          summary = handler.result();
          const stderr = e.stderr ?? '';
          if (!summary && (stderr.includes('error') || stderr.includes('Error'))) {
            hasError = true;
            summary = `claude exited with code ${e.exitCode}: ${stderr.slice(0, 300)}`;
          }
        }

        log.warn({ taskId: task.id, hasError, exitCode: e.exitCode, summary: summary.slice(0, 200) }, 'claude process ended');
      }
    } else {
      // Use LlmClient for Gemini/OpenAI
      try {
        summary = await LlmClient.run(prompt, config.MODEL_DEV, {
          allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
          cwd: worktreePath,
          model: config.DEV_MODEL,             // trống → model mặc định của provider (GEMINI_MODEL/OPENAI_MODEL)
          maxTurns: config.CLAUDE_MAX_TURNS_PER_TASK,
          timeoutMs: timeoutMs,
          label: `dev:${task.card_id.slice(0, 6)}`
        });
        TaskRepository.incrementTurns(task.id);
      } catch (err) {
        hasError = true;
        summary = (err as Error).message;
        log.error({ taskId: task.id, err }, 'LlmClient dev error');
      }
    }

    if (hasError) {
      await TrelloClient.addComment(
        task.card_id,
        `⚠️ **[AI AGENT]** DevAgent gặp lỗi:\n\`${summary}\``,
      );
      TaskRepository.setStatus(task.id, 'halted', { error_message: summary });
      return { committed: false };
    }

    if (summary) ConversationStore.append(task.id, 'assistant', summary);

    // Quyết định thành công dựa trên THAY ĐỔI FILE THẬT (git status), KHÔNG phụ thuộc text output:
    // claude có thể đã ghi file dù stdout rỗng/exit ≠ 0.
    const commitHash = await this.commitChanges(task, worktreePath, task.card_name);

    if (commitHash) {
      log.info({ taskId: task.id, commitHash, branch: task.branch_name }, 'DevAgent committed');
      // Ghi memory: đã code gì, để Review/lần chạy sau nạp lại
      await CardMemory.post(task.card_id, 'Dev',
        `**Branch:** \`${task.branch_name}\` (commit \`${commitHash.slice(0, 8)}\`)\n**Đã thực hiện:**\n${summary || '(agent không in tóm tắt)'}`
      ).catch(() => {});
      return { committed: true };
    }

    // Không có thay đổi file — để runDev xử lý thông báo (không báo "Code xong").
    log.warn({ taskId: task.id }, 'DevAgent produced no file changes');
    return { committed: false };
  },

  async commitChanges(task: Task, worktreePath: string, cardName: string): Promise<string> {
    // Chỉ commit khi thực sự có thay đổi file (tránh commit rỗng và phản ánh đúng "không tạo gì").
    const status = await ShellExecutor.git(['status', '--porcelain'], worktreePath).catch(() => ({ stdout: '' }));
    if (!String(status.stdout).trim()) {
      log.warn({ taskId: task.id }, 'No file changes to commit');
      return '';
    }

    // Message GỌN: chỉ tiêu đề = tên card (chi tiết "đã làm gì" đã ghi ở comment/memory card).
    const message = cardName.replace(/\s+/g, ' ').trim().slice(0, 72) || 'Cập nhật (AI Agent)';

    let hash = '';
    try {
      hash = await GitClient.commit(task.id, worktreePath, message);
    } catch (err) {
      log.error({ taskId: task.id, err }, 'Commit failed');
      return '';
    }

    // Push là tuỳ chọn: thất bại (không có remote/credential) KHÔNG làm hỏng kết quả —
    // ReviewAgent review trên diff local vs base branch.
    try {
      await GitClient.push(task.id, worktreePath, task.branch_name!);
    } catch (err) {
      log.warn({ taskId: task.id, err }, 'Push failed — tiếp tục với commit local');
    }
    return hash;
  },
};
