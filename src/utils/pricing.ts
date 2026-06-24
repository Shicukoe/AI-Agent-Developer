/**
 * Bảng GIÁ THAM CHIẾU (pay-as-you-go) theo model — USD trên 1 TRIỆU token.
 *
 * ⚠️ Đây là GIÁ API quy đổi (list price). Nếu chạy Claude bằng GÓI THUÊ BAO (Pro/Max qua CLI), bạn KHÔNG
 *    trả theo USD này — gói tính bằng % cửa sổ trượt. Con số $ ở đây chỉ để ƯỚC LƯỢNG/so sánh tương đối,
 *    KHÔNG phải số tiền thực trên hoá đơn gói. (Nhánh CLI dùng thẳng total_cost_usd của CLI, không qua bảng này.)
 *
 * Khớp theo "họ" model (tiền tố/keyword) để bền với hậu tố ngày tháng của model-id.
 */
export interface ModelPrice {
  /** Input chưa cache (USD / 1M token). */
  input: number;
  /** Output (USD / 1M token). */
  output: number;
  /** Ghi cache — cache write/creation (USD / 1M token). Mặc định = input nếu không khai. */
  cacheWrite?: number;
  /** Đọc cache — cache read/hit (USD / 1M token). Mặc định = input nếu không khai. */
  cacheRead?: number;
}

/** Khớp theo thứ tự: regex đầu tiên trúng model-id sẽ áp giá. Cụ thể hơn để TRƯỚC. */
const TABLE: Array<{ match: RegExp; price: ModelPrice; family: string }> = [
  // ── Anthropic Claude ──
  { family: 'claude-opus',   match: /claude.*opus|^opus/i,     price: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 } },
  { family: 'claude-sonnet', match: /claude.*sonnet|^sonnet/i, price: { input: 3,  output: 15, cacheWrite: 3.75,  cacheRead: 0.3 } },
  { family: 'claude-haiku',  match: /claude.*haiku|^haiku/i,   price: { input: 0.8, output: 4, cacheWrite: 1,     cacheRead: 0.08 } },
  // ── Google Gemini ──
  { family: 'gemini-flash',  match: /gemini.*flash/i, price: { input: 0.1,  output: 0.4 } },
  { family: 'gemini-pro',    match: /gemini.*pro/i,   price: { input: 1.25, output: 5 } },
  // ── OpenAI ──
  { family: 'gpt-4o-mini',   match: /gpt-4o-mini|o\d-mini/i, price: { input: 0.15, output: 0.6 } },
  { family: 'gpt-4o',        match: /gpt-4o|gpt-4\.1/i,       price: { input: 2.5,  output: 10 } },
  { family: 'gpt',           match: /^gpt|^o\d|chatgpt/i,     price: { input: 2.5,  output: 10 } },
];

/** Tìm bảng giá cho 1 model-id. Trả null nếu không nhận ra (→ caller coi cost = 0, vẫn đếm token). */
export function priceFor(model?: string): ModelPrice | null {
  if (!model) return null;
  for (const row of TABLE) if (row.match.test(model)) return row.price;
  return null;
}

export interface TokenBreakdown {
  /** Tổng token phía input (ĐÃ gồm cache). */
  input: number;
  output: number;
  /** Token đọc-cache (nằm trong `input`). */
  cacheRead?: number;
  /** Token ghi-cache (nằm trong `input`). */
  cacheWrite?: number;
}

/**
 * Ước tính chi phí USD (giá API quy đổi) cho 1 lượt gọi. `input` đã bao gồm cache → tách phần chưa-cache
 * ra tính giá thường, cache read/write tính riêng. Model không có trong bảng → trả 0 (chỉ đếm token).
 */
export function estimateCostUsd(model: string | undefined, t: TokenBreakdown): number {
  const p = priceFor(model);
  if (!p) return 0;
  const cacheRead = Math.max(0, t.cacheRead ?? 0);
  const cacheWrite = Math.max(0, t.cacheWrite ?? 0);
  const uncached = Math.max(0, (t.input || 0) - cacheRead - cacheWrite);
  const cwRate = p.cacheWrite ?? p.input;
  const crRate = p.cacheRead ?? p.input;
  const usd =
    (uncached * p.input + cacheWrite * cwRate + cacheRead * crRate + (t.output || 0) * p.output) / 1_000_000;
  return usd;
}
