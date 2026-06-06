import { config } from '../config.js';
import { TrelloApiError } from '../utils/errors.js';
import { withRetry } from '../utils/retry.js';
import { childLogger } from '../utils/logger.js';
import type { TrelloCard, TrelloAction, TrelloList, TrelloLabel, TrelloAttachment } from './types.js';

const log = childLogger('trello-client');
const BASE = 'https://api.trello.com/1';

// Simple token bucket: max 80 requests per 10s (conservative under Trello's 100/10s limit)
let _tokens = 80;
let _lastRefill = Date.now();
async function throttle() {
  const now = Date.now();
  const elapsed = now - _lastRefill;
  if (elapsed >= 10000) { _tokens = 80; _lastRefill = now; }
  if (_tokens <= 0) {
    const wait = 10000 - elapsed;
    await new Promise(r => setTimeout(r, wait));
    _tokens = 80;
    _lastRefill = Date.now();
  }
  _tokens--;
}

async function trelloFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  await throttle();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}key=${config.TRELLO_API_KEY}&token=${config.TRELLO_API_TOKEN}`;
  return withRetry(async () => {
    const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new TrelloApiError(`Trello API ${res.status}: ${body}`, res.status, { path });
    }
    return res.json() as Promise<T>;
  }, { attempts: 3, label: `GET ${path}` });
}

export const TrelloClient = {
  async getCard(cardId: string): Promise<TrelloCard> {
    return trelloFetch<TrelloCard>(`/cards/${cardId}?attachments=true&checklists=all&members=true&labels=true`);
  },

  async getLists(boardId: string): Promise<TrelloList[]> {
    return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists`);
  },

  async getLabels(boardId: string): Promise<TrelloLabel[]> {
    return trelloFetch<TrelloLabel[]>(`/boards/${boardId}/labels?limit=1000`);
  },

  async getBoardActions(boardId: string, opts: { since?: string; filter?: string } = {}): Promise<TrelloAction[]> {
    const filter = opts.filter ?? 'updateCard,commentCard,addMemberToCard';
    const since = opts.since ? `&since=${opts.since}` : '';
    return trelloFetch<TrelloAction[]>(`/boards/${boardId}/actions?filter=${filter}&limit=50${since}`);
  },

  async addComment(cardId: string, text: string): Promise<void> {
    await trelloFetch(`/cards/${cardId}/actions/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    log.debug({ cardId }, 'Comment posted');
  },

  /** Lấy comment của card, mới nhất trước. */
  async getCardComments(cardId: string, limit = 50): Promise<Array<{ id: string; text: string; memberId: string; date: string }>> {
    const actions = await trelloFetch<TrelloAction[]>(`/cards/${cardId}/actions?filter=commentCard&limit=${limit}`);
    return actions.map(a => ({
      id: a.id,
      text: a.data.text ?? '',
      memberId: a.idMemberCreator,
      date: a.date,
    }));
  },

  async moveCard(cardId: string, listId: string): Promise<void> {
    await trelloFetch(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ idList: listId }),
    });
  },

  async addLabel(cardId: string, labelId: string): Promise<void> {
    await trelloFetch(`/cards/${cardId}/idLabels`, {
      method: 'POST',
      body: JSON.stringify({ value: labelId }),
    });
  },

  async updateChecklistItem(cardId: string, checkItemId: string, state: 'complete' | 'incomplete'): Promise<void> {
    await trelloFetch(`/cards/${cardId}/checkItem/${checkItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ state }),
    });
  },

  async getCardsInList(listId: string): Promise<TrelloCard[]> {
    return trelloFetch<TrelloCard[]>(`/lists/${listId}/cards?attachments=true&checklists=all&labels=true`);
  },

  async createCard(listId: string, name: string, desc: string, idLabels?: string[]): Promise<TrelloCard> {
    return trelloFetch<TrelloCard>('/cards', {
      method: 'POST',
      body: JSON.stringify({ idList: listId, name, desc, idLabels: idLabels ?? [] }),
    });
  },

  /** Tạo checklist trên card, trả về id checklist. */
  async addChecklist(cardId: string, name: string): Promise<string> {
    const res = await trelloFetch<{ id: string }>(`/cards/${cardId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return res.id;
  },

  /** Thêm 1 mục vào checklist, trả về id check-item. */
  async addCheckItem(checklistId: string, name: string): Promise<string> {
    const res = await trelloFetch<{ id: string }>(`/checklists/${checklistId}/checkItems`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return res.id;
  },

  async attachUrlToCard(cardId: string, url: string, name: string): Promise<void> {
    await trelloFetch(`/cards/${cardId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ url, name }),
    });
  },

  async downloadAttachment(attachment: TrelloAttachment): Promise<Buffer> {
    await throttle();
    const res = await fetch(attachment.url, {
      headers: { Authorization: `OAuth oauth_consumer_key="${config.TRELLO_API_KEY}", oauth_token="${config.TRELLO_API_TOKEN}"` },
    });
    if (!res.ok) throw new TrelloApiError(`Failed to download attachment: ${res.status}`, res.status);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  },

  async registerWebhook(callbackUrl: string, boardId: string): Promise<string> {
    const result = await trelloFetch<{ id: string }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ callbackURL: callbackUrl, idModel: boardId, description: 'AutoPilot agent webhook' }),
    });
    return result.id;
  },
};
