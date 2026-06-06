import { EventEmitter } from 'events';
import { config } from '../config.js';
import { TrelloWebhookServer } from './TrelloWebhookServer.js';
import { TrelloPoller } from './TrelloPoller.js';
import type { TrelloEvent } from './types.js';

export class TrelloConnector extends EventEmitter {
  private inner: TrelloWebhookServer | TrelloPoller;

  constructor() {
    super();
    this.inner = config.TRELLO_USE_WEBHOOK ? new TrelloWebhookServer() : new TrelloPoller();
    this.inner.on('trello:event', (event: TrelloEvent) => this.emit('trello:event', event));
  }

  start(): void {
    this.inner.start();
  }

  stop(): void {
    if (this.inner instanceof TrelloPoller) this.inner.stop();
  }
}
