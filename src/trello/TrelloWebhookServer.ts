import express from 'express';
import { createHmac } from 'crypto';
import { EventEmitter } from 'events';
import { config, stageForListName } from '../config.js';
import { childLogger } from '../utils/logger.js';
import type { TrelloEvent, TrelloAction } from './types.js';

const log = childLogger('webhook-server');

function verifyHmac(body: string, signature: string): boolean {
  if (!config.TRELLO_WEBHOOK_SECRET) return true; // skip in dev without secret
  const hmac = createHmac('sha1', config.TRELLO_WEBHOOK_SECRET);
  hmac.update(body);
  const expected = hmac.digest('base64');
  return expected === signature;
}

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

  // Admin comment (for confirmations)
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

export class TrelloWebhookServer extends EventEmitter {
  private app = express();

  constructor() {
    super();
    this.app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); } }));
    this.app.head(config.WEBHOOK_PATH, (_req, res) => res.sendStatus(200));
    this.app.post(config.WEBHOOK_PATH, (req: any, res) => {
      const sig = req.headers['x-trello-webhook'] as string;
      if (!verifyHmac(req.rawBody, sig)) {
        log.warn('Invalid webhook signature');
        return res.sendStatus(401);
      }

      const action: TrelloAction = req.body?.action;
      if (!action) return res.sendStatus(200);

      const event = parseAction(action);
      if (event) {
        log.debug({ event }, 'Trello event received');
        this.emit('trello:event', event);
      }
      res.sendStatus(200);
    });
  }

  start(): void {
    this.app.listen(config.WEBHOOK_PORT, () => {
      log.info({ port: config.WEBHOOK_PORT, path: config.WEBHOOK_PATH }, 'Webhook server listening');
    });
  }
}
