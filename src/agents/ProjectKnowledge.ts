import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { LlmClient } from '../claude/LlmClient.js';
import { TaskRepository, type Task } from '../state/TaskRepository.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('project-knowledge');

/** Một luồng xử lý (nghiệp vụ hoặc kỹ thuật) — đơn vị để chia nhỏ kiến trúc. */
export interface FlowInfo {
  key: string;          // slug, dùng làm tên file flows/<key>.md
  title: string;        // tên luồng hiển thị
  keywords: string[];   // từ khoá để chọn luồng liên quan
  paths: string[];      // file/thư mục chính của luồng (gợi ý cho indexer + chọn luồng)
}
export interface KnowledgeMeta {
  built_at_commit: string;
  built_at: number;
  version: number;
  flows: FlowInfo[];    // index luồng (sinh kèm overview)
}
export interface Knowledge {
  overview: string;     // kiến trúc TỔNG THỂ (markdown)
  meta: KnowledgeMeta;
}

const VERSION = 2;      // bump: cấu trúc đa-file (overview + flows)

/** Guard: repo đang dựng overview / flows — tránh dựng trùng khi chạy nền nhiều task. */
const building = new Set<string>();
const flowsBuilding = new Set<string>();

function isValidMap(content: string): boolean {
  const c = content.trim();
  if (c.length < 200) return false;
  if (/^(request timed out|error|api error|\(no )/i.test(c)) return false;
  if (!c.includes('#')) return false;
  return true;
}

function slug(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'flow';
}

function baseDir(): string { return join(config.DATA_DIR, 'knowledge'); }
function key(repoPath: string): string { return createHash('sha1').update(repoPath).digest('hex').slice(0, 12); }
function repoDir(repoPath: string): string { return join(baseDir(), key(repoPath)); }
function overviewPath(repoPath: string): string { return join(repoDir(repoPath), 'overview.md'); }
function metaPath(repoPath: string): string { return join(repoDir(repoPath), 'meta.json'); }
function flowsDir(repoPath: string): string { return join(repoDir(repoPath), 'flows'); }
function flowPath(repoPath: string, flowKey: string): string { return join(flowsDir(repoPath), `${flowKey}.md`); }

async function gitHead(repoPath: string, ref: string): Promise<string | null> {
  try { const { stdout } = await ShellExecutor.git(['rev-parse', ref], repoPath); return stdout.trim() || null; }
  catch { return null; }
}
async function changedFiles(repoPath: string, from: string, to: string): Promise<string[]> {
  try { const { stdout } = await ShellExecutor.git(['diff', '--name-only', from, to], repoPath); return stdout.split('\n').map(s => s.trim()).filter(Boolean); }
  catch { return []; }
}

/** Tách overview markdown + danh sách luồng (khối ```json cuối) từ output indexer. */
function parseOverview(raw: string): { overview: string; flows: FlowInfo[] } {
  let overview = raw.trim();
  let flows: FlowInfo[] = [];
  const blocks = [...raw.matchAll(/```json\s*([\s\S]*?)```/g)];
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(blocks[i][1].trim());
      if (Array.isArray(parsed)) {
        flows = parsed
          .filter((f: unknown) => f && typeof (f as FlowInfo).title === 'string')
          .map((f: Partial<FlowInfo>) => ({
            key: slug(f.key || f.title || ''),
            title: String(f.title),
            keywords: Array.isArray(f.keywords) ? f.keywords.map(String) : [],
            paths: Array.isArray(f.paths) ? f.paths.map(String) : [],
          }))
          .slice(0, config.KNOWLEDGE_MAX_FLOWS);
        // bỏ khối json khỏi overview để file .md sạch
        overview = raw.replace(blocks[i][0], '').trim();
        break;
      }
    } catch { /* thử khối trước */ }
  }
  return { overview, flows };
}

export const ProjectKnowledge = {
  get(repoPath: string): Knowledge | null {
    try {
      if (!existsSync(overviewPath(repoPath)) || !existsSync(metaPath(repoPath))) return null;
      const overview = readFileSync(overviewPath(repoPath), 'utf8');
      const meta = JSON.parse(readFileSync(metaPath(repoPath), 'utf8')) as KnowledgeMeta;
      if (!Array.isArray(meta.flows)) meta.flows = [];
      return { overview, meta };
    } catch { return null; }
  },

  /** Kiến trúc TỔNG THỂ (overview) rút gọn — dùng cho Triage và làm nền cho mọi agent. */
  summary(repoPath: string, maxChars = 2500): string {
    const k = this.get(repoPath);
    if (!k) return '';
    const o = k.overview;
    return o.length > maxChars ? o.slice(0, maxChars) + '\n…(rút gọn)' : o;
  },

  loadFlow(repoPath: string, flowKey: string): string | null {
    try { const p = flowPath(repoPath, flowKey); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
    catch { return null; }
  },

  saveOverview(repoPath: string, overview: string, flows: FlowInfo[], commit: string): Knowledge {
    mkdirSync(repoDir(repoPath), { recursive: true });
    const meta: KnowledgeMeta = { built_at_commit: commit, built_at: Date.now(), version: VERSION, flows };
    writeFileSync(overviewPath(repoPath), overview, 'utf8');
    writeFileSync(metaPath(repoPath), JSON.stringify(meta, null, 2), 'utf8');
    return { overview, meta };
  },

  /** Đảm bảo cache tươi (chạy nền ở caller). Cold start/đổi nhiều/TTL → dựng lại overview + index luồng. */
  async ensureFresh(repoPath: string, baseBranch?: string): Promise<Knowledge> {
    const k = key(repoPath);
    const existingNow = this.get(repoPath);
    if (building.has(k)) {
      return existingNow ?? { overview: '', meta: { built_at_commit: '', built_at: 0, version: VERSION, flows: [] } };
    }
    const base = baseBranch ?? config.GIT_DEFAULT_BASE_BRANCH;
    const cur = (await gitHead(repoPath, base)) ?? (await gitHead(repoPath, 'HEAD')) ?? '';
    const existing = existingNow;

    if (!existing) {
      log.info({ repoPath }, 'Knowledge: cold start — building overview');
      return this.runGuarded(k, () => this.build(repoPath, cur));
    }
    if (cur && existing.meta.built_at_commit && cur !== existing.meta.built_at_commit) {
      const files = await changedFiles(repoPath, existing.meta.built_at_commit, cur);
      if (files.length === 0) {
        log.debug({ repoPath }, 'Knowledge: commit khác nhưng 0 file đổi — coi như tươi');
      } else if (files.length <= config.KNOWLEDGE_INCREMENTAL_MAX_FILES) {
        log.info({ repoPath, changed: files.length }, 'Knowledge: incremental update overview');
        return this.runGuarded(k, () => this.incrementalUpdate(repoPath, existing, files, cur));
      } else {
        log.info({ repoPath, changed: files.length }, 'Knowledge: nhiều thay đổi — rebuild');
        return this.runGuarded(k, () => this.build(repoPath, cur));
      }
    }
    const ageDays = (Date.now() - existing.meta.built_at) / 86_400_000;
    if (ageDays > config.KNOWLEDGE_TTL_DAYS) {
      log.info({ repoPath, ageDays: Math.round(ageDays) }, 'Knowledge: hết TTL — rebuild');
      return this.runGuarded(k, () => this.build(repoPath, cur || existing.meta.built_at_commit));
    }
    // Cache tươi — đảm bảo flow docs còn thiếu được dựng (nền).
    void this.buildFlows(repoPath);
    return existing;
  },

  async runGuarded(k: string, fn: () => Promise<Knowledge>): Promise<Knowledge> {
    building.add(k);
    try { return await fn(); }
    finally { building.delete(k); }
  },

  /** Phase A: khám phá repo → overview (tổng thể) + index luồng. Sau đó dựng flow docs ở NỀN. */
  async build(repoPath: string, commit: string): Promise<Knowledge> {
    const prompt =
      `Bạn là kỹ sư khảo sát codebase tại: ${repoPath}. Khám phá HIỆU QUẢ (đừng đọc tràn lan):\n` +
      `1. Glob lấy cây thư mục. 2. Read README/docs/manifest/package.json/__manifest__.py/CLAUDE.md. ` +
      `3. Read CÓ CHỌN LỌC vài file đại diện mỗi tầng (không đọc mọi file, không đọc trọn file >500 dòng).\n\n` +
      `Sinh "KIẾN TRÚC TỔNG THỂ" (markdown), KHÔNG chép code, mô tả + trỏ đường dẫn:\n` +
      `## Tổng quan & mục tiêu hệ thống\n## Vai trò người dùng & luồng xử lý chính\n## Tech stack\n` +
      `## Sơ đồ thư mục/module (cây + vai trò)\n## Data model chính & pattern\n## API endpoints (nếu có)\n` +
      `## Quy ước & best practices\n## File/điểm vào quan trọng (đường dẫn:dòng)\n\n` +
      `CUỐI CÙNG, in một khối \`\`\`json là DANH SÁCH LUỒNG xử lý chính (nghiệp vụ HOẶC kỹ thuật) để ` +
      `chia nhỏ kiến trúc — mỗi luồng là một mảng việc gắn kết, agent sau chỉ cần đọc luồng liên quan:\n` +
      `\`\`\`json\n[{"key":"slug-ngan","title":"Tên luồng","keywords":["từ khoá",...],"paths":["thư mục/file chính",...]}]\n\`\`\`\n` +
      `Chọn ${Math.min(4, config.KNOWLEDGE_MAX_FLOWS)}-${config.KNOWLEDGE_MAX_FLOWS} luồng bao quát hệ thống. ` +
      `TIẾNG VIỆT, overview ≤ 600 dòng. CHỈ in markdown rồi khối json, không lời dẫn.`;
    const raw = (await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath,
      maxTurns: config.KNOWLEDGE_BUILD_MAX_TURNS, timeoutMs: config.KNOWLEDGE_BUILD_TIMEOUT_MS,
      label: `index:${key(repoPath)}`,
    })).trim();
    if (!isValidMap(raw)) throw new Error(`Indexer overview không hợp lệ: "${raw.slice(0, 80)}"`);
    const { overview, flows } = parseOverview(raw);
    const saved = this.saveOverview(repoPath, overview, flows, commit);
    log.info({ repoPath, flows: flows.length }, 'Knowledge: overview built — dựng flow docs ở nền');
    void this.buildFlows(repoPath);   // dựng kiến trúc từng luồng ở nền
    return saved;
  },

  /** Incremental: vá overview theo file đã đổi (giữ index luồng cũ), rồi dựng flow còn thiếu (nền). */
  async incrementalUpdate(repoPath: string, existing: Knowledge, files: string[], commit: string): Promise<Knowledge> {
    const prompt =
      `KIẾN TRÚC TỔNG THỂ hiện tại cần CẬP NHẬT do ${files.length} file vừa đổi.\n\n` +
      `### Hiện tại\n${existing.overview}\n\n### File đã đổi (Read nếu cần)\n${files.map(f => `- ${f}`).join('\n')}\n\n` +
      `CHỈNH các mục liên quan cho khớp (thêm/sửa/bỏ), giữ nguyên phần không liên quan. ` +
      `CHỈ in lại TOÀN BỘ markdown overview đã cập nhật, KHÔNG kèm khối json, không lời dẫn.`;
    const content = (await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath, maxTurns: 12,
      timeoutMs: config.KNOWLEDGE_BUILD_TIMEOUT_MS, label: `index:${key(repoPath)}`,
    })).trim();
    if (!isValidMap(content)) { log.warn({ repoPath }, 'Incremental không hợp lệ — giữ cache cũ'); return existing; }
    const saved = this.saveOverview(repoPath, content, existing.meta.flows, commit);
    void this.buildFlows(repoPath);
    return saved;
  },

  /** Dựng kiến trúc CHI TIẾT cho các luồng CHƯA có file (chạy tuần tự, nền). */
  async buildFlows(repoPath: string): Promise<void> {
    const k = key(repoPath);
    if (flowsBuilding.has(k)) return;
    const meta = this.get(repoPath)?.meta;
    if (!meta || meta.flows.length === 0) return;
    const missing = meta.flows.filter(f => !existsSync(flowPath(repoPath, f.key)));
    if (missing.length === 0) return;
    flowsBuilding.add(k);
    try {
      mkdirSync(flowsDir(repoPath), { recursive: true });
      for (const flow of missing) {
        try { await this.buildFlowDoc(repoPath, flow); }
        catch (err) { log.warn({ repoPath, flow: flow.key, err: (err as Error).message }, 'Dựng flow doc lỗi — bỏ qua'); }
      }
    } finally { flowsBuilding.delete(k); }
  },

  async buildFlowDoc(repoPath: string, flow: FlowInfo): Promise<void> {
    const prompt =
      `Trong repo tại ${repoPath}, viết KIẾN TRÚC CHI TIẾT cho luồng "${flow.title}".\n` +
      `File/đường dẫn liên quan (gợi ý — Read/Glob/Grep TẬP TRUNG vào đây, đừng lan sang luồng khác):\n` +
      `${flow.paths.map(p => `- ${p}`).join('\n') || '- (tự tìm theo từ khoá: ' + flow.keywords.join(', ') + ')'}\n\n` +
      `Trình bày (markdown): mục tiêu nghiệp vụ của luồng; các bước/luồng xử lý; file/hàm/route chính ` +
      `(đường dẫn:dòng); data model liên quan; nơi hay phải sửa; lưu ý/cạm bẫy. ` +
      `KHÔNG chép nguyên code. TIẾNG VIỆT, ≤ 300 dòng, CHỈ markdown.`;
    const content = (await LlmClient.run(prompt, config.MODEL_INDEXER, {
      allowedTools: ['Read', 'Glob', 'Grep'], cwd: repoPath,
      maxTurns: config.KNOWLEDGE_FLOW_MAX_TURNS, timeoutMs: config.KNOWLEDGE_BUILD_TIMEOUT_MS,
      label: `flow:${flow.key}`,
    })).trim();
    if (!isValidMap(content)) throw new Error(`flow "${flow.key}" output không hợp lệ`);
    mkdirSync(flowsDir(repoPath), { recursive: true });
    writeFileSync(flowPath(repoPath, flow.key), content, 'utf8');
    log.info({ repoPath, flow: flow.key }, 'Knowledge: flow doc built');
  },

  /** 1 LLM rẻ đọc card + index luồng → chọn (các) luồng liên quan. [] nếu không rõ. */
  async selectFlowKeys(repoPath: string, cardText: string, flows: FlowInfo[]): Promise<string[]> {
    if (flows.length === 0) return [];
    const list = flows.map(f => `- ${f.key}: ${f.title}${f.keywords.length ? ` [${f.keywords.join(', ')}]` : ''}`).join('\n');
    try {
      const res = await LlmClient.runForJson<{ keys: string[] }>(
        `Chọn (các) LUỒNG liên quan NHẤT để xử lý task dưới đây. Chọn 1-2 luồng sát nhất; nếu không luồng nào rõ → [].\n\n` +
        `### Task\n${cardText.slice(0, 1500)}\n\n### Luồng của dự án\n${list}\n\n` +
        `Trả JSON: {"keys": ["key1", ...]} — chỉ dùng key có trong danh sách.`,
        config.MODEL_TRIAGE,
        { maxTurns: 1, label: `flowpick:${key(repoPath)}` },
      );
      const valid = new Set(flows.map(f => f.key));
      return (res.keys ?? []).map(slug).filter(x => valid.has(x)).slice(0, 2);
    } catch (err) {
      log.warn({ repoPath, err: (err as Error).message }, 'selectFlowKeys lỗi — dùng overview-only');
      return [];
    }
  },

  /**
   * Ngữ cảnh kiến trúc cho 1 task: overview (tổng thể) + kiến trúc luồng LIÊN QUAN (chọn 1 lần/task,
   * cache keys vào metadata.knowledge_flows). Agent đọc ít hơn, tập trung vào đúng luồng.
   */
  async contextForTask(task: Task, cardText: string, maxOverview = 3000, maxFlow = 4000): Promise<string> {
    const repoPath = task.repo_path ?? config.GIT_REPO_PATH;
    const k = this.get(repoPath);
    if (!k) return '';
    let block = `## Kiến trúc tổng thể\n${k.overview.length > maxOverview ? k.overview.slice(0, maxOverview) + '\n…(rút gọn)' : k.overview}`;

    const flows = k.meta.flows ?? [];
    if (flows.length === 0) return block;

    // Lấy keys đã chọn (cache theo task) hoặc chọn mới 1 lần.
    let keys: string[] | null = null;
    try {
      const meta = task.metadata ? JSON.parse(task.metadata) as Record<string, unknown> : {};
      if (Array.isArray(meta.knowledge_flows)) keys = (meta.knowledge_flows as string[]);
    } catch { /* ignore */ }
    if (keys === null) {
      keys = await this.selectFlowKeys(repoPath, cardText, flows);
      TaskRepository.mergeMetadata(task.id, { knowledge_flows: keys });
    }

    const byKey = new Map(flows.map(f => [f.key, f]));
    for (const key0 of keys) {
      const doc = this.loadFlow(repoPath, key0);
      const title = byKey.get(key0)?.title ?? key0;
      if (doc) block += `\n\n## Kiến trúc luồng liên quan: ${title}\n${doc.length > maxFlow ? doc.slice(0, maxFlow) + '\n…(rút gọn)' : doc}`;
    }
    return block;
  },

  /** Liệt kê key các flow đã có file (debug/diagnostics). */
  listBuiltFlows(repoPath: string): string[] {
    try { return readdirSync(flowsDir(repoPath)).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')); }
    catch { return []; }
  },
};
