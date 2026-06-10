import { config } from '../config.js';
import { TokenTracker } from '../utils/TokenTracker.js';

/**
 * Parser cho output `--output-format stream-json --verbose` của Claude CLI.
 * - Stream text/tool-use ra console (khi AGENT_VERBOSE) và gọi onActivity (cho heartbeat).
 * - Bắt `result` event để lấy text cuối + usage (token) → ghi vào TokenTracker.
 * Dùng chung cho ClaudeCliClient và DevAgent để khỏi lặp logic.
 */
export interface StreamHandler {
  feed(chunk: string): void;
  flush(): void;
  result(): string;
}

function printLines(text: string, tag: string, isErr = false): void {
  const out = isErr ? process.stderr : process.stdout;
  for (const line of text.split('\n')) {
    if (line.trim()) out.write(`  \x1b[2m${tag}\x1b[0m ${line}\n`);
  }
}

export function makeStreamHandler(tag: string, label?: string, onActivity?: () => void): StreamHandler {
  let buffer = '';
  let finalText = '';
  let collected = '';

  const handleLine = (line: string): void => {
    let ev: any;
    try { ev = JSON.parse(line); } catch { return; }   // bỏ qua dòng không phải JSON
    onActivity?.();

    if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) {
      for (const b of ev.message.content) {
        if (b.type === 'text' && b.text) {
          collected += b.text + '\n';
          if (config.AGENT_VERBOSE) printLines(b.text, tag);
        } else if (b.type === 'tool_use' && config.AGENT_VERBOSE) {
          const args = JSON.stringify(b.input ?? {}).slice(0, 120);
          process.stdout.write(`  \x1b[2m${tag} tool\x1b[0m ${b.name} ${args}\n`);
        }
      }
    } else if (ev.type === 'result') {
      if (typeof ev.result === 'string') finalText = ev.result;
      const u = ev.usage;
      if (u) {
        const input = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        const output = u.output_tokens ?? 0;
        TokenTracker.record(label, input, output, ev.total_cost_usd ?? 0);
      }
    }
  };

  return {
    feed(chunk: string): void {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handleLine(line);
      }
    },
    flush(): void {
      const rest = buffer.trim();
      buffer = '';
      if (rest) handleLine(rest);
    },
    result(): string {
      return (finalText || collected).trim();
    },
  };
}
