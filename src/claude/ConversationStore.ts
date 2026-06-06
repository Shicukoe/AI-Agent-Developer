import { ConversationRepository } from '../state/ConversationRepository.js';
import type Anthropic from '@anthropic-ai/sdk';

export const ConversationStore = {
  append(taskId: string, role: 'user' | 'assistant', content: string, tokens?: number): void {
    ConversationRepository.append(taskId, role, content, tokens);
  },

  // Build Anthropic MessageParam array from stored history
  toMessages(taskId: string): Anthropic.MessageParam[] {
    const history = ConversationRepository.getHistory(taskId);
    return history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
  },

  // Get last N messages as Anthropic MessageParams
  toRecentMessages(taskId: string, n: number): Anthropic.MessageParam[] {
    const history = ConversationRepository.getLastN(taskId, n);
    return history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
  },
};
