import { config } from '../config.js';
import { childLogger } from './logger.js';

const log = childLogger('token-tracker');

export interface TokenUsage {
  input: number;
  output: number;
  calls: number;
  costUsd: number;
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

function fmt(u: TokenUsage): string {
  const total = u.input + u.output;
  const cost = u.costUsd > 0 ? ` ~$${u.costUsd.toFixed(4)}` : '';
  return `in=${u.input} out=${u.output} total=${total}${cost}`;
}

export const TokenTracker = {
  /** Ghi nhận một lần gọi LLM. In ra console (per-call + tổng task) khi AGENT_VERBOSE. */
  record(label: string | undefined, input: number, output: number, costUsd = 0): TokenUsage {
    const key = keyFromLabel(label);
    const cur = store.get(key) ?? { input: 0, output: 0, calls: 0, costUsd: 0 };
    cur.input += input;
    cur.output += output;
    cur.calls += 1;
    cur.costUsd += costUsd;
    store.set(key, cur);

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
