import { config } from '../config.js';
import { childLogger } from './logger.js';
import { estimateCostUsd } from './pricing.js';
import { UsageRepository } from '../state/UsageRepository.js';

const log = childLogger('token-tracker');

export interface TokenUsage {
  input: number;
  output: number;
  calls: number;
  costUsd: number;
}

/** Thông tin kèm theo 1 lượt gọi — để tính giá đúng model & lưu DB (admin đọc gộp). */
export interface RecordMeta {
  /** claude | gemini | openai */
  provider?: string;
  /** model-id đã dùng (để tra bảng giá). */
  model?: string;
  /** Nguồn đo: 'cli' (Claude CLI báo cost thật) | 'api' | 'gemini' | 'openai'. */
  source?: string;
  /** Token đọc-cache (đã nằm trong `input`). */
  cacheRead?: number;
  /** Token ghi-cache (đã nằm trong `input`). */
  cacheWrite?: number;
  /** Cost THẬT do nguồn báo (vd CLI total_cost_usd). Có → dùng thẳng, không ước tính qua bảng giá. */
  costUsd?: number;
}

/**
 * Cộng dồn token THEO TASK. Key lấy từ phần sau dấu ':' của label (vd "plan:abc123" → "abc123"),
 * tức là prefix card-id — nên token của các stage (refine/plan/dev/test) cùng một card được gộp lại.
 */
const store = new Map<string, TokenUsage>();

function keyFromLabel(label?: string): string {
  if (!label) return 'global';
  const i = label.indexOf(':');
  return i >= 0 ? label.slice(i + 1) : label;
}

function stageFromLabel(label?: string): string | undefined {
  if (!label) return undefined;
  const i = label.indexOf(':');
  return i > 0 ? label.slice(0, i) : label;
}

function fmt(u: TokenUsage): string {
  const total = u.input + u.output;
  const cost = u.costUsd > 0 ? ` ~$${u.costUsd.toFixed(4)}` : '';
  return `in=${u.input} out=${u.output} total=${total}${cost}`;
}

export const TokenTracker = {
  /**
   * Ghi nhận một lần gọi LLM: cộng dồn in-memory (cho summary Trello) + tính giá + lưu DB (cho admin).
   * `meta` cũ là số costUsd — vẫn nhận được (back-compat) nhưng nên truyền RecordMeta để có model/cache/source.
   */
  record(label: string | undefined, input: number, output: number, meta?: RecordMeta | number): TokenUsage {
    const m: RecordMeta = typeof meta === 'number' ? { costUsd: meta } : (meta ?? {});
    // Cost: ưu tiên số thật do nguồn báo (CLI); nếu không có → ước tính qua bảng giá theo model.
    const estimated = m.costUsd == null;
    const costUsd = m.costUsd != null
      ? m.costUsd
      : estimateCostUsd(m.model, { input, output, cacheRead: m.cacheRead, cacheWrite: m.cacheWrite });

    const key = keyFromLabel(label);
    const cur = store.get(key) ?? { input: 0, output: 0, calls: 0, costUsd: 0 };
    cur.input += input;
    cur.output += output;
    cur.calls += 1;
    cur.costUsd += costUsd;
    store.set(key, cur);

    // Lưu DB (best-effort — UsageRepository tự nuốt lỗi).
    UsageRepository.record({
      taskKey: key === 'global' ? null : key,
      label: label ?? null,
      stage: stageFromLabel(label) ?? null,
      provider: m.provider ?? null,
      model: m.model ?? null,
      source: m.source ?? (m.costUsd != null ? 'cli' : null),
      inputTokens: input,
      outputTokens: output,
      cacheRead: m.cacheRead ?? 0,
      cacheWrite: m.cacheWrite ?? 0,
      costUsd,
      estimated,
      repoKey: process.env.AUTOPILOT_REPO_KEY ?? null,
    });

    const callTotal = input + output;
    log.info({ taskKey: key, callInput: input, callOutput: output, taskTotal: cur.input + cur.output }, 'token usage');
    if (config.AGENT_VERBOSE) {
      const tag = label ? `[${label}]` : '[llm]';
      process.stdout.write(
        `  \x1b[36m${tag} Token → call: in=${input} out=${output} (${callTotal}) | ` +
        `task: ${fmt(cur)} | calls=${cur.calls}\x1b[0m\n`
      );
    }
    return cur;
  },

  /** Tổng token đã dùng cho một task (theo label/card key). */
  get(label?: string): TokenUsage {
    return store.get(keyFromLabel(label)) ?? { input: 0, output: 0, calls: 0, costUsd: 0 };
  },

  /** Chuỗi gọn để chèn vào comment Trello / log. */
  summary(label?: string): string {
    const u = this.get(label);
    if (u.calls === 0) return 'Token: (không đo được)';
    return `Token đã dùng (task này): ${fmt(u)} qua ${u.calls} lượt gọi`;
  },

  reset(label?: string): void {
    store.delete(keyFromLabel(label));
  },
};
