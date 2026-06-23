/**
 * Sinh / CẬP NHẬT TÀI LIỆU DỰ ÁN cho repo đích (review code → viết docs/). Tri thức người kiểm soát (commit cùng repo).
 *
 *   npm run gen-docs                      → repo mặc định (.env GIT_REPO_PATH)
 *   npm run gen-docs -- <board_id>        → repo của board đó (cấu hình admin)
 *   npm run gen-docs -- <repo_path>       → repo theo đường dẫn
 *   npm run gen-docs -- <target> --full       → ép sinh lại TOÀN BỘ (bỏ qua incremental)
 *   npm run gen-docs -- <target> --continue   → GIỮ file đã có, chỉ viết THÊM doc cho chức năng còn thiếu
 *
 * MẶC ĐỊNH incremental: đã có docs + mốc commit cũ → chỉ đọc commit MỚI kể từ lần trước và cập nhật đúng
 * doc bị ảnh hưởng (tiết kiệm token/thời gian). Lần đầu (chưa có mốc) → sinh đầy đủ. Chỉ chạy KHI được yêu cầu.
 * Agent có quyền GHI FILE trong docs/; người review rồi commit.
 */
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { LlmClient } from '../claude/LlmClient.js';
import { GitClient } from '../git/GitClient.js';
import { IndexAgent } from '../agents/IndexAgent.js';
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

/** TỰ SINH 00_BAN_DO_TAI_LIEU.md (liệt kê feature doc + tiêu đề H1) — KHÔNG LLM, để agent khỏi đọc/sửa lặp file này. */
function writeDocMap(docsPath: string): void {
  try {
    const files = readdirSync(docsPath).filter(f => f.endsWith('.md') && !f.startsWith('00_')).sort();
    const rows = files.map(f => {
      let title = '';
      try { title = (readFileSync(join(docsPath, f), 'utf8').split('\n').find(l => /^#\s+/.test(l)) ?? '').replace(/^#\s+/, '').trim(); } catch { /* bỏ qua */ }
      return `| [${f}](${f}) | ${title || '—'} |`;
    });
    const md = `# Bản đồ tài liệu (TỰ SINH — không sửa tay)\n\n` +
      `> Tổng thể: \`00_TONG_THE.md\` · Chỉ mục ký hiệu→file: \`00_CHI_MUC.md\`.\n\n` +
      `| Tài liệu | Nội dung |\n|---|---|\n${rows.join('\n') || '| (chưa có) | |'}\n`;
    writeFileSync(join(docsPath, '00_BAN_DO_TAI_LIEU.md'), md, 'utf8');
  } catch (err) { log.warn({ err: (err as Error).message }, 'Không sinh được 00_BAN_DO_TAI_LIEU.md'); }
}
/** Prompt sinh ĐẦY ĐỦ bộ tài liệu CHI TIẾT (thay cho việc đọc cả repo): tổng thể / từng chức năng / bản đồ. */
function fullPrompt(docsRel: string): string {
  return `Bạn là **CHUYÊN GIA PHÂN TÍCH NGHIỆP VỤ kiêm KIẾN TRÚC SƯ phần mềm**. Khảo sát KỸ toàn bộ mã nguồn tại
thư mục làm việc và viết bộ TÀI LIỆU DỰ ÁN dùng để **THAY cho việc đọc lại toàn bộ repo** — người/agent sau chỉ
cần đọc docs là đủ hiểu để làm rõ yêu cầu, lập kế hoạch và REVIEW code.

## Nguyên tắc
- **PHỦ HẾT trước, sâu sau (QUAN TRỌNG):** đảm bảo MỌI chức năng/màn hình/loại báo cáo đều CÓ doc — KHÔNG để
  sót. Đầu phiên hãy LẬP DANH SÁCH đầy đủ các chức năng rồi viết lần lượt. Nếu sắp hết lượt tool → ưu tiên
  **tạo đủ file (mỗi cái phần CỐT LÕI)** thay vì làm 1 file thật sâu rồi bỏ sót cái khác.
- **NGHIÊNG NGHIỆP VỤ (BA), ÍT CODE:** docs để HIỂU nghiệp vụ + luồng + dữ liệu (ngôn ngữ nghiệp vụ). Con trỏ
  code chỉ ghi ĐƯỜNG DẪN FILE (vd \`models/x.py\`), **KHÔNG chép đoạn code** vào docs — Dev/Review vẫn đọc code
  gốc, chép vào đây chỉ tốn token thừa. GIỮ phần giá trị cao (nghiệp vụ, luồng, dữ liệu, business rule); BỎ lời
  mở/bối cảnh lan man + edge-case suy đoán.
- **Đã có CHỈ MỤC \`00_CHI_MUC.md\`** (sinh bằng grep: cây file + model + đăng ký component + template_name +
  route). TRA nó để biết "thứ X nằm ở file nào" thay vì grep/đọc lại; **KHÔNG chép các bảng đó** vào docs nghiệp vụ.
- **TỐI ĐA 1 SƠ ĐỒ Mermaid mỗi file** — chọn loại trực quan & NHIỀU THÔNG TIN nhất (thường \`flowchart\` luồng
  xử lý; 00_TONG_THE có thể \`mindmap\` tổng thể). KHÔNG vẽ nhiều sơ đồ.
- Văn phong TIẾNG VIỆT, ngôn ngữ nghiệp vụ dễ hiểu cho cả người không rành code.

## THỨ TỰ LÀM — chống ĐỌC/SỬA TỚI LUI (đây là nguồn tốn token lớn nhất)
1. **LẬP DANH SÁCH TRƯỚC:** từ \`00_CHI_MUC.md\` + quét nhanh → liệt kê ĐẦY ĐỦ chức năng/luồng cần viết (ghi ra notes).
2. **Viết từng feature doc** (mục B) độc lập — KHÔNG đụng file tổng.
3. **Viết \`00_TONG_THE.md\` MỘT LẦN, ở CUỐI**, sau khi đã biết hết. **TUYỆT ĐỐI KHÔNG quay lại sửa
   \`00_TONG_THE.md\` sau mỗi feature** (đó chính là việc đọc/ghi lặp tốn token nhất — đừng làm).
4. **KHÔNG viết/sửa \`00_BAN_DO_TAI_LIEU.md\`** — hệ thống TỰ SINH file này sau khi bạn xong.

## GHI FILE markdown vào \`${docsRel}/\` (tạo nếu chưa có) — chia theo cấu trúc:

### A. \`${docsRel}/00_TONG_THE.md\` — bức tranh toàn hệ
1. Mục đích hệ thống, đối tượng người dùng, phạm vi.
2. Kiến trúc tổng thể + công nghệ (framework, ngôn ngữ, thư viện chính), cách các tầng/màn hình ghép nối.
3. **1 sơ đồ** Mermaid tổng thể (\`mindmap\` hệ thống→module→chức năng, HOẶC \`flowchart\` luồng tổng).
4. Danh mục các CHỨC NĂNG/BÁO CÁO chính + 1 dòng vai trò nghiệp vụ + trỏ tới feature doc tương ứng.
5. Mô hình dữ liệu CỐT LÕI theo NGHIỆP VỤ (model chính + ý nghĩa + quan hệ) — dạng bảng/gạch đầu dòng. Chi tiết
   "component/đăng ký/template_name/model nằm file nào" → đã có ở \`00_CHI_MUC.md\`, KHÔNG lặp lại ở đây.

### B. \`${docsRel}/<tên-chức-năng>.md\` — MỖI chức năng/màn hình/luồng nghiệp vụ MỘT file, CHI TIẾT.
Đặt tên file MÔ TẢ theo chức năng (snake_case, tuỳ dự án — vd \`bao_cao_giam_sat_an_toan.md\`,
\`quan_ly_dashboard.md\`, \`he_thong_gui_mail.md\`). KHÔNG ép nhóm cố định, KHÔNG đặt tên đánh số (\`01_/02_\`).
Mỗi file (NGHIÊNG NGHIỆP VỤ, ít code) gồm:
1. Nghiệp vụ: ai dùng, mục tiêu, người dùng làm được gì & vì sao.
2. **Luồng xử lý** (mô tả nghiệp vụ + **1 sơ đồ** \`flowchart\`): thao tác người dùng → các bước xử lý → dữ
   liệu/kết quả. Nêu mắt xích bằng NGHIỆP VỤ; chỉ ghi tên file/method ở mức con trỏ, KHÔNG chép code.
3. **Dữ liệu & trạng thái**: model/field/quan hệ chính + các trạng thái & chuyển trạng thái (theo nghĩa nghiệp vụ).
4. **Business rule / validation / phân quyền**: điều kiện, ràng buộc, công thức.
5. **Con trỏ code**: vài đường dẫn file/method chính (CHỈ đường dẫn — chi tiết file ở \`00_CHI_MUC.md\`).
6. Lưu ý nghiệp vụ quan trọng (ngắn).

### C. \`${docsRel}/00_BAN_DO_TAI_LIEU.md\` — **BỎ QUA, KHÔNG viết**
Hệ thống TỰ SINH (liệt kê các doc + tiêu đề) sau khi bạn hoàn tất → bạn khỏi đụng tới.

## Ràng buộc
- Chỉ TẠO/SỬA file trong \`${docsRel}/\`. KHÔNG đụng code khác.
- **GIỮ cấu trúc phân file HIỆN CÓ:** nếu thư mục docs đã có file cho một chức năng → viết chi tiết vào ĐÚNG
  file đó (ghi đè/bổ sung), giữ NGUYÊN tên & ranh giới file. TUYỆT ĐỐI không tạo file tên mới/đánh số cho nội
  dung ĐÃ có file (tránh trùng lặp & lỗi thời). Chỉ thêm file MỚI cho chức năng CHƯA có doc.
- Tách hợp lý: chức năng/luồng lớn → file riêng; đừng nhồi tất cả vào 1 file.

Khi xong, in tóm tắt (TIẾNG VIỆT) các file tài liệu đã tạo + 1 dòng mô tả mỗi file.`;
}

/** Prompt CẬP NHẬT incremental: chỉ sửa doc bị ảnh hưởng bởi commit mới (vẫn giữ độ CHI TIẾT + sơ đồ). */
function incrementalPrompt(docsRel: string, sinceShort: string, changedFiles: string[]): string {
  const list = changedFiles.slice(0, 200).map(f => `- ${f}`).join('\n');
  return `Bạn là CHUYÊN GIA PHÂN TÍCH NGHIỆP VỤ kiêm KIẾN TRÚC SƯ. Bộ tài liệu dự án đã có trong \`${docsRel}/\`
(chia: 00_TONG_THE.md, từng chức năng, 00_BAN_DO_TAI_LIEU.md; CHI TIẾT, có sơ đồ Mermaid, có bản đồ thành phần
& đăng ký). CHỈ CẬP NHẬT phần bị ảnh hưởng bởi thay đổi từ commit \`${sinceShort}\` tới HEAD — KHÔNG viết lại toàn bộ.

## Các file mã nguồn đã thay đổi
${list || '(không có)'}

## Yêu cầu
1. Dùng Read/Glob/Grep đọc các file đã đổi + doc liên quan để hiểu thay đổi ảnh hưởng chức năng/luồng nào.
2. CẬP NHẬT ĐÚNG doc bị ảnh hưởng, GIỮ ĐỘ CHI TIẾT cũ (nghiệp vụ, luồng xử lý, dữ liệu, business rule, sơ đồ,
   con trỏ code) và **cập nhật cả SƠ ĐỒ Mermaid + BẢN ĐỒ THÀNH PHẦN/ĐĂNG KÝ** nếu component/luồng/dữ liệu đổi:
   - Chức năng mới → thêm file \`${docsRel}/<chức-năng>.md\` đầy đủ như tài liệu gốc.
   - CHỈ khi kiến trúc/luồng TỔNG đổi mới sửa \`00_TONG_THE.md\` (sửa 1 lần, không đọc/ghi lặp). **KHÔNG đụng
     \`00_BAN_DO_TAI_LIEU.md\`** — hệ thống tự sinh.
3. CHỈ sửa phần liên quan, GIỮ nguyên phần khác. Giữ cấu trúc chia file. Tiếng Việt, giữ nguyên tên file/model/field.
4. Chỉ TẠO/SỬA file trong \`${docsRel}/\`.

Khi xong, in tóm tắt (TIẾNG VIỆT) các doc đã cập nhật + lý do.`;
}

/** Prompt LÀM TIẾP: GIỮ NGUYÊN file đã có, chỉ viết THÊM doc cho chức năng còn thiếu (phủ rộng dần). */
function continuePrompt(docsRel: string, existingFiles: string[]): string {
  const list = existingFiles.map(f => `- ${f}`).join('\n') || '(chưa có file nào)';
  return `Bạn là CHUYÊN GIA PHÂN TÍCH NGHIỆP VỤ kiêm KIẾN TRÚC SƯ. Bộ tài liệu trong \`${docsRel}/\` ĐÃ CÓ sẵn các file:
${list}

## Nhiệm vụ: LÀM TIẾP — bổ sung phần CÒN THIẾU (KHÔNG làm lại phần đã có)
1. Khảo sát repo, đối chiếu với các file trên → tìm các chức năng/màn hình/**loại báo cáo**/luồng nghiệp vụ
   CHƯA có doc (chưa file nào mô tả kỹ).
2. Viết THÊM file cho TỪNG cái còn thiếu — GIỮ phần GIÁ TRỊ CAO: nghiệp vụ; luồng xử lý (\`sequenceDiagram\`/
   \`flowchart\`, **1 sơ đồ/feature là đủ**); dữ liệu/model/status; business rule/validation; thành phần UI +
   nơi đăng ký; con trỏ code. LƯỢC lời mở/bối cảnh lan man + edge-case suy đoán.
3. **PHỦ HẾT phần còn thiếu:** liệt kê đầy đủ chức năng chưa có doc rồi viết lần lượt; sắp hết lượt thì ưu tiên
   TẠO ĐỦ file (mỗi cái phần cốt lõi) hơn là làm sâu 1 file rồi bỏ sót cái khác.

## QUY TẮC GIỮ FILE CŨ (BẮT BUỘC)
- TUYỆT ĐỐI **KHÔNG sửa/ghi đè** nội dung các file FEATURE đã liệt kê ở trên. CHỈ TẠO file MỚI cho phần thiếu.
- **KHÔNG đụng \`00_BAN_DO_TAI_LIEU.md\`** (hệ thống tự sinh). Chỉ khi cần mới bổ sung tên chức năng mới vào
  danh mục \`00_TONG_THE.md\` (sửa 1 lần, đừng đọc/ghi lặp).
- Đặt tên file MÔ TẢ theo chức năng (snake_case, tuỳ dự án). KHÔNG đánh số \`01_/02_\`.
- Chỉ TẠO/SỬA trong \`${docsRel}/\`.

Khi xong, in tóm tắt (TIẾNG VIỆT) các file MỚI đã tạo + 1 dòng mô tả mỗi file.`;
}

/** Sinh/cập nhật docs vào `docsPath` của repo `repoPath`. Trả tóm tắt. */
export async function generateDocs(repoPath: string, docsPath: string, opts?: { full?: boolean; continue?: boolean }): Promise<string> {
  if (!existsSync(docsPath)) mkdirSync(docsPath, { recursive: true });
  const docsRel = relative(repoPath, docsPath).replace(/\\/g, '/') || 'docs';

  // Quyết định FULL vs INCREMENTAL: cần là git repo + có mốc cũ + có docs sẵn + không ép --full.
  const head = await GitClient.revParse(repoPath, 'HEAD');
  const last = readSync(docsPath).last_commit;
  const hasDocs = existsSync(join(docsPath, '00_TONG_THE.md'));
  let mode: 'full' | 'incremental' | 'continue' = 'full';
  let prompt = fullPrompt(docsRel);

  if (opts?.continue && !opts?.full) {
    // LÀM TIẾP: giữ file đã có, chỉ bổ sung phần thiếu.
    mode = 'continue';
    const existing = existsSync(docsPath) ? readdirSync(docsPath).filter(f => f.endsWith('.md')).sort() : [];
    prompt = continuePrompt(docsRel, existing);
  } else if (!opts?.full && head && last && last !== head && hasDocs) {
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

  // CHỈ MỤC tĩnh (grep, gần như miễn phí token) — dựng/làm mới trước để agent TRA thay vì grep lại.
  await IndexAgent.build(repoPath, join(docsPath, '00_CHI_MUC.md')).catch(err =>
    log.warn({ err: (err as Error).message }, 'Không dựng được chỉ mục (bỏ qua)'));

  log.info({ repoPath, docsPath, mode, last: last?.slice(0, 8), head: head?.slice(0, 8) }, 'gen-docs: bắt đầu');
  const summary = await LlmClient.run(prompt, config.MODEL_INDEXER, {
    allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    cwd: repoPath,
    model: config.CLAUDE_MODEL,             // Sonnet (mặc định) — task đọc/ghi nặng, không cần model đắt
    timeoutMs: config.GEN_DOCS_TIMEOUT_MS,
    maxTurns: config.GEN_DOCS_MAX_TURNS,   // đủ lượt để ĐỌC repo + GHI nhiều file docs (CLI mặc định 8 là quá ít)
    label: `gendocs:${docsRel}`,
  });
  writeDocMap(docsPath);                // TỰ SINH bản đồ tài liệu (agent khỏi đọc/sửa lặp file này)
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
  const cont = rawArgs.includes('--continue');
  const target = rawArgs.find(a => !a.startsWith('--'));
  const { repoPath, docsPath } = resolveTarget(target);
  console.log(`\n📚 gen-docs (${full ? 'FULL' : cont ? 'CONTINUE' : 'auto'}): ${repoPath} → ${docsPath}\n`);
  generateDocs(repoPath, docsPath, { full, continue: cont })
    .then(summary => { console.log('\n--- Tóm tắt ---\n' + (summary || '(agent không in tóm tắt)')); console.log(`\n✅ Xong. Kiểm tra ${docsPath} rồi commit (kể cả ${SYNC_FILE}).`); })
    .catch(err => { console.error('gen-docs lỗi:', err); process.exit(1); });
}
