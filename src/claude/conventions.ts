import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';

/** Khớp với LlmProvider trong LlmClient (định nghĩa cục bộ để tránh import chéo). */
type LlmProvider = 'claude' | 'gemini' | 'openai';

/**
 * Claude Code TỰ NẠP `CLAUDE.md` từ thư mục làm việc (đã xác minh thực nghiệm). Vì vậy khi một
 * stage chạy bằng **Claude CLI**, việc inject lại nội dung CLAUDE.md vào prompt là THỪA — model
 * đã có sẵn (và được cache). Bỏ phần inject đó giúp giảm token THẬT mà KHÔNG mất chất lượng.
 *
 * Lưu ý: chỉ CLI mới auto-load. Nếu cấu hình ANTHROPIC_API_KEY (gọi API trực tiếp) thì API KHÔNG
 * tự nạp → vẫn phải inject.
 */
export function claudeCliAutoLoads(provider: LlmProvider): boolean {
  const key = config.ANTHROPIC_API_KEY;
  const hasApiKey = !!key && key.trim() !== '' && key !== 'not-configured';
  return provider === 'claude' && !hasApiKey;
}

/**
 * Khối "## Project Conventions" để chèn vào prompt.
 * - Stage dùng Claude CLI + OPTIMIZE_HISTORY bật → chỉ 1 dòng ghi chú (Claude Code tự đọc file).
 * - Ngược lại → nội dung CLAUDE.md đầy đủ, bọc sentinel để optimizeFirstMessage cắt được ở
 *   các lượt sau của vòng lặp gemini/openai.
 * Trả về '' nếu repo không có CLAUDE.md.
 */
export function conventionsBlock(provider: LlmProvider, repoPath: string = config.GIT_REPO_PATH): string {
  const claudeMd = join(repoPath, 'CLAUDE.md');
  if (!existsSync(claudeMd)) return '';

  if (config.OPTIMIZE_HISTORY && claudeCliAutoLoads(provider)) {
    return `\n\n## Project Conventions\n> (Claude Code đã tự nạp CLAUDE.md từ repo — không lặp lại trong prompt để tiết kiệm token.)`;
  }

  return `\n\n<!--AUTOPILOT_CONV_START-->\n## Project Conventions (from CLAUDE.md)\n${readFileSync(claudeMd, 'utf8')}\n<!--AUTOPILOT_CONV_END-->`;
}
