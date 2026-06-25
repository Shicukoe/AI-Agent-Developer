import { Router } from 'express';
import type { Request, Response } from 'express';
import { UsageRepository } from '../../state/UsageRepository.js';
import { getCcusageSnapshot } from '../../utils/ccusage.js';
import { getClaudeUsage } from '../../utils/claudeUsage.js';
import { config } from '../../config.js';
import { childLogger } from '../../utils/logger.js';

const log = childLogger('admin-usage');

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response): void => {
    fn(req, res).catch((err: unknown) => {
      log.error({ err, path: req.path }, 'Admin usage route error');
      if (!res.headersSent) res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    });
  };
}

/**
 * Usage gọn theo yêu cầu: TOKEN THEO KHÂU + % tiêu hao so với cửa sổ session 5h.
 * (Bỏ các thẻ cũ: giá API quy đổi, theo model, theo ngày, panel gói $.)
 */
export function usageRouter(): Router {
  const router = Router();

  router.get('/usage', wrap(async (_req, res) => {
    // Token theo khâu — đo "việc thật" = input mới + output (BỎ cache). usage_events lưu input ĐÃ gồm cache nên trừ ra.
    const byStage = UsageRepository.byStage().map(s => {
      const cache = (s.cacheRead || 0) + (s.cacheWrite || 0);
      const inNoCache = Math.max(0, (s.input || 0) - cache);
      const out = s.output || 0;
      return { stage: s.stage, input: inNoCache, output: out, cache, tokens: inNoCache + out, calls: s.calls || 0 };
    });
    const stagesTotal = byStage.reduce((a, s) => a + s.tokens, 0);

    // Cửa sổ session 5h. ƯU TIÊN: số THẬT từ Anthropic (/api/oauth/usage) = đúng `/usage`, tự reset, không cần trần.
    // Lỗi/hết hạn token → ccusage (block 5h ước lượng) → cuối cùng tự đo từ DB.
    const hours = config.USAGE_SESSION_HOURS;
    const cfgLimit = config.USAGE_SESSION_LIMIT_TOKENS;
    let session;

    const official = await getClaudeUsage();
    if (official) {
      session = {
        source: 'official',
        hours,
        pct: official.session.percent,                  // % THẬT — gauge dùng thẳng, không cần token/trần
        resetsAt: official.session.resetsAt,
        remainingMinutes: official.session.remainingMinutes,
        severity: official.session.severity,
        weekly: {
          pct: official.weekly.percent,
          resetsAt: official.weekly.resetsAt,
          remainingMinutes: official.weekly.remainingMinutes,
          severity: official.weekly.severity,
        },
      };
      res.json({ byStage, stagesTotal, session });
      return;
    }

    const cc = await getCcusageSnapshot();
    if (cc?.active) {
      const a = cc.active;
      const tc = a.tokenCounts ?? {};
      const input = tc.inputTokens || 0;           // ccusage: inputTokens = input mới (KHÔNG cache)
      const output = tc.outputTokens || 0;
      const work = input + output;                  // "việc thật" — cơ sở để quy %
      const cacheRead = tc.cacheReadInputTokens || 0;
      // Trần: ép từ config nếu >0, không thì tự hiệu chỉnh theo in+out block 5h cao nhất từ trước.
      const limit = cfgLimit > 0 ? cfgLimit : (cc.maxPrevWorkTokens > 0 ? cc.maxPrevWorkTokens : null);
      session = {
        source: 'ccusage',
        hours,
        startTime: a.startTime,
        endTime: a.endTime,
        remainingMinutes: a.projection?.remainingMinutes ?? null,
        tokens: work,                               // SỐ CHÍNH = in+out (không cache)
        input,
        output,
        cacheRead,                                  // chỉ để hiển thị phụ
        totalWithCache: a.totalTokens || 0,
        calls: a.entries || 0,
        models: a.models ?? [],
        burnTokensPerMin: a.burnRate?.tokensPerMinute ?? null,
        limitTokens: limit,
        limitSource: limit == null ? null : (cfgLimit > 0 ? 'config' : 'auto-max'),
        pct: limit ? Math.min(100, work / limit * 100) : null,
      };
    } else {
      // Fallback: token agent TỰ ĐO (usage_events) trong 5h gần nhất — không có ccusage. Cũng BỎ cache.
      const win = UsageRepository.since(Date.now() - hours * 3600_000);
      const cache = (win.cacheRead || 0) + (win.cacheWrite || 0);
      const inNoCache = Math.max(0, (win.input || 0) - cache);
      const work = inNoCache + (win.output || 0);
      session = {
        source: 'self',
        hours,
        tokens: work,
        input: inNoCache,
        output: win.output || 0,
        cacheRead: win.cacheRead || 0,
        calls: win.calls || 0,
        limitTokens: cfgLimit > 0 ? cfgLimit : null,
        limitSource: cfgLimit > 0 ? 'config' : null,
        pct: cfgLimit > 0 ? Math.min(100, work / cfgLimit * 100) : null,
      };
    }

    res.json({ byStage, stagesTotal, session });
  }));

  return router;
}
