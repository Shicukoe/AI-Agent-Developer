import { TrelloClient } from '../trello/TrelloClient.js';
import { WorktreeManager } from '../git/WorktreeManager.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { childLogger } from '../utils/logger.js';
import { RiskBudgetExceededError } from '../utils/errors.js';
import type { Task } from '../state/TaskRepository.js';

const log = childLogger('orchestrator');

/**
 * Shared error handling for stage handlers. The 3-stage routing lives in StageRouter;
 * this module only owns the common failure path (status, Trello comment, worktree cleanup).
 */
export const OrchestratorAgent = {
  async handleError(task: Task, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ taskId: task.id, err }, 'Task error');

    const isRiskError = err instanceof RiskBudgetExceededError;
    const status = isRiskError ? 'halted' : 'failed';
    const icon = isRiskError ? '🛑' : '❌';

    TaskRepository.setStatus(task.id, status, { error_message: message });
    await TrelloClient.addComment(task.card_id, `${icon} **[AI AGENT] Lỗi xử lý task**\n\`${message}\``).catch(() => {});

    if (task.worktree_path) {
      await WorktreeManager.remove(task.id).catch(() => {});
    }
  },
};
