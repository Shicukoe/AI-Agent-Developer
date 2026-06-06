import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { ClaudeApiError } from '../utils/errors.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('claude');

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY ?? 'not-configured' });

export type MessageContent = Anthropic.MessageParam['content'];

export interface ChatOptions {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Messages.Tool[];
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  toolUse?: Anthropic.ToolUseBlock;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export const ClaudeClient = {
  async chat(opts: ChatOptions): Promise<ChatResult> {
    const { system, messages, tools, maxTokens = config.CLAUDE_MAX_TOKENS } = opts;
    log.debug({ messages: messages.length, model: config.CLAUDE_MODEL }, 'Calling Claude');

    try {
      const response = await client.messages.create({
        model: config.CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        messages,
        ...(tools ? { tools } : {}),
      });

      const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined;
      const toolBlock = response.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;

      return {
        content: textBlock?.text ?? '',
        toolUse: toolBlock,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason ?? 'end_turn',
      };
    } catch (err) {
      log.error({ err }, 'Claude API error');
      throw new ClaudeApiError(`Claude API failed: ${(err as Error).message}`);
    }
  },

  // Convenience: expect tool_use response and parse its input
  async chatWithTool<T>(opts: ChatOptions & { toolName: string }): Promise<T> {
    const result = await this.chat(opts);
    if (!result.toolUse || result.toolUse.name !== opts.toolName) {
      throw new ClaudeApiError(`Expected tool_use '${opts.toolName}' but got: ${result.stopReason}`);
    }
    return result.toolUse.input as T;
  },

  // Vision: build image content block from buffer
  imageContent(buffer: Buffer, mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'): Anthropic.ImageBlockParam {
    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
    };
  },
};
