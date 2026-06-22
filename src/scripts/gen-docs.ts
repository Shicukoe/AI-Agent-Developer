/**
 * Sinh / CẬP NHẬT TÀI LIỆU DỰ ÁN cho repo đích (review code → viết docs/). Tri thức người kiểm soát (commit cùng repo).
 *
 *   npm run gen-docs                      → repo mặc định (.env GIT_REPO_PATH)
 *   npm run gen-docs -- <board_id>        → repo của board đó (cấu hình admin)
 *   npm run gen-docs -- <repo_path>       → repo theo đường dẫn
 *   npm run gen-docs -- <target> --full   → ép sinh lại TOÀN BỘ (bỏ qua incremental)
 *
 * MẶC ĐỊNH incremental: đã có docs + mốc commit cũ → chỉ đọc commit MỚI kể từ lần trước và cập nhật đúng
 * doc bị ảnh hưởng (tiết kiệm token/thời gian). Lần đầu (chưa có mốc) → sinh đầy đủ. Chỉ chạy KHI được yêu cầu.
 * Agent có quyền GHI FILE trong docs/; người review rồi commit.
 */
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { LlmClient } from '../claude/LlmClient.js';
import { GitClient } from '../git/GitClient.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('gen-docs');

const SYNC_FILE = '.docs_sync.json';

function readSync(docsPath: string): { last_commit?: string } {
  try { return JSON.parse(readFileSync(join(docsPath, SYNC_FILE), 'utf8')); } catch { return {}; }
}
function writeSync(docsPath: string, head: string): void {
  try { writeFileSync(join(docsPath, SYNC_FILE), JSON.stringify({ last_commit: head, updated_at: new Date().toISOString() }, null, 2), 'utf8'); }
  catch (err) { log.warn({ docsPath, err }, 'Không ghi được mốc đồng bộ docs'); }
}

/** Prompt sinh ĐẦY ĐỦ bộ tài liệu (chia tổng thể / từng chức năng / bản đồ). */
function fullPrompt(docsRel: string): string {
  return `Bạn là kỹ sư viết TÀI LIỆU DỰ ÁN. Khảo sát toàn bộ mã nguồn tại thư mục làm việc và viết bộ tài liệu ` +
    `giúp người sau (kể cả người không rành code) hiểu dự án — phục vụ bước "làm rõ nghiệp vụ".\n\n` +
    `## Yêu cầu\n` +
    `1. Dùng Read/Glob/Grep khảo sát: kiến trúc, các module/màn hình/chức năng chính, mô hình dữ liệu, LUỒNG XỬ LÝ.\n` +
    `2. GHI FILE markdown vào thư mục \`${docsRel}/\` (tạo nếu chưa có) — CHIA THEO CẤU TRÚC:\n` +
    `   - \`${docsRel}/00_TONG_THE.md\`: tổng quan (mục đích, kiến trúc, công nghệ, các phần chính, luồng tổng).\n` +
    `   - \`${docsRel}/<tên-chức-năng>.md\`: mỗi màn hình/chức năng/luồng nghiệp vụ một file — mô tả NGHIỆP VỤ\n` +
    `     (người dùng làm được gì, luồng xử lý, dữ liệu liên quan) kèm con trỏ tới file code chính.\n` +
    `   - \`${docsRel}/00_BAN_DO_TAI_LIEU.md\`: "bản đồ tài liệu" — bảng liệt kê các file docs trên + mô tả 1 dòng.\n` +
    `3. NGẮN GỌN, văn phong TIẾNG VIỆT, ưu tiên ngôn ngữ nghiệp vụ; giữ nguyên tên file/biến/model. KHÔNG lan man.\n` +
    `4. Chỉ TẠO/SỬA file trong \`${docsRel}/\`. KHÔNG đụng code khác.\n\n` +
    `Khi xong, in tóm tắt (TIẾNG VIỆT) các file tài liệu đã tạo.`;
}

/** Prompt CẬP NHẬT incremental: chỉ sửa doc bị ảnh hưởng bởi commit mới. */
function incrementalPrompt(docsRel: string, sinceShort: string, changedFiles: string[]): string {
  const list = changedFiles.slice(0, 200).map(f => `- ${f}`).join('\n');
  return `Bộ tài liệu dự án đã có sẵn trong \`${docsRel}/\` (chia: 00_TONG_THE.md, từng chức năng, 00_BAN_DO_TAI_LIEU.md). ` +
    `CHỈ CẬP NHẬT phần thay đổi kể từ commit \`${sinceShort}\` tới HEAD — KHÔNG viết lại toàn bộ.\n\n` +
    `## Các file mã nguồn đã thay đổi\n${list || '(không có)'}\n\n` +
    `## Yêu cầu\n` +
    `1. Dùng Read/Glob/Grep đọc các file đã đổi + doc liên quan trong \`${docsRel}/\` để hiểu thay đổi ảnh hưởng chức năng nào.\n` +
    `2. CẬP NHẬT ĐÚNG doc bị ảnh hưởng: feature doc tương ứng (\`${docsRel}/<chức-năng>.md\`) — thêm mới nếu là chức năng mới;\n` +
    `   nếu kiến trúc/luồng tổng đổi thì sửa \`00_TONG_THE.md\`; cập nhật \`00_BAN_DO_TAI_LIEU.md\` khi thêm/bớt doc.\n` +
    `3. CHỈ sửa phần liên quan, GIỮ nguyên phần khác. Giữ CẤU TRÚC chia file. NGẮN GỌN, tiếng Việt.\n` +
    `4. Chỉ TẠO/SỬA file trong \`${docsRel}/\`.\n\n` +
    `Khi xong, in tóm tắt (TIẾNG VIỆT) các doc đã cập nhật + lý do.`;
}

/** Sinh/cập nhật docs vào `docsPath` của repo `repoPath`. Trả tóm tắt. */
export async function generateDocs(repoPath: string, docsPath: string, opts?: { full?: boolean }): Promise<string> {
  if (!existsSync(docsPath)) mkdirSync(docsPath, { recursive: true });
  const docsRel = relative(repoPath, docsPath).replace(/\\/g, '/') || 'docs';

  // Quyết định FULL vs INCREMENTAL: cần là git repo + có mốc cũ + có docs sẵn + không ép --full.
  const head = await GitClient.revParse(repoPath, 'HEAD');
  const last = readSync(docsPath).last_commit;
  const hasDocs = existsSync(join(docsPath, '00_TONG_THE.md'));
  let mode: 'full' | 'incremental' = 'full';
  let prompt = fullPrompt(docsRel);

  if (!opts?.full && head && last && last !== head && hasDocs) {
    const changed = (await GitClient.changedFiles(repoPath, `${last}..HEAD`))
      .filter(f => !f.startsWith(`${docsRel}/`)); // bỏ thay đổi trong chính docs/
    if (changed.length) {
      mode = 'incremental';
      prompt = incrementalPrompt(docsRel, last.slice(0, 8), changed);
    } else {
      log.info({ repoPath }, 'gen-docs: không có thay đổi code kể từ lần trước — chỉ cập nhật mốc');
      if (head) writeSync(docsPath, head);
      return 'Không có commit mới ảnh hưởng tài liệu kể từ lần trước.';
    }
  }

  log.info({ repoPath, docsPath, mode, last: last?.slice(0, 8), head: head?.slice(0, 8) }, 'gen-docs: bắt đầu');
  const summary = await LlmClient.run(prompt, config.MODEL_INDEXER, {
    allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    cwd: repoPath,
    timeoutMs: config.GEN_DOCS_TIMEOUT_MS,
    maxTurns: config.GEN_DOCS_MAX_TURNS,   // đủ lượt để ĐỌC repo + GHI nhiều file docs (CLI mặc định 8 là quá ít)
    label: `gendocs:${docsRel}`,
  });
  if (head) writeSync(docsPath, head);  // tiến mốc → lần sau chỉ xử lý commit mới hơn
  log.info({ repoPath, docsPath, mode }, 'gen-docs: xong (review + commit thủ công)');
  return summary;
}

/** Resolve repo từ tham số CLI: board_id, repo_path, hoặc (trống) repo mặc định. */
function resolveTarget(arg?: string): { repoPath: string; docsPath: string } {
  if (!arg) { const d = RepoRegistry.defaultRepo(); return { repoPath: d.repoPath, docsPath: d.docsPath }; }
  const cfg = RepoConfigRepository.getByBoard(arg) ?? RepoConfigRepository.list().find(c => c.repo_path === arg);
  if (cfg) return { repoPath: cfg.repo_path, docsPath: cfg.docs_path?.trim() || join(cfg.repo_path, 'docs') };
  return { repoPath: arg, docsPath: config.PROJECT_DOCS_PATH?.trim() || join(arg, 'docs') };  // coi arg là repo_path
}

// Chạy như script (không chạy khi được import bởi admin route).
const isCli = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/gen-docs.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/gen-docs.js');
if (isCli) {
  const rawArgs = process.argv.slice(2);
  const full = rawArgs.includes('--full');
  const target = rawArgs.find(a => !a.startsWith('--'));
  const { repoPath, docsPath } = resolveTarget(target);
  console.log(`\n📚 gen-docs (${full ? 'FULL' : 'auto'}): ${repoPath} → ${docsPath}\n`);
  generateDocs(repoPath, docsPath, { full })
    .then(summary => { console.log('\n--- Tóm tắt ---\n' + (summary || '(agent không in tóm tắt)')); console.log(`\n✅ Xong. Kiểm tra ${docsPath} rồi commit (kể cả ${SYNC_FILE}).`); })
    .catch(err => { console.error('gen-docs lỗi:', err); process.exit(1); });
}
