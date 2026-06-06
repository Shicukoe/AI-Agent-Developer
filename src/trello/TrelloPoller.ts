import { EventEmitter } from 'events';
import { TrelloClient } from './TrelloClient.js';
import { getDb } from '../state/db.js';
import { config, stageForListName } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { TrelloEvent, TrelloAction } from './types.js';

const log = childLogger('poller');

function parseAction(action: TrelloAction): TrelloEvent | null {
  const cardId = action.data.card?.id;
  const boardId = action.data.board?.id;
  if (!cardId || !boardId) return null;

  // Card moved into a stage list (Planning / Dev / Test)
  if (action.type === 'updateCard' && action.data.listAfter) {
    const stage = stageForListName(action.data.listAfter.name);
    if (stage) {
      return {
        type: 'card:moved_to_stage',
        stage,
        cardId,
        boardId,
        listId: action.data.listAfter.id,
        listName: action.data.listAfter.name,
      };
    }
  }

  // Any label added — index.ts decides if it's the AI switch or the plan-approve label
  if (action.type === 'addLabelToCard' && action.data.label) {
    return { type: 'card:label_added', labelName: action.data.label.name ?? '', cardId, boardId };
  }

  // Admin comment
  if (action.type === 'commentCard') {
    return {
      type: 'comment:added',
      cardId,
      boardId,
      memberId: action.idMemberCreator,
      text: action.data.text ?? '',
      actionId: action.id,
    };
  }

  return null;
}

function getLastSeen(boardId: string): string | undefined {
  const row = getDb().prepare('SELECT last_seen_action FROM poller_state WHERE board_id = ?').get(boardId) as { last_seen_action: string | null } | undefined;
  return row?.last_seen_action ?? undefined;
}

function setLastSeen(boardId: string, actionId: string): void {
  getDb().prepare(`INSERT INTO poller_state (board_id, last_seen_action, last_poll_at)
    VALUES (?, ?, ?) ON CONFLICT(board_id) DO UPDATE SET last_seen_action=excluded.last_seen_action, last_poll_at=excluded.last_poll_at`)
    .run(boardId, actionId, Date.now());
}

export class TrelloPoller extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    log.info({ interval: config.POLL_INTERVAL_MS }, 'Poller started');
    this.poll();
    this.timer = setInterval(() => this.poll(), config.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    for (const boardId of config.TRELLO_BOARD_IDS) {
      try {
        const lastSeen = getLastSeen(boardId);
        const actions = await TrelloClient.getBoardActions(boardId, { since: lastSeen, filter: 'updateCard,commentCard,addLabelToCard' });
        if (actions.length === 0) continue;

        // Process oldest first
        const sorted = [...actions].reverse();
        for (const action of sorted) {
          const event = parseAction(action);
          if (event) {
            log.debug({ event }, 'Polled event');
            this.emit('trello:event', event);
          }
        }
        setLastSeen(boardId, sorted[sorted.length - 1].id);
      } catch (err) {
        log.error({ boardId, err }, 'Poll error');
      }
    }
  }
}
