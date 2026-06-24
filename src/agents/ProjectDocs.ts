import { existsSync, readFileSync } from 'fs';
import { relative, join } from 'path';

/**
 * Tri thức dự án = TÀI LIỆU THẬT trong repo (do người kiểm soát, commit cùng code) tại `docsPath`
 * (mặc định <repo>/docs). Sinh ban đầu bằng `npm run gen-docs` / nút "Generate docs" ở admin.
 *
 * Agent đọc trực tiếp bằng Read/Glob/Grep (docs nằm trong cwd=repo) — không cần cache ngoài.
 */
export const ProjectDocs = {
  /** Thư mục docs có tồn tại không (để BA đặt cờ docs_missing). */
  exists(docsPath: string): boolean {
    return existsSync(docsPath);
  },

  /**
   * NỘI DUNG Sổ luật framework (`<docsPath>/00_FRAMEWORK_RULES.md`) để **nhồi THẲNG vào prompt** — đảm bảo
   * agent CÓ tri thức trong ngữ cảnh, không phụ thuộc việc agent có chịu Read hay file có trong worktree.
   * @param docsPath docs của repo CHÍNH (luôn có trên đĩa sau khi sinh) — KHÔNG truyền docs worktree tạm.
   * Trả '' nếu chưa có (vd lần chạy đầu — Sổ luật đang sinh nền).
   */
  frameworkRules(docsPath: string, maxChars = 9000): string {
    try {
      const p = join(docsPath, '00_FRAMEWORK_RULES.md');
      if (!existsSync(p)) return '';
      let body = readFileSync(p, 'utf8').trim();
      if (!body) return '';
      if (body.length > maxChars) body = body.slice(0, maxChars) + '\n…(Sổ luật còn dài — đọc file đầy đủ nếu cần)';
      return `## SỔ LUẬT FRAMEWORK — ĐỌC & ÁP DỤNG (tri thức bắt buộc)\n` +
        `Luật vận hành của framework dự án (cách resolve/định tuyến qua dữ liệu/đăng ký, định nghĩa dùng chung, ` +
        `ngữ nghĩa ORM…). **Áp dụng khi kết luận — đừng tự suy mò mối nối gián tiếp.**\n\n${body}\n\n---\n`;
    } catch { return ''; }
  },

  /**
   * Khối hướng dẫn chèn vào prompt: chỉ cho agent biết docs ở đâu + đọc thế nào (tự đọc khi cần).
   * @param repoPath repo (để tính đường dẫn tương đối, cwd của agent = repoPath)
   * @param docsPath  thư mục tài liệu
   */
  guidance(repoPath: string, docsPath: string): string {
    const rel = relative(repoPath, docsPath).replace(/\\/g, '/') || 'docs';
    if (!this.exists(docsPath)) {
      // Chưa có docs → fallback ĐỌC TRỰC TIẾP MÃ NGUỒN (ground truth), không dùng cache tự sinh.
      return `## Tài liệu dự án\n⚠️ Dự án CHƯA có thư mục tài liệu (\`${rel}/\`). Hãy **đọc trực tiếp MÃ NGUỒN** ` +
        `(Read/Glob/Grep) để hiểu hệ thống, kết hợp nội dung card. Đặt \`docs_missing: true\` và đề xuất ` +
        `chạy \`npm run gen-docs\` (hoặc nút "Generate docs" ở admin) để có tài liệu chính xác cho lần sau.`;
    }
    const idxNote = existsSync(`${docsPath}/00_CHI_MUC.md`)
      ? ` Cần biết "thứ X (model/component/đăng ký/route) nằm ở FILE nào" → tra \`${rel}/00_CHI_MUC.md\` (chỉ mục + **Bản đồ resolve** data-driven wiring) TRƯỚC khi grep/đọc lại repo.`
      : '';
    // Sổ luật framework: tri thức LUẬT vận hành (cách resolve/định tuyến, định nghĩa dùng chung, ngữ nghĩa
    // ORM…) — đọc để KHÔNG hiểu sai mối nối gián tiếp (nguồn sai số của review tĩnh).
    const rulesNote = existsSync(`${docsPath}/00_FRAMEWORK_RULES.md`)
      ? ` **BẮT BUỘC đọc \`${rel}/00_FRAMEWORK_RULES.md\` (Sổ luật framework)** để hiểu cách framework chọn ` +
        `hành vi/giao diện qua DỮ LIỆU/đăng ký/quy ước — đừng tìm "code viết riêng cho từng màn"; lần đúng ` +
        `chuỗi resolve trong sổ luật + Bản đồ resolve ở chỉ mục.`
      : '';
    return `## Tài liệu dự án (nguồn tri thức — ĐỌC trước)\n` +
      `Tài liệu nằm tại \`${rel}/\`. Dùng Read/Glob/Grep: mở \`${rel}/00_TONG_THE.md\` (tổng thể) + ` +
      `\`${rel}/00_BAN_DO_TAI_LIEU.md\` (bản đồ tài liệu), rồi đọc file \`${rel}/<chức-năng>.md\` LIÊN QUAN tới task. ` +
      `Đọc đúng tài liệu cần — không quét tràn lan.${idxNote}${rulesNote}`;
  },
};
