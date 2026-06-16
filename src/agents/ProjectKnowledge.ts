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

/** Guard: các repo đang được (re)build cache — tránh dựng trùng/chồng khi chạy nền nhiều task. */
const building = new Set<string>();

/** Output indexer có phải bản đồ hợp lệ không (chặn lưu chuỗi lỗi/rỗng như "Request timed out"). */
function isValidMap(content: string): boolean {
  const c = content.trim();
  if (c.length < 200) return false;                       // quá ngắn → không phải bản đồ
  if (/^(request timed out|error|api error|\(no )/i.test(c)) return false;
  if (!c.includes('#')) return false;                      // không có heading markdown
  return true;
}

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
  async ensureFresh(repoPath: string, baseBranch?: string): Promise<Knowledge> {
    const k = key(repoPath);
    const existingNow = this.get(repoPath);
    // Đang có một lượt (re)build chạy → không khởi động lượt nữa; trả cache hiện có (hoặc rỗng).
    if (building.has(k)) {
      return existingNow ?? { content: '', meta: { built_at_commit: '', built_at: 0, version: VERSION } };
    }

    const base = baseBranch ?? config.GIT_DEFAULT_BASE_BRANCH;
    const cur = (await gitHead(repoPath, base)) ?? (await gitHead(repoPath, 'HEAD')) ?? '';
    const existing = existingNow;

    if (!existing) {
      log.info({ repoPath }, 'Knowledge cache: cold start — building');
      return this.runGuarded(k, () => this.build(repoPath, cur));
    }

    // Git đổi?
    if (cur && existing.meta.built_at_commit && cur !== existing.meta.built_at_commit) {
      const files = await changedFiles(repoPath, existing.meta.built_at_commit, cur);
      if (files.length === 0) {
        log.debug({ repoPath }, 'Knowledge cache: commit khác nhưng 0 file đổi — coi như tươi');
      } else if (files.length <= config.KNOWLEDGE_INCREMENTAL_MAX_FILES) {
        log.info({ repoPath, changed: files.length }, 'Knowledge cache: incremental update');
        return this.runGuarded(k, () => this.incrementalUpdate(repoPath, existing, files, cur));
      } else {
        log.info({ repoPath, changed: files.length }, 'Knowledge cache: nhiều thay đổi — rebuild');
        return this.runGuarded(k, () => this.build(repoPath, cur));
      }
    }

    // TTL
    const ageDays = (Date.now() - existing.meta.built_at) / 86_400_000;
    if (ageDays > config.KNOWLEDGE_TTL_DAYS) {
      log.info({ repoPath, ageDays: Math.round(ageDays) }, 'Knowledge cache: hết TTL — rebuild');
      return this.runGuarded(k, () => this.build(repoPath, cur || existing.meta.built_at_commit));
    }

    return existing;
  },

  /** Chạy 1 lượt build/update có guard (đánh dấu đang build → tránh trùng → luôn nhả guard). */
  async runGuarded(k: string, fn: () => Promise<Knowledge>): Promise<Knowledge> {
    building.add(k);
    try { return await fn(); }
    finally { building.delete(k); }
  },

  /** Cold start / rebuild: IndexerAgent khám phá repo 1 lần → sinh BẢN ĐỒ DỰ ÁN chi tiết. */
  async build(repoPath: string, commit: string): Promise<Knowledge> {
    const prompt =
      `Bạn là kỹ sư khảo sát codebase tại: ${repoPath}. Hãy khám phá HIỆU QUẢ (đừng đọc tràn lan — ` +
      `ngữ cảnh quá lớn sẽ lỗi). Trình tự gợi ý:\n` +
      `1. Glob lấy cây thư mục tổng thể.\n` +
      `2. Read các file "kể chuyện" nhất: README, tài liệu trong docs/, manifest/package.json/__manifest__.py, ` +
      `CLAUDE.md (nếu có).\n` +
      `3. Read CÓ CHỌN LỌC vài file ĐẠI DIỆN cho mỗi tầng (1 model, 1 controller/route, 1 view/component) — ` +
      `KHÔNG đọc mọi file, KHÔNG đọc trọn file lớn (>500 dòng) mà chỉ phần đầu.\n` +
      `4. Khi đã đủ hiểu thì DỪNG và xuất bản đồ.\n\n` +
      `Sinh "BẢN ĐỒ DỰ ÁN" (markdown) để agent khác đọc xong biết hệ thống làm gì, ai dùng, luồng ra sao, ` +
      `"cái gì ở file nào". KHÔNG chép nguyên code; mô tả + trỏ đường dẫn (kèm số dòng khi cần). Gồm:\n\n` +
      `## Tổng quan & mục tiêu hệ thống\n## Vai trò người dùng & luồng xử lý chính (nếu có)\n` +
      `## Tech stack\n## Sơ đồ thư mục/module (cây rút gọn + vai trò từng phần)\n` +
      `## Map màn hình/feature → file/route\n## Data model chính & pattern\n## API endpoints (nếu có)\n` +
      `## Quy ước & best practices (đặt tên, format số/ngày, phân quyền, lệnh build/test)\n` +
      `## File/điểm vào quan trọng (đường dẫn:dòng)\n\n` +
      `Viết TIẾNG VIỆT, chính xác theo code thật. Tối đa ~700 dòng. CHỈ in markdown bản đồ, không lời dẫn.`;
    const content = (await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath,
      maxTurns: config.KNOWLEDGE_BUILD_MAX_TURNS, timeoutMs: config.KNOWLEDGE_BUILD_TIMEOUT_MS,
      label: `index:${key(repoPath)}`,
    })).trim();
    // KHÔNG lưu output rác/lỗi (vd "Request timed out") → tránh "nhiễm" cache, để lần sau build lại.
    if (!isValidMap(content)) {
      throw new Error(`Indexer trả nội dung không hợp lệ, bỏ qua lưu cache: "${content.slice(0, 80)}"`);
    }
    return this.save(repoPath, content, commit);
  },

  /** Cập nhật tăng dần: chỉ đọc các file đã đổi → vá đúng mục liên quan trong cache. */
  async incrementalUpdate(repoPath: string, existing: Knowledge, files: string[], commit: string): Promise<Knowledge> {
    const prompt =
      `Bản đồ dự án hiện tại (markdown) cần CẬP NHẬT do ${files.length} file vừa thay đổi.\n\n` +
      `### Bản đồ hiện tại\n${existing.content}\n\n` +
      `### File đã thay đổi (đọc bằng tool Read nếu cần để hiểu ảnh hưởng)\n${files.map(f => `- ${f}`).join('\n')}\n\n` +
      `Hãy CHỈNH các mục liên quan của bản đồ cho khớp thay đổi (thêm/sửa/bỏ entry). Giữ nguyên phần không liên quan. ` +
      `CHỈ in lại TOÀN BỘ markdown bản đồ đã cập nhật, không lời dẫn.`;
    const content = (await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 12,
      timeoutMs: config.KNOWLEDGE_BUILD_TIMEOUT_MS, label: `index:${key(repoPath)}`,
    })).trim();
    // Output lỗi → giữ nguyên cache cũ (đừng ghi đè bằng rác).
    if (!isValidMap(content)) {
      log.warn({ repoPath }, 'Incremental update trả nội dung không hợp lệ — giữ cache cũ');
      return existing;
    }
    return this.save(repoPath, content, commit);
  },
};
