import 'dotenv/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessAnalystAgent } from './BusinessAnalystAgent.js';
import { LlmClient } from '../claude/LlmClient.js';
import { TrelloClient } from '../trello/TrelloClient.js';
import { CardMemory } from './CardMemory.js';
import { ProjectDocs } from './ProjectDocs.js';
import type { Task } from '../state/TaskRepository.js';

const task = { id: 1, card_id: 'card123', repo_path: '/tmp/repo' } as unknown as Task;

describe('BusinessAnalystAgent — chỉ phân tích, KHÔNG tạo card con', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(TrelloClient, 'getCard').mockResolvedValue({ id: 'card123', name: 'Test', desc: '', labels: [], checklists: [], attachments: [] } as never);
    vi.spyOn(CardMemory, 'loadContext').mockResolvedValue('');
    vi.spyOn(CardMemory, 'post').mockResolvedValue(undefined as never);
    vi.spyOn(ProjectDocs, 'exists').mockReturnValue(true);
    vi.spyOn(ProjectDocs, 'guidance').mockReturnValue('');
  });

  it('trả AnalystResponse và KHÔNG gọi TrelloClient.createCard', async () => {
    const createCard = vi.spyOn(TrelloClient, 'createCard');
    vi.spyOn(LlmClient, 'runForJson').mockResolvedValue({
      intent: 'Mục tiêu', context: '', requirements: ['r1'], acceptance_criteria: ['a1'],
      open_questions: [], confidence: 0.9,
      business_subtasks: [{ title: 'A', description: 'x' }, { title: 'B', description: 'y' }],
    } as never);

    const res = await BusinessAnalystAgent.run(task);

    expect(res.intent).toBe('Mục tiêu');
    expect(res.business_subtasks).toHaveLength(2);
    expect(createCard).not.toHaveBeenCalled();
  });
});
