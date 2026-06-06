import { TrelloClient } from '../trello/TrelloClient.js';
import { childLogger } from '../utils/logger.js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { AgentAction } from '../claude/types.js';
import type { Task } from '../state/TaskRepository.js';

const log = childLogger('actions');

export type ActionHandler = (task: Task, params: Record<string, unknown>) => Promise<string>;

const handlers: Record<string, ActionHandler> = {
  async post_comment(task, params) {
    const text = String(params.text ?? '');
    await TrelloClient.addComment(task.card_id, text);
    return `Comment posted (${text.length} chars)`;
  },

  async add_label(task, params) {
    const labelId = String(params.labelId ?? '');
    await TrelloClient.addLabel(task.card_id, labelId);
    return `Label ${labelId} added`;
  },

  async move_card(task, params) {
    const listId = String(params.listId ?? '');
    await TrelloClient.moveCard(task.card_id, listId);
    return `Card moved to list ${listId}`;
  },

  async update_checklist_item(task, params) {
    const { checkItemId, state } = params as { checkItemId: string; state: 'complete' | 'incomplete' };
    await TrelloClient.updateChecklistItem(task.card_id, checkItemId, state);
    return `Checklist item ${checkItemId} → ${state}`;
  },

  async write_file(_task, params) {
    const path = String(params.path ?? '');
    const content = String(params.content ?? '');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
    return `File written: ${path}`;
  },

  async read_file(_task, params) {
    const path = String(params.path ?? '');
    const content = readFileSync(path, 'utf8');
    return content;
  },
};

export const ActionRegistry = {
  async execute(task: Task, action: AgentAction): Promise<string> {
    const handler = handlers[action.type];
    if (!handler) {
      log.warn({ type: action.type }, 'No handler for action type');
      return `No handler: ${action.type}`;
    }
    log.debug({ taskId: task.id, action: action.type }, 'Executing action');
    const result = await handler(task, action.params);
    log.info({ taskId: task.id, action: action.type, result }, 'Action executed');
    return result;
  },
};
