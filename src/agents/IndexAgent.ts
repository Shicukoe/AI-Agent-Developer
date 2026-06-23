import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('index-agent');

/** 1 quy tắc trích định nghĩa: nhãn + regex (nhóm 1 = ký hiệu, nếu không có thì lấy cả dòng) + glob file. */
export interface IndexPattern { label: string; pattern: string; globs: string[] }

/**
 * Bộ pattern MẶC ĐỊNH ĐA-NGÔN-NGỮ (KHÔNG hardcode 1 loại repo). Pattern nào không khớp → mục đó rỗng & bỏ qua,
 * nên repo TS/Go/Java/Python… đều dùng được. Repo có nhu cầu riêng đặt thêm ở `<repo>/.indexrc.json` (xem dưới).
 */
const DEFAULT_PATTERNS: IndexPattern[] = [
  { label: 'Class', pattern: 'class\\s+(\\w+)', globs: ['*.py', '*.js', '*.ts', '*.tsx', '*.java', '*.cs', '*.php', '*.rb', '*.kt'] },
  { label: 'Hàm (def/func/fn)', pattern: '^\\s*(?:def|func|fn)\\s+(\\w+)', globs: ['*.py', '*.go', '*.rs'] },
  { label: 'Hàm (JS/TS)', pattern: '(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', globs: ['*.js', '*.ts', '*.jsx', '*.tsx'] },
  { label: 'Export (const/class/interface/type/enum)', pattern: 'export\\s+(?:default\\s+)?(?:const|class|function|interface|type|enum)\\s+(\\w+)', globs: ['*.ts', '*.tsx', '*.js', '*.jsx'] },
  // Bonus theo framework — repo không dùng sẽ rỗng (không ảnh hưởng):
  { label: 'Odoo model (_name)', pattern: "_name\\s*=\\s*['\"]([A-Za-z0-9_.]+)['\"]", globs: ['*.py'] },
  { label: 'Registry .add(key)', pattern: "\\.add\\(\\s*['\"]([^'\"]+)['\"]", globs: ['*.js', '*.ts'] },
  { label: 'Ràng buộc template_name (XML)', pattern: 'template_name"\\s*>\\s*([^<]+)<', globs: ['*.xml'] },
  { label: 'Route/Controller', pattern: '@(?:http\\.route|app\\.\\w+|router\\.\\w+|Get|Post|Put|Delete)\\(', globs: ['*.py', '*.js', '*.ts', '*.go', '*.java'] },
];

/** Đọc pattern bổ sung của repo (tùy chọn) tại `<repo>/.indexrc.json` (mảng {label,pattern,globs}). */
function repoPatterns(repoPath: string): IndexPattern[] {
  const f = join(repoPath, '.indexrc.json');
  if (!existsSync(f)) return [];
  try {
    const arr = JSON.parse(readFileSync(f, 'utf8'));
    if (Array.isArray(arr)) return arr.filter(p => p && p.label && p.pattern && Array.isArray(p.globs));
  } catch (err) { log.warn({ err: (err as Error).message }, '.indexrc.json không hợp lệ — bỏ qua'); }
  return [];
}

async function grep(repoPath: string, pattern: string, globs: string[]): Promise<string[]> {
  const { stdout } = await ShellExecutor.git(['grep', '-nI', '-E', pattern, '--', ...globs], repoPath).catch(() => ({ stdout: '' }));
  return stdout.split('\n').map(l => l.trim()).filter(Boolean);
}

/** Bảng markdown [Ký hiệu | File] khử trùng + cắt giới hạn. */
function table(rows: Array<[string, string]>, limit = 400): string {
  const seen = new Set<string>();
  const out: string[] = ['| Ký hiệu | File |', '|---|---|'];
  for (const [a, b] of rows) {
    const k = `${a}|${b}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(`| \`${a}\` | \`${b}\` |`);
    if (out.length - 2 >= limit) { out.push('| … | (cắt bớt) |'); break; }
  }
  return out.length > 2 ? out.join('\n') : '';
}

/**
 * IndexAgent: dựng CHỈ MỤC repo bằng grep TĨNH (KHÔNG dùng LLM → gần như miễn phí token) → agent khác tra
 * "thứ X nằm file nào" thay vì đọc/grep lặp. ĐA-NGÔN-NGỮ qua bộ pattern mặc định + mở rộng được per-repo
 * (`<repo>/.indexrc.json`). Không hardcode 1 loại repo.
 */
export const IndexAgent = {
  async build(repoPath: string, indexFilePath: string): Promise<{ files: number }> {
    // Cây file theo thư mục cấp 1–2 (git ls-files) — generic.
    const { stdout: lsOut } = await ShellExecutor.git(['ls-files'], repoPath).catch(() => ({ stdout: '' }));
    const files = lsOut.split('\n').map(s => s.trim()).filter(Boolean);
    const byTop = new Map<string, number>();
    for (const f of files) {
      const top = f.split('/').slice(0, 2).join('/');
      byTop.set(top, (byTop.get(top) ?? 0) + 1);
    }
    const tree = [...byTop.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `- \`${d}\` — ${n} file`).join('\n');

    const sections: string[] = [
      '# Chỉ mục dự án (tự sinh bằng grep — KHÔNG sửa tay)',
      '> Tra NHANH "ký hiệu/định nghĩa X nằm ở file nào" trước khi đọc/grep — tránh đọc lặp. Mở rộng pattern tại `<repo>/.indexrc.json`.\n',
      `## Cây thư mục (số file)\n${tree || '(trống)'}`,
    ];

    const patterns = [...DEFAULT_PATTERNS, ...repoPatterns(repoPath)];
    let symbolCount = 0;
    for (const p of patterns) {
      const re = new RegExp(p.pattern);
      const rows = (await grep(repoPath, p.pattern, p.globs))
        .map(line => {
          const m = line.match(/^([^:]+):\d+:(.*)$/);
          if (!m) return null;
          const sym = m[2].match(re)?.[1] ?? m[2].trim().slice(0, 80);
          return [sym, m[1]] as [string, string];
        })
        .filter(Boolean) as Array<[string, string]>;
      const t = table(rows);
      if (t) { sections.push(`## ${p.label}\n${t}`); symbolCount += rows.length; }
    }

    if (!existsSync(dirname(indexFilePath))) mkdirSync(dirname(indexFilePath), { recursive: true });
    writeFileSync(indexFilePath, sections.join('\n\n') + '\n', 'utf8');
    log.info({ repoPath, files: files.length, symbols: symbolCount, patterns: patterns.length }, 'Index built');
    return { files: files.length };
  },
};
