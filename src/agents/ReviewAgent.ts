import { randomUUID } from 'crypto';
import { join, relative } from 'path';
import { LlmClient } from '../claude/LlmClient.js';
import { PromptBuilder } from '../claude/PromptBuilder.js';
import { GitClient } from '../git/GitClient.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { getDb } from '../state/db.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { ProjectDocs } from './ProjectDocs.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { ReviewResponse, TestCase } from '../claude/types.js';

const log = childLogger('review-agent');

/** Lấy integration branch (base_branch) nếu task là card con của epic, ngược lại null. */
function parseChildBase(metadata: string | null): string | null {
  if (!metadata) return null;
  try {
    const m = JSON.parse(metadata) as { epic_card_id?: string; base_branch?: string };
    return m.epic_card_id && m.base_branch ? m.base_branch : null;
  } catch {
    return null;
  }
}

/** Trích "Ghi chú Dev" (cách đã làm & hướng test) từ mô tả card. Bỏ nếu trống/chỉ còn placeholder. */
function extractDevNote(desc: string | null | undefined): string {
  const d = (desc ?? '').replace(/\r/g, '');
  const m = d.match(/##\s*🛠️?\s*Ghi chú Dev[^\n]*\n([\s\S]*?)(?=\n##\s|\n---|$)/i);
  if (!m) return '';
  const body = m[1].split('\n').filter(l => !/^\s*_\(.*\)_\s*$/.test(l)).join('\n').trim();
  return body;
}

/** Dev có thể ghi chú bằng COMMENT bắt đầu bằng: `DEV:`, `[DEV]`, `Ghi chú Dev:`, `Hướng test:`. */
const DEV_COMMENT_RE = /^\s*(?:\[?\s*dev\s*\]?|dev note|ghi chú dev|hướng test)\s*[:\-]\s*/i;
function extractDevNoteFromComments(comments: Array<{ text: string }>): string {
  return comments
    .map(c => (c.text ?? '').replace(/\r/g, '').trim())
    .filter(t => DEV_COMMENT_RE.test(t))
    .map(t => t.replace(DEV_COMMENT_RE, '').trim())
    .filter(Boolean)
    .join('\n');
}

function testCasesBlock(testCases: TestCase[]): string {
  if (!testCases.length) return '';
  const lines = testCases
    .map((t, i) => `${i + 1}. **${t.name}** — ${t.description}\n   - Kết quả mong đợi: ${t.expected}`)
    .join('\n');
  return `\n## Trường hợp kiểm thử cần kiểm chứng\n${lines}\n`;
}

function devNoteBlock(devNote: string): string {
  if (!devNote.trim()) return '';
  return `\n## 📌 Ghi chú từ Dev — cách đã làm & hướng test (ƯU TIÊN CAO)
${devNote}

Dev đã giải thích cách hiện thực + luồng muốn tester kiểm. Hãy **test THEO hướng này**. Nếu cách dev làm
khác spec mà đạt mục tiêu → HỢP LỆ. Nếu ghi chú này mâu thuẫn với spec → ưu tiên ghi chú Dev cho phần
"cách làm", còn mục tiêu vẫn theo 🎯/✅; phân vân thì NEEDS_INFO.\n`;
}

function buildReviewPrompt(
  diff: string,
  taskDescription: string,
  acceptanceCriteria: string[],
  testCases: TestCase[],
  devNote: string,
  docsGuidance: string,
  repoForContext: string,
): string {
  const base = PromptBuilder.reviewer(diff, taskDescription, acceptanceCriteria, config.MODEL_TEST, repoForContext)
    .replace(/\nRespond via.*$/s, '');

  return `${base}
${devNoteBlock(devNote)}${testCasesBlock(testCases)}
## Làm NHANH & TIẾT KIỆM — đọc DOCS trước, đừng dò lan man
${docsGuidance}
- ĐỌC tài liệu dự án (docs) để định hướng NHANH (luồng nào, file nào) TRƯỚC khi grep. Docs là tri thức đã
  có sẵn — TÁI DÙNG để khỏi dò lại từ đầu mỗi lần test.
- Chỉ đào sâu code ở phần **liên quan trực tiếp** tới thay đổi (diff) + tiêu chí. KHÔNG quét/grep toàn repo.
- Đủ hiểu để kết luận thì **DỪNG NGAY** và xuất JSON. Có giới hạn lượt tool — đừng tìm vô hạn.
- **BẮT BUỘC** kết thúc câu trả lời bằng DUY NHẤT khối JSON kết quả (kể cả khi chưa chắc → \`NEEDS_INFO\`).
  TUYỆT ĐỐI không kết thúc bằng một lượt tool dang dở (sẽ bị coi là thất bại và phải chạy lại tốn kém).

## Vai trò: TESTER / QA độc lập — XÁC MINH, KHÔNG đoán
Bạn đang ở thư mục mã nguồn (cwd) và CÓ tool **Read / Glob / Grep**. Diff ở trên chỉ là điểm bắt đầu —
KHÔNG được kết luận chỉ dựa vào diff. Hãy:
1. **MỞ các file bị sửa + code/cấu hình liên quan** (hàm gọi tới, model/route/template, file config) để HIỂU
   logic thực sự, rồi kiểm chứng từng tiêu chí nghiệm thu & trường hợp kiểm thử có **đúng** không.
2. Cảnh giác: một luồng code có thể "nuốt" lỗi mà vẫn chạy (try/catch rỗng, trả mặc định, điều kiện sai
   vẫn ra kết quả hợp lệ) → đọc kỹ để biết nó xử lý ĐÚNG hay chỉ **che** lỗi.
3. Tìm bug logic, thiếu xử lý null/lỗi, off-by-one, rò rỉ, hardcode, thiếu validate, lộ secret/injection,
   vi phạm convention (CLAUDE.md), và hồi quy (phá vỡ chức năng/giao diện/dữ liệu cũ).

## "Chưa cấu hình" CHƯA chắc là sai
Có những thứ KHÔNG quan sát được từ code tĩnh: giá trị config/biến môi trường thực tế, dữ liệu, hành vi
runtime, hay UI khi chạy. **ĐỪNG** kết luận FAIL chỉ vì "chưa thấy config" hay "chưa thấy chạy thử".

## Chấm theo MỤC TIÊU, KHÔNG theo cách làm đã gợi ý
Ưu tiên **🎯 yêu cầu nghiệp vụ + ✅ tiêu chí nghiệm thu** (kết quả người dùng cần). Phần 🔧 yêu cầu kỹ thuật
nếu mô tả MỘT CÁCH LÀM cụ thể ("uncomment dòng X", "dùng field Y", "sửa hàm Z") chỉ là **gợi ý**, KHÔNG phải
ràng buộc cứng. Dev chọn cách KHÁC (đặt tên field khác, computed field, refactor…) mà **vẫn đạt mục tiêu** →
HỢP LỆ, tuyệt đối đừng bắt lỗi chỉ vì "khác spec". Chỉ khi cách đó làm SAI mục tiêu mới tính là lỗi.
- KHÔNG chắc cách dev chọn có đạt mục tiêu không (vd field computed có thực sự lưu \`store=True\` & hiển thị
  đúng không; phụ thuộc runtime/dữ liệu) → **NEEDS_INFO** + \`checks_needed\` (cần xác nhận/chạy thử gì), KHÔNG FAIL.
- Spec và code LỆCH nhau nhưng cả hai đều có thể đúng → **NEEDS_INFO**: nêu rõ "xác nhận chủ đích: dùng cách
  của spec hay cách dev đã làm; nếu giữ cách dev thì cập nhật lại yêu cầu/tiêu chí cho khớp".
- Ngay cả ✅ tiêu chí nghiệm thu nếu được viết dưới dạng MỘT CÁCH LÀM ("uncomment dòng X") thì hãy đọc ra
  Ý ĐỊNH thật sau nó (kết quả người dùng cần) và chấm theo ý định đó, không bắt bẻ câu chữ.
- **Tie-break:** khi phân vân giữa FAIL và NEEDS_INFO → CHỌN **NEEDS_INFO**. Chỉ FAIL khi CHẮC CHẮN mục tiêu
  không đạt. Mục tiêu suy ra từ **🎯 yêu cầu nghiệp vụ + 📌 yêu cầu gốc** của card (đọc kỹ phần này trước).

## Phán quyết (verdict)
- **PASS**: đã kiểm chứng được code ĐÁP ỨNG đủ tiêu chí nghiệm thu + trường hợp kiểm thử, không còn issue \`error\`.
- **FAIL**: CHỈ khi chứng minh được **MỤC TIÊU không đạt** — chỉ ra vi phạm CỤ THỂ (kèm \`file:line\`) làm sai
  kết quả/hành vi mong đợi. Dev làm khác cách spec gợi ý mà vẫn đạt mục tiêu thì KHÔNG phải FAIL.
- **NEEDS_INFO**: chỉ khi KHÔNG thể suy ra đúng/sai TỪ CODE — kết quả phụ thuộc GIÁ TRỊ config/biến môi trường
  thực, DỮ LIỆU thật trong DB, HỆ THỐNG NGOÀI, hay hành vi runtime mà source không cho biết (KHÔNG phải cứ
  "chạy trên UI" là NEEDS_INFO — nếu code path xác minh được thì vẫn PASS/FAIL).
  Khi đó BẮT BUỘC điền \`checks_needed\`: liệt kê CỤ THỂ cần biết gì / kiểm tra gì TRƯỚC khi sửa, hoặc thao
  tác thủ công nào để xác nhận — ví dụ: "kiểm tra biến môi trường X đã set chưa", "mở màn <Y> nhập <Z> xem
  kết quả", "xác nhận cờ tính năng W bật", "chạy <lệnh> rồi đối chiếu". Tuyệt đối KHÔNG đoán bừa PASS/FAIL.

## Báo cáo cho người đọc (NGẮN GỌN + checklist)
- \`how_tested\`: 1–3 câu **dễ hiểu** mô tả bạn đã test thế nào (đọc file/luồng nào, kiểm chứng ra sao) — viết cho cả người không rành code.
- \`checklist\`: LIỆT KÊ **từng tiêu chí nghiệm thu + từng trường hợp kiểm thử** → mỗi mục
  \`{ "item": "<tên ngắn>", "ok": true/false, "manual": true/false, "note": "..." }\`:
  - Đạt: \`ok:true\`.
  - Lỗi: \`ok:false\` + \`note\` nêu **\`file:dòng\` + cách sửa**.

### Tiêu chí thể hiện trên UI/DB — VẪN chấm qua CODE PATH (đừng đổ hết về NEEDS_INFO)
Phần lớn tiêu chí (lưu dữ liệu, hiển thị, gửi mail, phân quyền…) tuy BIỂU HIỆN ở UI/DB nhưng ĐƯỢC QUYẾT ĐỊNH
bởi code. Hãy **truy vết đường đi của code** thực thi tiêu chí (vd: ô nhập → handler/onchange → ghi field/ORM
\`write\` → field có \`store\`; hay: dữ liệu → template/QWeb → hiển thị):
- Đường đi ĐẦY ĐỦ & ĐÚNG → \`ok:true\` (PASS). Được phép note "(xác minh qua code; nên smoke test nhanh)" nhưng **KHÔNG** hạ NEEDS_INFO.
- Mắt xích SAI/THIẾU → \`ok:false\` + \`file:dòng\` + cách sửa.
- Chỉ đặt \`manual:true\` (và verdict NEEDS_INFO) khi kết quả **KHÔNG do code trong repo quyết định**: phụ thuộc
  GIÁ TRỊ config/biến môi trường thực, DỮ LIỆU thật trong DB, HỆ THỐNG NGOÀI, hay hành vi runtime mà source
  không cho biết. Khi đó \`note\` = thao tác kiểm cụ thể (mở màn/route nào, query bảng/field nào) và đưa vào \`checks_needed\`.
- **ĐỪNG** đánh \`manual\`/NEEDS_INFO chỉ vì "tính năng chạy trên UI" — nếu code path xác minh được thì kết luận PASS/FAIL bình thường.

NGÔN NGỮ: "how_tested", "summary", "description", "suggestion", "checks_needed", "checklist.item/note" bằng TIẾNG VIỆT. Giữ nguyên tên file/biến/hàm/code.

## Required JSON response schema
Kết thúc bằng DUY NHẤT một khối JSON:
\`\`\`json
{
  "verdict": "PASS",
  "how_tested": "ngắn gọn đã test thế nào",
  "checklist": [
    { "item": "tên tiêu chí/trường hợp", "ok": true, "manual": false, "note": "" }
  ],
  "issues": [
    { "file": "path/to/file.ts", "line": 42, "severity": "error|warning|info", "description": "sai chỗ nào", "suggestion": "cách sửa" }
  ],
  "checks_needed": [],
  "conventions_check": true,
  "summary": "tóm tắt 2-3 câu: đã đọc gì, kiểm chứng được gì, vì sao verdict như vậy"
}
\`\`\`
verdict PHẢI là "PASS" | "FAIL" | "NEEDS_INFO". issues rỗng = không tìm thấy vấn đề. checks_needed chỉ điền khi NEEDS_INFO.`;
}

export const ReviewAgent = {
  /** Review worktree do chính agent tạo (luồng Dev → Test): diff worktree vs base; đọc code trong worktree để xác minh. */
  async review(task: Task, acceptanceCriteria: string[] = [], testCases: TestCase[] = [], attempt: number = 1): Promise<ReviewResponse> {
    log.info({ taskId: task.id, branch: task.branch_name, attempt }, 'ReviewAgent starting (worktree)');

    const worktreePath = task.worktree_path!;
    // Base để so diff: card con epic review vs integration branch (epic/<short>); còn lại vs base của repo.
    let baseBranch = RepoConfigRepository.getById(task.repo_key ?? '')?.base_branch ?? config.GIT_DEFAULT_BASE_BRANCH;
    const childMeta = parseChildBase(task.metadata);
    if (childMeta) baseBranch = childMeta;

    let diff: string;
    try {
      diff = await GitClient.getDiff(worktreePath, baseBranch);
    } catch {
      diff = await GitClient.getDiff(worktreePath, 'HEAD~1').catch(() => '(no diff available)');
    }
    // cwd = worktree (đọc đúng code đã thay đổi); context overview + docs lấy từ repo gốc.
    const repoForContext = task.repo_path ?? config.GIT_REPO_PATH;
    const docsGuidance = ProjectDocs.guidance(repoForContext, RepoRegistry.docsPathForTask(task));
    return this.runReviewOnDiff(task, diff, acceptanceCriteria, testCases, attempt, worktreePath, repoForContext, docsGuidance);
  },

  /**
   * Review READ-ONLY theo một biểu thức diff git (vd "origin/dev...origin/staging", "<sha>..origin/x").
   * Caller (StageRouter) tự `fetch` các ref trước. Nếu ref `origin/...` không có → thử ref local.
   * Reviewer đọc code trong repo (cwd = repoPath, nhánh hiện hành) để xác minh, không chỉ đọc diff.
   */
  async reviewExpr(task: Task, repoPath: string, expr: string, acceptanceCriteria: string[] = [], testCases: TestCase[] = [], attempt: number = 1): Promise<ReviewResponse> {
    log.info({ taskId: task.id, expr }, 'ReviewAgent starting (expr mode)');
    // Chuẩn hoá ref: nhánh chỉ có trên remote (vd `NgocLuan2`) → `origin/NgocLuan2` (nếu không diff sẽ lỗi/rỗng).
    const sep = expr.match(/\.{3}|\.{2}/)?.[0] ?? '..';
    const parts = expr.split(/\.{2,3}/).map(s => s.trim()).filter(Boolean);
    let normExpr = expr;
    let targetRef = (parts[parts.length - 1] ?? expr).trim();
    if (parts.length === 2) {
      const [a, b] = await Promise.all([GitClient.resolveRef(repoPath, parts[0]), GitClient.resolveRef(repoPath, parts[1])]);
      normExpr = `${a}${sep}${b}`;
      targetRef = b;
    } else if (parts.length === 1) {
      targetRef = await GitClient.resolveRef(repoPath, parts[0]);
      normExpr = targetRef;
    }

    let diff = '';
    try { diff = await GitClient.getDiffExpr(repoPath, normExpr); } catch { diff = ''; }

    // Diff rỗng (sai dải / chưa push / range không chứa thay đổi) → KHÔNG cần worktree, FAIL "diff rỗng" ngay.
    if (!diff.trim()) {
      const docsGuidance = ProjectDocs.guidance(repoPath, RepoRegistry.docsPathForTask(task));
      return this.runReviewOnDiff(task, diff, acceptanceCriteria, testCases, attempt, repoPath, repoPath, docsGuidance);
    }

    // BẮT ĐÚNG THAY ĐỔI: đọc code TẠI REF ĐÍCH của dải qua worktree tạm detached (không lệ thuộc nhánh đang checkout).
    let reviewCwd = repoPath;
    let tmpWorktree: string | null = null;
    try {
      tmpWorktree = await GitClient.addDetachedWorktree(repoPath, targetRef);
      if (tmpWorktree) reviewCwd = tmpWorktree;
      else log.warn({ taskId: task.id, targetRef }, 'Không tạo được worktree review tại ref — đọc code ở working tree hiện tại (có thể lệch nhánh)');

      // docs theo đường dẫn TƯƠNG ỨNG trong worktree (docs commit ở ref đó); ngoài repo thì giữ tuyệt đối.
      const docsAbs = RepoRegistry.docsPathForTask(task);
      const rel = relative(repoPath, docsAbs);
      const docsForReview = rel && !rel.startsWith('..') ? join(reviewCwd, rel) : docsAbs;
      const docsGuidance = ProjectDocs.guidance(reviewCwd, docsForReview);

      return await this.runReviewOnDiff(task, diff, acceptanceCriteria, testCases, attempt, reviewCwd, repoPath, docsGuidance);
    } finally {
      if (tmpWorktree) await GitClient.removeWorktreePath(repoPath, tmpWorktree).catch(() => {});
    }
  },

  /**
   * Phần chung: diff + tiêu chí + test_cases → reviewer ĐỌC code thật (Read/Glob/Grep tại cwd) bằng MODEL NẶNG
   * (REVIEW_MODEL) → verdict PASS/FAIL/NEEDS_INFO → lưu + comment.
   */
  async runReviewOnDiff(
    task: Task,
    diff: string,
    acceptanceCriteria: string[],
    testCases: TestCase[],
    attempt: number,
    cwd: string,
    repoForContext: string,
    docsGuidance: string = '',
  ): Promise<ReviewResponse> {
    if (!diff || diff.trim().length === 0) {
      const result: ReviewResponse = {
        verdict: 'FAIL',
        issues: [{ file: '', severity: 'error', description: 'Không phát hiện thay đổi nào để review (diff rỗng). Kiểm tra tên nhánh / nhánh đã push chưa.' }],
        conventions_check: false,
        summary: 'No changes to review',
      };
      await this.persistResult(task.id, undefined, attempt, result);
      await this.postReviewComment(task, result);
      return result;
    }

    const card = await TrelloClient.getCard(task.card_id);
    const taskDescription = `${card.name}\n\n${card.desc}`;
    // Ghi chú Dev: gộp từ mục trong mô tả card + comment có tiền tố (DEV:/Hướng test:…).
    const comments = await TrelloClient.getCardComments(task.card_id).catch(() => [] as Array<{ text: string }>);
    const devNote = [extractDevNote(card.desc), extractDevNoteFromComments(comments)].filter(Boolean).join('\n\n');

    let result: ReviewResponse;
    try {
      result = await LlmClient.runForJson<ReviewResponse>(
        buildReviewPrompt(diff, taskDescription, acceptanceCriteria, testCases, devNote, docsGuidance, repoForContext),
        config.MODEL_TEST,
        {
          // Reviewer ĐỌC code thật để xác minh → bật tool + cwd repo + model nặng + nhiều lượt/timeout rộng.
          allowedTools: ['Read', 'Glob', 'Grep'],
          cwd,
          model: config.REVIEW_MODEL,
          maxTurns: config.REVIEW_MAX_TURNS,
          timeoutMs: config.REVIEW_TIMEOUT_MS,
          label: `review:${task.card_id.slice(0, 6)}`,
        }
      );
    } catch (err) {
      // Không trích được JSON (vd hết lượt) → FAIL mềm, retry được, KHÔNG để task fail cứng.
      log.warn({ taskId: task.id, err: String(err).slice(0, 200) }, 'Review JSON parse failed — soft FAIL');
      const soft: ReviewResponse = {
        verdict: 'FAIL',
        issues: [{ file: '', severity: 'warning', description: 'Reviewer không trả về kết quả hợp lệ (có thể diff quá lớn hoặc hết lượt). Hãy thử review lại (reply RETRY ở Test) hoặc chia nhỏ thay đổi.' }],
        conventions_check: false,
        summary: 'Không nhận được kết quả review hợp lệ từ AI reviewer.',
      };
      await this.persistResult(task.id, undefined, attempt, soft);
      await this.postReviewComment(task, soft);
      return soft;
    }

    await this.persistResult(task.id, undefined, attempt, result);
    await this.postReviewComment(task, result);

    log.info({ taskId: task.id, verdict: result.verdict, issues: result.issues.length }, 'Review complete');
    return result;
  },

  async postReviewComment(task: Task, result: ReviewResponse): Promise<void> {
    const icon = result.verdict === 'PASS' ? '✅' : result.verdict === 'NEEDS_INFO' ? '❓' : '❌';
    // Checklist gọn: ✅ đạt → [x]; ❌ lỗi → [ ] (note kèm file:dòng+cách sửa); ⏳ cần kiểm tay (UI/DB) → [ ] ⏳.
    const checklistLines = (result.checklist ?? [])
      .map(c => {
        const box = c.ok ? 'x' : ' ';
        const tag = c.manual ? ' ⏳' : '';
        return `- [${box}]${tag} ${c.item}${c.note ? ` — ${c.note}` : ''}`;
      })
      .join('\n');
    const checkNeededLines = (result.checks_needed ?? []).map(c => `- ${c}`).join('\n');

    // Fallback nếu LLM không trả checklist (vd diff rỗng / lỗi) → dùng issues cho gọn.
    const issuesFallback = (!checklistLines && result.issues.length)
      ? result.issues.map(i => `- [ ] ${i.file ? `\`${i.file}${i.line ? `:${i.line}` : ''}\`: ` : ''}${i.description}${i.suggestion ? ` → ${i.suggestion}` : ''}`).join('\n')
      : '';

    const comment =
      `${icon} **[AI TEST] ${result.verdict}**` +
      (result.how_tested ? `\n\n**🔎 Hướng test:** ${result.how_tested}` : '') +
      ((checklistLines || issuesFallback) ? `\n\n**Checklist kết quả test:**\n${checklistLines || issuesFallback}` : '') +
      (checkNeededLines ? `\n\n**❓ Cần kiểm tra thêm (UI/DB/runtime):**\n${checkNeededLines}` : '');

    await TrelloClient.addComment(task.card_id, comment);
  },

  async persistResult(taskId: string, subTaskId: string | undefined, attempt: number, result: ReviewResponse): Promise<void> {
    getDb()
      .prepare(`INSERT INTO review_results VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), taskId, subTaskId ?? null, attempt, result.verdict, JSON.stringify(result.issues), result.summary, Date.now());
  },
};
