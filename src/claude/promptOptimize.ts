/**
 * Lược bỏ các khối quy ước nặng (CLAUDE.md, 00_TONG_THE.md) khỏi message đầu khi GỬI LẠI ở
 * các lượt sau (Turn 1+) để tiết kiệm token. Cắt theo SENTINEL do PromptBuilder chèn — chính xác
 * kể cả khi nội dung tự chứa heading "##", và là no-op nếu prompt không có sentinel.
 *
 * Tách riêng (pure, không phụ thuộc config) để test được mà không cần nạp .env.
 */
export function optimizeFirstMessage(content: string): string {
  if (typeof content !== 'string') return content;
  return content
    .replace(
      /<!--AUTOPILOT_CONV_START-->[\s\S]*?<!--AUTOPILOT_CONV_END-->/g,
      '## Project Conventions (đã lược bỏ — đã gửi đầy đủ ở lượt đầu để tiết kiệm token)'
    )
    .replace(
      /<!--AUTOPILOT_OVERVIEW_START-->[\s\S]*?<!--AUTOPILOT_OVERVIEW_END-->/g,
      '## Project Overview (đã lược bỏ — đã gửi đầy đủ ở lượt đầu để tiết kiệm token)'
    );
}
