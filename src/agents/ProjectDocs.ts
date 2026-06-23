import { existsSync } from 'fs';
import { relative } from 'path';

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
      ? ` Cần biết "thứ X (model/component/đăng ký/route) nằm ở FILE nào" → tra \`${rel}/00_CHI_MUC.md\` (chỉ mục) TRƯỚC khi grep/đọc lại repo.`
      : '';
    return `## Tài liệu dự án (nguồn tri thức — ĐỌC trước)\n` +
      `Tài liệu nằm tại \`${rel}/\`. Dùng Read/Glob/Grep: mở \`${rel}/00_TONG_THE.md\` (tổng thể) + ` +
      `\`${rel}/00_BAN_DO_TAI_LIEU.md\` (bản đồ tài liệu), rồi đọc file \`${rel}/<chức-năng>.md\` LIÊN QUAN tới task. ` +
      `Đọc đúng tài liệu cần — không quét tràn lan.${idxNote}`;
  },
};
