import 'dotenv/config';                 // nạp .env trước khi config được import (qua conventions)
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { conventionsBlock } from './conventions.js';

const est = (s: string): number => Math.ceil(s.length / 4);

describe('conventionsBlock — Claude CLI bo inject CLAUDE.md (tu nap)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'conv-'));
  const big = '- Quy uoc: viet code toi gian, dung convention, co test. '.repeat(380); // ~5k token
  writeFileSync(join(dir, 'CLAUDE.md'), big, 'utf8');

  it('gemini/openai → GIU full CLAUDE.md (co sentinel)', () => {
    const full = conventionsBlock('gemini', dir);
    expect(full).toContain('AUTOPILOT_CONV_START');
    expect(full).toContain('viet code toi gian');
    expect(est(full)).toBeGreaterThan(1000);
  });

  it('claude (CLI) + OPTIMIZE_HISTORY → CHI ghi chu ngan, khong inject noi dung', () => {
    const full = conventionsBlock('gemini', dir);
    const short = conventionsBlock('claude', dir);

    expect(short).not.toContain('viet code toi gian');   // KHONG inject noi dung CLAUDE.md
    expect(short).toContain('Claude Code');               // chi 1 ghi chu

    const saved = est(full) - est(short);
    console.log('\n=== CLAUDE CLI: token CLAUDE.md tiet kiem MOI STAGE ===');
    console.log(`  full (gemini)  : ${est(full)} tok`);
    console.log(`  claude (ngan)  : ${est(short)} tok`);
    console.log(`  TIET KIEM      : ${saved} tok/stage  ->  x4 stage = ~${saved * 4} tok/task`);
    console.log('======================================================\n');

    expect(est(short)).toBeLessThan(est(full) * 0.1);     // teo > 90%
  });

  it('repo khong co CLAUDE.md → tra ve rong (an toan)', () => {
    const empty = mkdtempSync(join(tmpdir(), 'empty-'));
    expect(conventionsBlock('claude', empty)).toBe('');
    expect(conventionsBlock('gemini', empty)).toBe('');
  });
});
