import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'fs';
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

// ── Bản đồ RESOLVE (data-driven wiring) ─────────────────────────────────────────────────────────────
// Nhiều framework chọn hành vi/giao diện qua DỮ LIỆU (id tham chiếu → định nghĩa → đăng ký component) chứ
// không qua if/else — nguồn sai số 1 của review tĩnh. Bộ này parse TĨNH (regex, không LLM) để dựng sẵn
// chuỗi resolve, agent/reviewer TRA thay vì tự lần. Hiện hỗ trợ mẫu Odoo report (item → type_id →
// template_name → registry component); repo không có mẫu này thì các bảng rỗng → section tự bỏ qua.

interface XmlRecord { id: string; model: string; fields: Map<string, { text?: string; ref?: string }>; }

/** Parse các <record> Odoo XML (không lồng nhau) → id/model + field (text hoặc ref). */
function parseXmlRecords(xml: string): XmlRecord[] {
  const out: XmlRecord[] = [];
  const recRe = /<record\b([^>]*)>([\s\S]*?)<\/record>/g;
  let m: RegExpExecArray | null;
  while ((m = recRe.exec(xml))) {
    const id = m[1].match(/\bid\s*=\s*"([^"]+)"/)?.[1] ?? '';
    const model = m[1].match(/\bmodel\s*=\s*"([^"]+)"/)?.[1] ?? '';
    const fields = new Map<string, { text?: string; ref?: string }>();
    const fRe = /<field\b([^>]*?)(?:\/>|>([\s\S]*?)<\/field>)/g;
    let fm: RegExpExecArray | null;
    while ((fm = fRe.exec(m[2]))) {
      const name = fm[1].match(/\bname\s*=\s*"([^"]+)"/)?.[1];
      if (!name) continue;
      const ref = fm[1].match(/\bref\s*=\s*"([^"]+)"/)?.[1];
      fields.set(name, { ref, text: fm[2]?.trim() });
    }
    if (id || model) out.push({ id, model, fields });
  }
  return out;
}

/**
 * Dựng section "Bản đồ resolve" từ XML data + JS registry.
 * @param read đọc nội dung 1 file tracked (trả '' nếu lỗi)
 */
function buildWiringSection(files: string[], read: (rel: string) => string): string {
  const xmls = files.filter(f => f.endsWith('.xml'));
  const jss = files.filter(f => /\.(js|ts)$/.test(f));
  if (!xmls.length && !jss.length) return '';

  // 1) item type (model chứa "item.type") → template_name
  const typeToTemplate = new Map<string, { template: string; file: string }>();
  // 2) item bất kỳ tham chiếu type_id → (name/code, type ref) để resolve
  const itemsWithType: Array<{ label: string; typeRef: string; file: string }> = [];
  for (const f of xmls) {
    const recs = parseXmlRecords(read(f));
    for (const r of recs) {
      const tmpl = r.fields.get('template_name')?.text;
      if (tmpl && /item\.type$/.test(r.model) && r.id) typeToTemplate.set(r.id, { template: tmpl, file: f });
      const typeRef = r.fields.get('type_id')?.ref;
      if (typeRef) {
        const name = r.fields.get('name')?.text ?? '';
        const code = r.fields.get('code')?.text ?? '';
        const label = [name, code && `code=${code}`].filter(Boolean).join(' · ') || r.id || '(?)';
        itemsWithType.push({ label, typeRef, file: f });
      }
    }
  }

  // 3) registry.category("cat").add("key", Component) → key → {component, file, cat}
  const registry = new Map<string, { comp: string; file: string; cat: string }>();
  const regRe = /registry\s*\.\s*category\(\s*["']([^"']+)["']\s*\)\s*\.\s*add\(\s*["']([^"']+)["']\s*,\s*([A-Za-z0-9_]+)/g;
  for (const f of jss) {
    const src = read(f);
    let rm: RegExpExecArray | null;
    while ((rm = regRe.exec(src))) registry.set(rm[2], { comp: rm[3], file: f, cat: rm[1] });
  }

  if (!typeToTemplate.size && !registry.size) return '';

  const lines: string[] = ['## Bản đồ resolve (data-driven wiring)',
    '> Hành vi/UI được chọn qua DỮ LIỆU, không qua if/else. Lần theo chuỗi này thay vì tìm "code viết riêng".'];

  // Bảng resolve đầy đủ: item → type_id → template_name → component (giá trị cao nhất cho reviewer)
  if (itemsWithType.length && typeToTemplate.size) {
    const rows: string[] = ['', '### Item → type_id → template_name → component',
      '| Item (name/code) | type_id | template_name | Component (file) |', '|---|---|---|---|'];
    const seen = new Set<string>();
    let n = 0;
    for (const it of itemsWithType) {
      const t = typeToTemplate.get(it.typeRef);
      const tmpl = t?.template ?? '';
      const reg = tmpl ? registry.get(tmpl) : undefined;
      const comp = reg ? `\`${reg.comp}\` (\`${reg.file}\`)` : (tmpl ? '⚠️ template_name chưa đăng ký' : '⚠️ type_id chưa định nghĩa');
      const key = `${it.label}|${it.typeRef}`;
      if (seen.has(key)) continue; seen.add(key);
      rows.push(`| ${it.label} | \`${it.typeRef}\` | \`${tmpl || '?'}\` | ${comp} |`);
      if (++n >= 300) { rows.push('| … | | | (cắt bớt) |'); break; }
    }
    lines.push(...rows);
  }

  // Bảng item type → template_name
  if (typeToTemplate.size) {
    const rows: string[] = ['', '### item.type → template_name', '| type id | template_name | File |', '|---|---|---|'];
    let n = 0;
    for (const [id, v] of typeToTemplate) {
      rows.push(`| \`${id}\` | \`${v.template}\` | \`${v.file}\` |`);
      if (++n >= 200) { rows.push('| … | | (cắt bớt) |'); break; }
    }
    lines.push(...rows);
  }

  // Bảng đăng ký component
  if (registry.size) {
    const rows: string[] = ['', '### registry → component', '| category | key | Component | File |', '|---|---|---|---|'];
    let n = 0;
    for (const [key, v] of registry) {
      rows.push(`| \`${v.cat}\` | \`${key}\` | \`${v.comp}\` | \`${v.file}\` |`);
      if (++n >= 200) { rows.push('| … | | | (cắt bớt) |'); break; }
    }
    lines.push(...rows);
  }

  return lines.join('\n');
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

    // Bản đồ resolve (data-driven wiring) — parse tĩnh XML/JS để dựng sẵn chuỗi item→type→template→component.
    // Đọc nội dung file tracked (bỏ qua file > 1MB / lỗi) để khỏi tự lần lúc review.
    const read = (rel: string): string => {
      try {
        const full = join(repoPath, rel);
        if (statSync(full).size > 1_000_000) return '';
        return readFileSync(full, 'utf8');
      } catch { return ''; }
    };
    try {
      const wiring = buildWiringSection(files, read);
      if (wiring) sections.push(wiring);
    } catch (err) { log.warn({ err: (err as Error).message }, 'Không dựng được bản đồ resolve (bỏ qua)'); }

    if (!existsSync(dirname(indexFilePath))) mkdirSync(dirname(indexFilePath), { recursive: true });
    writeFileSync(indexFilePath, sections.join('\n\n') + '\n', 'utf8');
    log.info({ repoPath, files: files.length, symbols: symbolCount, patterns: patterns.length }, 'Index built');
    return { files: files.length };
  },
};
