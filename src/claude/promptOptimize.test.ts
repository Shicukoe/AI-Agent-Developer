import { describe, it, expect } from 'vitest';
import { optimizeFirstMessage } from './promptOptimize.js';

/** Xấp xỉ token: ~1 token ≈ 4 ký tự (đủ chính xác để so sánh tương đối). */
const estTokens = (s: string): number => Math.ceil(s.length / 4);

function bigBlock(approxTokens: number): string {
  const unit = '- Quy uoc: luon viet code toi gian, dung convention, co test, khong refactor ngoai scope. ';
  return unit.repeat(Math.ceil((approxTokens * 4) / unit.length));
}

/** Message đầu giống thật: lời dẫn + 2 khối quy ước nặng (bọc sentinel) + nội dung task. */
function buildFirstMessage(): string {
  const conv = bigBlock(8000);     // ~ CLAUDE.md 8.000 token
  const overview = bigBlock(2000); // ~ overview 2.000 token
  return [
    'You are a senior software architect.',
    `<!--AUTOPILOT_CONV_START-->\n## Project Conventions (from CLAUDE.md)\n${conv}\n<!--AUTOPILOT_CONV_END-->`,
    `<!--AUTOPILOT_OVERVIEW_START-->\n## Project Overview (from docs/00_TONG_THE.md)\n${overview}\n<!--AUTOPILOT_OVERVIEW_END-->`,
    '## Trello Card\nTitle: Them section Doi tac (Partners)\nDescription: them 4 logo placeholder.',
    '## Required JSON response schema\n```json\n{ "summary": "...", "sub_tasks": [] }\n```',
  ].join('\n\n');
}

describe('optimizeFirstMessage — chung minh token giam', () => {
  const msg0 = buildFirstMessage();
  const opt0 = optimizeFirstMessage(msg0);

  it('giu nguyen noi dung task, chi cat khoi quy uoc', () => {
    expect(opt0).toContain('## Trello Card');
    expect(opt0).toContain('Required JSON response schema');
    expect(opt0).toContain('senior software architect');
    expect(opt0).not.toContain('AUTOPILOT_CONV_START');
    expect(opt0).not.toContain('luon viet code toi gian'); // noi dung conventions da bi cat
  });

  it('giam token dang ke qua hoi thoai nhieu luot (BAT vs TAT)', () => {
    const T = 8;          // task dev ~8 luot goi tool
    const perTurn = 250;  // moi luot lich su tang ~250 token (tool result + assistant)
    const full = estTokens(msg0);
    const opt = estTokens(opt0);

    let history = 0, totalWithout = 0, totalWith = 0;
    for (let t = 0; t < T; t++) {
      // LLM tinh phi theo input MOI luot = toan bo history gui lai.
      totalWithout += full + history;                 // TAT: luot nao cung gui full
      totalWith += (t === 0 ? full : opt) + history;  // BAT: Turn 0 full, Turn 1+ da cat
      history += perTurn;
    }
    const saved = totalWithout - totalWith;
    const pct = (saved / totalWithout) * 100;

    console.log('\n========== CHUNG MINH TOKEN GIAM ==========');
    console.log(`Message dau (1 luot):  full=${full} tok | optimized=${opt} tok | cat ${full - opt} tok/luot`);
    console.log(`Hoi thoai ${T} luot (input tokens cong don):`);
    console.log(`  - TAT optimize : ${totalWithout} tokens`);
    console.log(`  - BAT optimize : ${totalWith} tokens`);
    console.log(`  - TIET KIEM    : ${saved} tokens  (${pct.toFixed(1)}%)`);
    console.log('===========================================\n');

    expect(opt).toBeLessThan(full * 0.2);  // message dau teo > 80%
    expect(pct).toBeGreaterThan(50);       // tiet kiem > 50% toan hoi thoai
  });

  it('KHONG cat nham khi prompt khong co sentinel (bug cu da fix)', () => {
    const plain = 'You are an architect.\n\n## Trello Card\nTitle: X\n\n## Schema\n{...}';
    // Bug cu se bien moi section thanh "Omitted"; ban sua: no-op khi khong co sentinel.
    expect(optimizeFirstMessage(plain)).toBe(plain);
  });
});
