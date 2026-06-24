/**
 * Sinh SỔ LUẬT FRAMEWORK (`<docs>/00_FRAMEWORK_RULES.md`) cho repo đích — tri thức để **ReviewAgent test ĐÚNG**.
 *
 *   npm run gen-rules                  → repo mặc định (.env GIT_REPO_PATH)
 *   npm run gen-rules -- <board_id>    → repo của board đó (cấu hình admin)
 *   npm run gen-rules -- <repo_path>   → repo theo đường dẫn
 *
 * KHÁC gen-docs: gen-docs mô tả CHỨC NĂNG nghiệp vụ; file này đúc kết **LUẬT VẬN HÀNH** của framework mà một
 * người review code TĨNH dễ hiểu sai — cách hành vi được "wire"/định tuyến qua DỮ LIỆU/đăng ký/quy ước
 * (vd Odoo: item.type_id → template_name → registry component), hệ quả của định nghĩa DÙNG CHUNG, ngữ nghĩa
 * ORM/vòng đời, và "công thức kiểm chứng" cho từng loại tính năng. Agent NGHIÊN CỨU repo rồi GHI file — KHÔNG
 * hardcode 1 loại framework: nó tự khám phá framework repo đang dùng. Người review + commit.
 *
 * Mục `## Ghi chú người duyệt` (nếu có) sẽ được GIỮ NGUYÊN khi chạy lại (curation của người không bị ghi đè).
 */
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { LlmClient } from '../claude/LlmClient.js';
import { IndexAgent } from '../agents/IndexAgent.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('gen-rules');

const RULES_FILE = '00_FRAMEWORK_RULES.md';
const CURATED_HEADING = '## Ghi chú người duyệt';

/** Trích phần curation của người (từ `## Ghi chú người duyệt` tới hết file) để chèn lại — chạy lại không mất. */
function extractCurated(docsPath: string): string {
  try {
    const cur = readFileSync(join(docsPath, RULES_FILE), 'utf8');
    const i = cur.indexOf(CURATED_HEADING);
    return i >= 0 ? cur.slice(i).trim() : '';
  } catch { return ''; }
}

function rulesPrompt(docsRel: string, curated: string): string {
  return `Bạn là **KỸ SƯ REVERSE-ENGINEER framework**. Mục tiêu: viết **SỔ LUẬT** để một **người REVIEW/TEST code**
chỉ cần đọc file này là HIỂU framework của dự án vận hành thế nào, nhờ đó kết luận PASS/FAIL **chính xác** —
KHÔNG bị bẫy bởi các mối nối gián tiếp. Đây KHÔNG phải tài liệu chức năng nghiệp vụ (đã có file khác lo).

## Tự khám phá — KHÔNG giả định 1 loại framework
Dự án có thể dùng Odoo, Django, React, NestJS… **Tự nhận diện** framework + các quy ước RIÊNG của dự án rồi
viết luật theo đúng cái repo này dùng. Tra \`${docsRel}/00_CHI_MUC.md\` (chỉ mục + bản đồ wiring nếu có) để
định vị nhanh, rồi Read/Grep xác minh ở mã nguồn THẬT. **Mọi luật phải kèm dẫn chứng \`file:dòng\`.**

## TRỌNG TÂM: những thứ người đọc code TĨNH hay HIỂU SAI (giá trị cao nhất)
1. **Cơ chế ĐỊNH TUYẾN / RESOLVE theo dữ liệu hoặc đăng ký** (nguồn sai số 1): hành vi/giao diện KHÔNG nằm ở
   if/else trong code mà được chọn qua DỮ LIỆU/CẤU HÌNH/REGISTRY/quy ước đặt tên/dynamic dispatch. Với MỖI cơ
   chế, ghi **CHUỖI RESOLVE ĐẦY ĐỦ** + cách "tra ngược": "muốn biết <thực thể> dùng <thành phần> nào → đi
   <bước1> → <bước2> → …". (Ví dụ mẫu của 1 dự án Odoo: \`record item → type_id → (item.type).template_name →
   registry.category('report_item').get(template_name) → component JS\`; người review hay sai vì đi tìm "code
   viết riêng cho từng màn", trong khi nó resolve qua data.)
2. **Hệ quả của định nghĩa DÙNG CHUNG**: base class / mixin / item_type / template / component được NHIỀU nơi
   tái dùng ⇒ sửa 1 chỗ là đổi cho TẤT CẢ nơi dùng. Liệt kê các điểm dùng-chung quan trọng + bán kính ảnh hưởng.
3. **Ngữ nghĩa framework/ORM dễ sai khi suy tĩnh**: vòng đời record (create/write/unlink, cascade/ondelete),
   recordset vs bản ghi đơn, computed/related/store, onchange, transaction/rollback, kế thừa & override, đăng
   ký route/controller. Nêu cái nào quyết định hành vi mà nhìn 1 hàm KHÔNG thấy hết.
4. **Quy ước dự án**: state/workflow trạng thái, sequence/đánh số, gửi mail (ai nhận, build danh sách thế nào),
   phân quyền, đặt tên file/biến. Ghi gọn + dẫn chứng.

## CÔNG THỨC KIỂM CHỨNG (rất quan trọng cho reviewer)
Cuối mỗi nhóm luật, thêm **"Cách kiểm chứng"**: các bước CỤ THỂ để xác nhận một tính năng có/đúng — vd
"để xác nhận report X có tính năng Y: lần <chuỗi resolve>; nếu mắt xích cuối là <component/hàm> có <đặc điểm>
thì CÓ". Viết sao cho reviewer áp dụng máy móc được, không phải đoán.

## Ghi file
- Ghi DUY NHẤT \`${docsRel}/${RULES_FILE}\` (tạo nếu chưa có). KHÔNG đụng file khác, KHÔNG sửa mã nguồn.
- Văn phong: NGẮN, dạng luật/checklist, tiếng Việt; mỗi luật 1 dòng dẫn chứng \`file:dòng\`. KHÔNG chép khối code dài.
- Cấu trúc gợi ý: \`# Sổ luật Framework\` → \`## 1. Cơ chế resolve/định tuyến\` → \`## 2. Định nghĩa dùng chung\`
  → \`## 3. Ngữ nghĩa ORM/vòng đời\` → \`## 4. Quy ước dự án\` → \`## 5. Công thức kiểm chứng cho reviewer\`.
${curated ? `- **BẮT BUỘC GIỮ NGUYÊN** nguyên văn khối sau ở CUỐI file (curation của người — không sửa, không lược):\n\n${curated}\n` : `- Để sẵn ở cuối file một mục trống \`${CURATED_HEADING}\`\n_(người duyệt bổ sung luật thủ công ở đây; lần chạy lại sẽ được giữ nguyên)_`}

Khi xong, in tóm tắt (TIẾNG VIỆT): đã ghi bao nhiêu luật, nhóm nào, framework nhận diện là gì.`;
}

/** Sinh/cập nhật 00_FRAMEWORK_RULES.md vào `docsPath` của repo `repoPath`. Trả tóm tắt. */
export async function generateFrameworkRules(repoPath: string, docsPath: string): Promise<string> {
  if (!existsSync(docsPath)) mkdirSync(docsPath, { recursive: true });
  const docsRel = relative(repoPath, docsPath).replace(/\\/g, '/') || 'docs';

  // CHỈ MỤC tĩnh (grep + bản đồ wiring) trước — agent TRA thay vì tự lần (giảm sai số + token).
  await IndexAgent.build(repoPath, join(docsPath, '00_CHI_MUC.md')).catch(err =>
    log.warn({ err: (err as Error).message }, 'Không dựng được chỉ mục (bỏ qua)'));

  const curated = extractCurated(docsPath);
  log.info({ repoPath, docsPath, hasCurated: !!curated }, 'gen-rules: bắt đầu');
  const summary = await LlmClient.run(rulesPrompt(docsRel, curated), config.MODEL_INDEXER, {
    allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    cwd: repoPath,
    model: config.DOCS_MODEL,             // khâu phân tích sâu → model nặng (Opus mặc định)
    timeoutMs: config.GEN_DOCS_TIMEOUT_MS,
    maxTurns: config.GEN_DOCS_MAX_TURNS,
    label: `genrules:${docsRel}`,
  });
  log.info({ repoPath, docsPath }, 'gen-rules: xong (review + commit thủ công)');
  return summary;
}

/** Resolve repo từ tham số CLI: board_id, repo_path, hoặc (trống) repo mặc định. */
function resolveTarget(arg?: string): { repoPath: string; docsPath: string } {
  if (!arg) { const d = RepoRegistry.defaultRepo(); return { repoPath: d.repoPath, docsPath: d.docsPath }; }
  const cfg = RepoConfigRepository.getByBoard(arg) ?? RepoConfigRepository.list().find(c => c.repo_path === arg);
  if (cfg) return { repoPath: cfg.repo_path, docsPath: cfg.docs_path?.trim() || join(cfg.repo_path, 'docs') };
  return { repoPath: arg, docsPath: config.PROJECT_DOCS_PATH?.trim() || join(arg, 'docs') };
}

// Chạy như script (không chạy khi import bởi admin route).
const isCli = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/gen-framework-rules.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/gen-framework-rules.js');
if (isCli) {
  const target = process.argv.slice(2).find(a => !a.startsWith('--'));
  const { repoPath, docsPath } = resolveTarget(target);
  console.log(`\n📐 gen-framework-rules: ${repoPath} → ${docsPath}/${RULES_FILE}\n`);
  generateFrameworkRules(repoPath, docsPath)
    .then(summary => { console.log('\n--- Tóm tắt ---\n' + (summary || '(agent không in tóm tắt)')); console.log(`\n✅ Xong. Kiểm tra ${docsPath}/${RULES_FILE} rồi commit.`); })
    .catch(err => { console.error('gen-rules lỗi:', err); process.exit(1); });
}
