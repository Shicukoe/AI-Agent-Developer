import { EventEmitter } from 'events';
import { config } from '../config.js';
import { TrelloWebhookServer } from './TrelloWebhookServer.js';
import { TrelloPoller } from './TrelloPoller.js';
import type { TrelloEvent } from './types.js';

export class TrelloConnector extends EventEmitter {
  private inner: TrelloWebhookServer | TrelloPoller;

  /** @param boardIds chỉ theo dõi các board này (đa-process: board của worker). Bỏ trống = tất cả board watched. */
  constructor(boardIds?: string[]) {
    super();
    this.inner = config.TRELLO_USE_WEBHOOK ? new TrelloWebhookServer(boardIds) : new TrelloPoller(boardIds);
    this.inner.on('trello:event', (event: TrelloEvent) => this.emit('trello:event', event));
  }

  start(): void {
    this.inner.start();
  }

  stop(): void {
    if (this.inner instanceof TrelloPoller) this.inner.stop();
  }
}
