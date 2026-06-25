import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { config } from '../config.js';
import { childLogger } from './logger.js';

const log = childLogger('claude-usage');

/** % giới hạn THẬT của gói (đúng số `/usage` hiển thị), đọc từ endpoint Anthropic bằng OAuth token. */
export interface ClaudeUsage {
  session: { percent: number; resetsAt: string | null; remainingMinutes: number | null; severity: string | null };
  weekly: { percent: number; resetsAt: string | null; remainingMinutes: number | null; severity: string | null };
  fetchedAt: number;
}

let cache: { at: number; data: ClaudeUsage | null } | null = null;
const TTL_MS = 30_000;
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

/** Token OAuth của gói nằm sẵn trong file creds của Claude Code (CLI tự refresh). KHÔNG cache/echo token. */
function readToken(): string | null {
  try {
    const raw = readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8');
    const t = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof t === 'string' && t.length > 0 ? t : null;
  } catch { return null; }
}

function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.round((t - Date.now()) / 60000));
}

/**
 * Lấy % giới hạn THẬT (session 5h + tuần) từ Anthropic — đúng nguồn `/usage` dùng. Cache 30s.
 * Token đọc lại mỗi lần từ file (CLI giữ tươi); KHÔNG bao giờ log/echo token. Lỗi/hết hạn/không cài → null.
 */
export async function getClaudeUsage(): Promise<ClaudeUsage | null> {
  if (!config.CLAUDE_USAGE_OFFICIAL) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const token = readToken();
  if (!token) { cache = { at: Date.now(), data: null }; return null; }

  try {
    const res = await fetch(USAGE_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'anthropic-version': '2023-06-01',
        'User-Agent': 'claude-cli/2.1.168 (external,cli)',
      },
    });
    if (!res.ok) {
      // 401 = token hết hạn → mở Claude Code 1 lần để CLI refresh file creds. KHÔNG log token.
      log.warn({ status: res.status }, 'oauth/usage không 200 (token hết hạn? mở Claude Code để refresh)');
      cache = { at: Date.now(), data: null };
      return null;
    }
    const j: any = await res.json();
    const fh = j.five_hour ?? {};
    const sd = j.seven_day ?? {};
    const limits: any[] = Array.isArray(j.limits) ? j.limits : [];
    const sevOf = (pred: (l: any) => boolean): string | null => limits.find(pred)?.severity ?? null;

    const data: ClaudeUsage = {
      session: {
        percent: Math.round(fh.utilization ?? 0),
        resetsAt: fh.resets_at ?? null,
        remainingMinutes: minutesUntil(fh.resets_at),
        severity: sevOf(l => l.kind === 'session'),
      },
      weekly: {
        percent: Math.round(sd.utilization ?? 0),
        resetsAt: sd.resets_at ?? null,
        remainingMinutes: minutesUntil(sd.resets_at),
        severity: sevOf(l => l.group === 'weekly'),
      },
      fetchedAt: Date.now(),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    log.warn({ err: (err as Error).message?.slice(0, 150) }, 'oauth/usage lỗi mạng');
    cache = { at: Date.now(), data: null };
    return null;
  }
}
