import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { LlmClient } from '../claude/LlmClient.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('project-knowledge');

export interface KnowledgeMeta {
  built_at_commit: string;   // commit hash của nhánh base lúc dựng cache
  built_at: number;          // timestamp
  version: number;
}
export interface Knowledge {
  content: string;           // bản đồ dự án (markdown)
  meta: KnowledgeMeta;
}

const VERSION = 1;

function dir(): string { return join(config.DATA_DIR, 'knowledge'); }
function key(repoPath: string): string { return createHash('sha1').update(repoPath).digest('hex').slice(0, 12); }
function mdPath(repoPath: string): string { return join(dir(), `${key(repoPath)}.md`); }
function metaPath(repoPath: string): string { return join(dir(), `${key(repoPath)}.json`); }

/** Đọc commit hash của một ref (base branch / HEAD). Null nếu repo không phải git / lỗi. */
async function gitHead(repoPath: string, ref: string): Promise<string | null> {
  try {
    const { stdout } = await ShellExecutor.git(['rev-parse', ref], repoPath);
    return stdout.trim() || null;
  } catch { return null; }
}

/** Danh sách file đã đổi giữa 2 commit (read-only). */
async function changedFiles(repoPath: string, from: string, to: string): Promise<string[]> {
  try {
    const { stdout } = await ShellExecutor.git(['diff', '--name-only', from, to], repoPath);
    return stdout.split('\n').map(s => s.trim()).filter(Boolean);
  } catch { return []; }
}

export const ProjectKnowledge = {
  /** Đọc cache hiện có (content + meta), null nếu chưa có. */
  get(repoPath: string): Knowledge | null {
    try {
      if (!existsSync(mdPath(repoPath)) || !existsSync(metaPath(repoPath))) return null;
      const content = readFileSync(mdPath(repoPath), 'utf8');
      const meta = JSON.parse(readFileSync(metaPath(repoPath), 'utf8')) as KnowledgeMeta;
      return { content, meta };
    } catch { return null; }
  },

  /** Bản rút gọn cho Triage (rẻ): vài nghìn ký tự đầu của cache, hoặc '' nếu chưa có. */
  summary(repoPath: string, maxChars = 2500): string {
    const k = this.get(repoPath);
    if (!k) return '';
    return k.content.length > maxChars ? k.content.slice(0, maxChars) + '\n…(rút gọn)' : k.content;
  },

  save(repoPath: string, content: string, commit: string): Knowledge {
    mkdirSync(dir(), { recursive: true });
    const meta: KnowledgeMeta = { built_at_commit: commit, built_at: Date.now(), version: VERSION };
    writeFileSync(mdPath(repoPath), content, 'utf8');
    writeFileSync(metaPath(repoPath), JSON.stringify(meta, null, 2), 'utf8');
    return { content, meta };
  },

  /**
   * Đảm bảo cache tươi trước khi agent dùng:
   * - chưa có → build (cold start, đọc repo 1 lần)
   * - git base đổi: ≤ MAX file → incremental (chỉ đọc file đã đổi); > MAX → rebuild
   * - quá TTL → rebuild
   */
  async ensureFresh(repoPath: string): Promise<Knowledge> {
    const base = config.GIT_DEFAULT_BASE_BRANCH;
    const cur = (await gitHead(repoPath, base)) ?? (await gitHead(repoPath, 'HEAD')) ?? '';
    const existing = this.get(repoPath);

    if (!existing) {
      log.info({ repoPath }, 'Knowledge cache: cold start — building');
      return this.build(repoPath, cur);
    }

    // Git đổi?
    if (cur && existing.meta.built_at_commit && cur !== existing.meta.built_at_commit) {
      const files = await changedFiles(repoPath, existing.meta.built_at_commit, cur);
      if (files.length === 0) {
        log.debug({ repoPath }, 'Knowledge cache: commit khác nhưng 0 file đổi — coi như tươi');
      } else if (files.length <= config.KNOWLEDGE_INCREMENTAL_MAX_FILES) {
        log.info({ repoPath, changed: files.length }, 'Knowledge cache: incremental update');
        return this.incrementalUpdate(repoPath, existing, files, cur);
      } else {
        log.info({ repoPath, changed: files.length }, 'Knowledge cache: nhiều thay đổi — rebuild');
        return this.build(repoPath, cur);
      }
    }

    // TTL
    const ageDays = (Date.now() - existing.meta.built_at) / 86_400_000;
    if (ageDays > config.KNOWLEDGE_TTL_DAYS) {
      log.info({ repoPath, ageDays: Math.round(ageDays) }, 'Knowledge cache: hết TTL — rebuild');
      return this.build(repoPath, cur || existing.meta.built_at_commit);
    }

    return existing;
  },

  /** Cold start / rebuild: IndexerAgent khám phá repo 1 lần → sinh bản đồ dự án. */
  async build(repoPath: string, commit: string): Promise<Knowledge> {
    const prompt =
      `Bạn là kỹ sư khảo sát codebase. Dùng tool Read/Glob/Grep khám phá repo tại: ${repoPath}\n` +
      `Sinh một "BẢN ĐỒ DỰ ÁN" NGẮN GỌN (markdown) làm điểm khởi đầu cho các agent khác — KHÔNG chép code, chỉ "cái gì ở đâu":\n` +
      `## Tech stack\n## Sơ đồ thư mục/module (cây rút gọn + vai trò)\n## Map màn hình/feature → file/route chính\n` +
      `## Quy ước chính (đặt tên, cấu trúc, lệnh build/test)\n## File/điểm vào quan trọng (đường dẫn)\n` +
      `Súc tích, tối đa ~400 dòng. CHỈ in markdown, không lời dẫn.`;
    const content = await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 25, label: `index:${key(repoPath)}`,
    });
    return this.save(repoPath, content.trim(), commit);
  },

  /** Cập nhật tăng dần: chỉ đọc các file đã đổi → vá đúng mục liên quan trong cache. */
  async incrementalUpdate(repoPath: string, existing: Knowledge, files: string[], commit: string): Promise<Knowledge> {
    const prompt =
      `Bản đồ dự án hiện tại (markdown) cần CẬP NHẬT do ${files.length} file vừa thay đổi.\n\n` +
      `### Bản đồ hiện tại\n${existing.content}\n\n` +
      `### File đã thay đổi (đọc bằng tool Read nếu cần để hiểu ảnh hưởng)\n${files.map(f => `- ${f}`).join('\n')}\n\n` +
      `Hãy CHỈNH các mục liên quan của bản đồ cho khớp thay đổi (thêm/sửa/bỏ entry). Giữ nguyên phần không liên quan. ` +
      `CHỈ in lại TOÀN BỘ markdown bản đồ đã cập nhật, không lời dẫn.`;
    const content = await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 10, label: `index:${key(repoPath)}`,
    });
    return this.save(repoPath, content.trim(), commit);
  },
};
