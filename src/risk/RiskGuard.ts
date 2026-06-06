import { config } from '../config.js';
import { RuleEngine } from '../rules/RuleEngine.js';
import { RiskBudgetExceededError } from '../utils/errors.js';
import { childLogger } from '../utils/logger.js';
import type { Task } from '../state/TaskRepository.js';
import type { AgentAction } from '../claude/types.js';

const log = childLogger('risk-guard');

export const RiskGuard = {
  validateActions(task: Task, actions: AgentAction[], allowedActions: string[]): AgentAction[] {
    const safe: AgentAction[] = [];

    for (const action of actions) {
      // Check action type is in allowed list
      if (!allowedActions.includes(action.type)) {
        log.warn({ taskId: task.id, action: action.type }, 'Action not in allowed list — dropped');
        continue;
      }

      // Enforce board isolation: write_file must be within worktree path
      if (action.type === 'write_file' && task.worktree_path) {
        const filePath = String(action.params.path ?? '');
        if (!filePath.startsWith(task.worktree_path)) {
          log.error({ taskId: task.id, filePath, worktreePath: task.worktree_path }, 'write_file outside worktree — blocked');
          continue;
        }
      }

      // Forbidden list IDs for card moves
      if (action.type === 'move_card') {
        const targetListId = String(action.params.listId ?? '');
        if (config.RISK_FORBIDDEN_LIST_IDS.includes(targetListId)) {
          log.error({ taskId: task.id, targetListId }, 'move_card to forbidden list — blocked');
          continue;
        }
      }

      safe.push(action);
    }

    return safe;
  },

  assertBudget(task: Task): void {
    if (task.actions_taken >= config.RISK_MAX_ACTIONS_PER_TASK) {
      throw new RiskBudgetExceededError('actions_per_task', config.RISK_MAX_ACTIONS_PER_TASK, task.actions_taken);
    }
    if (task.turns_taken >= config.CLAUDE_MAX_TURNS_PER_TASK) {
      throw new RiskBudgetExceededError('turns_per_task', config.CLAUDE_MAX_TURNS_PER_TASK, task.turns_taken);
    }
  },

  assertBranchSafe(branchName: string): void {
    const protected_ = RuleEngine.getProtectedBranches();
    if (protected_.includes(branchName.toLowerCase())) {
      throw new Error(`Agent cannot directly operate on protected branch: ${branchName}`);
    }
  },
};
