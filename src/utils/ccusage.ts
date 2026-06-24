import { execa } from 'execa';
import { config } from '../config.js';
import { childLogger } from './logger.js';

const log = childLogger('ccusage');

/** 1 block 5h do ccusage trả về (chỉ các trường ta dùng). */
interface CcBlock {
  id: string;
  isActive: boolean;
  isGap: boolean;
  startTime: string;
  endTime: string;
  totalTokens: number;
  costUSD?: number;
  entries?: number;
  models?: string[];
  tokenCounts?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
  };
  burnRate?: { tokensPerMinute?: number; costPerHour?: number } | null;
  projection?: { remainingMinutes?: number; totalTokens?: number; totalCost?: number } | null;
}

export interface CcSnapshot {
  active: CcBlock | null;
  /** in+out (KHÔNG cache) của block 5h cao nhất từ trước — trần tự hiệu chỉnh, đo theo "việc thật". */
  maxPrevWorkTokens: number;
}

/** Token "việc thật" của 1 block = input mới + output (bỏ cache read/creation). ccusage: inputTokens đã là non-cache. */
function workTokens(b: CcBlock): number {
  const tc = b.tokenCounts ?? {};
  return (tc.inputTokens || 0) + (tc.outputTokens || 0);
}

let cache: { at: number; data: CcSnapshot | null } | null = null;
const TTL_MS = 30_000;   // ccusage gọi subprocess → cache ngắn cho mỗi lần admin load.

/**
 * Chạy `ccusage blocks --json` (đọc transcript ~/.claude, read-only) → block 5h đang chạy + trần tự hiệu chỉnh.
 * Lỗi/không cài → trả null (caller fallback sang tự đo từ usage_events). Cache 30s tránh gọi liên tục.
 */
export async function getCcusageSnapshot(): Promise<CcSnapshot | null> {
  if (!config.CCUSAGE_ENABLED) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const { stdout } = await execa(`${config.CCUSAGE_CMD} blocks --json`, { shell: true, timeout: 60_000 });
    const blocks: CcBlock[] = JSON.parse(stdout).blocks ?? [];
    const active = blocks.find(b => b.isActive) ?? null;
    const maxPrevWorkTokens = blocks
      .filter(b => !b.isActive && !b.isGap)
      .reduce((m, b) => Math.max(m, workTokens(b)), 0);
    const data: CcSnapshot = { active, maxPrevWorkTokens };
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    log.warn({ err: (err as Error).message?.slice(0, 200) }, 'ccusage không chạy được — fallback tự đo');
    cache = { at: Date.now(), data: null };   // cache cả thất bại để khỏi spam subprocess
    return null;
  }
}
