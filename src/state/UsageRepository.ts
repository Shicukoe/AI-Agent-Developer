import { randomUUID } from 'crypto';
import { getDb } from './db.js';

export interface UsageEvent {
  taskKey?: string | null;
  label?: string | null;
  stage?: string | null;
  provider?: string | null;
  model?: string | null;
  source?: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheRead?: number;
  cacheWrite?: number;
  costUsd: number;
  /** true = cost ước tính qua bảng giá; false = số thật do nguồn (CLI) báo. */
  estimated?: boolean;
  repoKey?: string | null;
}

export interface UsageTotals {
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
}

const ZERO: UsageTotals = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 };

const SUM = `
  COUNT(*) AS calls,
  COALESCE(SUM(input_tokens),0)  AS input,
  COALESCE(SUM(output_tokens),0) AS output,
  COALESCE(SUM(cache_read),0)    AS cacheRead,
  COALESCE(SUM(cache_write),0)   AS cacheWrite,
  COALESCE(SUM(cost_usd),0)      AS costUsd
`;

export const UsageRepository = {
  /** Ghi 1 lượt gọi LLM. Best-effort — KHÔNG được làm hỏng luồng agent nếu DB lỗi. */
  record(e: UsageEvent): void {
    try {
      getDb().prepare(`INSERT INTO usage_events
        (id, task_key, label, stage, provider, model, source, input_tokens, output_tokens,
         cache_read, cache_write, cost_usd, cost_estimated, repo_key, created_at)
        VALUES (@id,@task_key,@label,@stage,@provider,@model,@source,@input,@output,
                @cacheRead,@cacheWrite,@cost,@estimated,@repo_key,@created_at)`).run({
        id: randomUUID(),
        task_key: e.taskKey ?? null,
        label: e.label ?? null,
        stage: e.stage ?? null,
        provider: e.provider ?? null,
        model: e.model ?? null,
        source: e.source ?? null,
        input: Math.round(e.inputTokens || 0),
        output: Math.round(e.outputTokens || 0),
        cacheRead: Math.round(e.cacheRead || 0),
        cacheWrite: Math.round(e.cacheWrite || 0),
        cost: e.costUsd || 0,
        estimated: e.estimated === false ? 0 : 1,
        repo_key: e.repoKey ?? null,
        created_at: Date.now(),
      });
    } catch { /* nuốt lỗi: usage là phụ trợ, không chặn agent */ }
  },

  /** Tổng toàn hệ (mọi repo). */
  totals(): UsageTotals {
    try { return (getDb().prepare(`SELECT ${SUM} FROM usage_events`).get() as UsageTotals) ?? ZERO; }
    catch { return ZERO; }
  },

  /** Tổng từ mốc thời gian `fromMs` đến nay (vd 30 ngày gần nhất, cho chu kỳ gói thuê bao). */
  since(fromMs: number): UsageTotals {
    try {
      return (getDb().prepare(`SELECT ${SUM} FROM usage_events WHERE created_at >= ?`).get(fromMs) as UsageTotals) ?? ZERO;
    } catch { return ZERO; }
  },

  /** Tổng cho 1 task (theo task_key = card key). */
  forTask(taskKey: string): UsageTotals {
    try {
      return (getDb().prepare(`SELECT ${SUM} FROM usage_events WHERE task_key = ?`).get(taskKey) as UsageTotals) ?? ZERO;
    } catch { return ZERO; }
  },

  /** Gộp theo model (nhiều dòng), tốn nhiều → ít. */
  byModel(): Array<UsageTotals & { model: string; provider: string }> {
    try {
      return getDb().prepare(`SELECT model, provider, ${SUM} FROM usage_events
        GROUP BY model, provider ORDER BY costUsd DESC, input DESC`).all() as any;
    } catch { return []; }
  },

  /** Gộp theo stage (refine/plan/dev/test…). */
  byStage(): Array<UsageTotals & { stage: string }> {
    try {
      return getDb().prepare(`SELECT COALESCE(stage,'(khác)') AS stage, ${SUM} FROM usage_events
        GROUP BY stage ORDER BY costUsd DESC`).all() as any;
    } catch { return []; }
  },

  /** Gộp theo ngày (YYYY-MM-DD, giờ địa phương theo offset ms), `days` ngày gần nhất. */
  byDay(days = 14): Array<UsageTotals & { day: string }> {
    try {
      const since = Date.now() - days * 86400_000;
      return getDb().prepare(`SELECT date(created_at/1000,'unixepoch','localtime') AS day, ${SUM}
        FROM usage_events WHERE created_at >= ? GROUP BY day ORDER BY day DESC`).all(since) as any;
    } catch { return []; }
  },
};
