import 'dotenv/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleEngine } from '../rules/RuleEngine.js';
import { TriageAgent } from './TriageAgent.js';
import type { TrelloCard } from '../trello/types.js';

function card(over: Partial<TrelloCard> = {}): TrelloCard {
  return {
    id: 'card12345678', idBoard: 'b', name: 'Task', desc: '', url: '',
    labels: [], attachments: [], checklists: [],
    ...over,
  } as TrelloCard;
}

const smallDecision = { taskType: 'small', isAutoRun: false, requiresConfirmation: false, allowedActions: [], deniedActions: [], reason: '' };

describe('TriageAgent — phân tầng rẻ (rule, không gọi LLM)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(RuleEngine, 'evaluate').mockReturnValue(smallDecision as never);
  });

  it('nhãn quick → trivial (ép, không cần rule/LLM)', async () => {
    const r = await TriageAgent.run(card({ labels: [{ name: 'quick' }] as never, desc: 'x'.repeat(500) }));
    expect(r.trivial).toBe(true);
    expect(r.source).toBe('quick_label');
  });

  it('RuleEngine = large → KHÔNG trivial (không gọi LLM)', async () => {
    vi.spyOn(RuleEngine, 'evaluate').mockReturnValue({ ...smallDecision, taskType: 'large' } as never);
    const r = await TriageAgent.run(card({ name: 'Xây màn báo cáo mới' }));
    expect(r.trivial).toBe(false);
    expect(r.source).toBe('rule');
  });

  it('rule trivial mạnh ([ICON] + desc ngắn, không attach) → trivial', async () => {
    const r = await TriageAgent.run(card({ name: '[ICON] sửa icon header', desc: 'đổi icon menu' }));
    expect(r.trivial).toBe(true);
    expect(r.source).toBe('rule');
    expect(r.spec).toContain('icon');
  });

  it('có attachment → KHÔNG trivial theo rule mạnh (rớt xuống nhánh LLM, ở test này chặn)', async () => {
    // desc dài + có attachment → strongRuleTrivial=false; RuleEngine=small → sẽ tới nhánh LLM.
    // Mock LlmClient để khỏi gọi mạng: trả không-trivial.
    const { LlmClient } = await import('../claude/LlmClient.js');
    vi.spyOn(LlmClient, 'runForJson').mockResolvedValue({ trivial: false, reason: 'mock' } as never);
    const r = await TriageAgent.run(card({ name: 'Thêm tính năng', desc: 'x'.repeat(300), attachments: [{ name: 'a.png' }] as never }));
    expect(r.trivial).toBe(false);
    expect(r.source).toBe('llm');
  });
});
