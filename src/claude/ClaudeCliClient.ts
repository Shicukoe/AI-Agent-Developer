import { existsSync } from 'fs';
import { execa } from 'execa';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import { makeStreamHandler } from './claudeStream.js';

const log = childLogger('claude-cli-client');

/** In output của Claude ra console theo thời gian thực, mỗi dòng có tiền tố nhận diện agent/task. */
function streamToConsole(chunk: string, tag: string, isErr = false): void {
  const out = isErr ? process.stderr : process.stdout;
  for (const line of chunk.split('\n')) {
    if (line.trim()) out.write(`  \x1b[2m${tag}\x1b[0m ${line}\n`);
  }
}

function resolveClaudeCli(): string {
  if (config.CLAUDE_CLI_PATH) return config.CLAUDE_CLI_PATH;
  const candidates = [
    `${process.env.APPDATA}\\npm\\claude.cmd`,
    `${process.env.APPDATA}\\npm\\claude`,
    'claude.cmd',
    'claude',
  ];
  for (const c of candidates) {
    if (c.includes('\\') && existsSync(c)) return c;
  }
  return 'claude';
}

/** Escape literal newlines/tabs inside JSON string values (common in Claude output). */
function sanitizeJson(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
    }
    out += ch;
  }
  return out;
}

function tryParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* try sanitized */ }
  return JSON.parse(sanitizeJson(raw));
}

function extractJson(text: string): unknown {
  // Try last ```json block (Claude often writes analysis then ends with JSON)
  const blocks = [...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g)];
  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1][1].trim();
    try { return tryParse(last); } catch { /* fall through to brace search */ }
  }
  // Fallback: find outermost { }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return tryParse(text.slice(first, last + 1)); } catch { /* fall through */ }
  }
  throw new Error(`No valid JSON in Claude CLI output:\n${text.slice(0, 500)}`);
}

export interface ClaudeCliOpts {
  allowedTools?: string[];
  cwd?: string;
  timeoutMs?: number;
  maxTurns?: number;
  label?: string;
  /** Truyền vào --model (vd 'opus'/'sonnet' hoặc id đầy đủ). Trống = model mặc định của CLI. */
  model?: string;
  /** Gọi mỗi khi có hoạt động (dòng output) — dùng để heartbeat task. */
  onActivity?: () => void;
}

export const ClaudeCliClient = {
  async run(prompt: string, opts?: ClaudeCliOpts): Promise<string> {
    const claudeExe = resolveClaudeCli();
    const timeoutMs = opts?.timeoutMs ?? 180000;
    const maxTurns = opts?.maxTurns ?? 8;

    // stream-json để lấy được token usage (result event) + vẫn stream chi tiết ra console.
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--max-turns', String(maxTurns),
    ];

    if (opts?.allowedTools && opts.allowedTools.length > 0) {
      args.push('--allowedTools', opts.allowedTools.join(','));
    }

    if (opts?.model && opts.model.trim()) {
      args.push('--model', opts.model.trim());
    }

    log.debug({ cwd: opts?.cwd, tools: opts?.allowedTools }, 'Spawning Claude CLI');
    const tag = `[claude${opts?.label ? ':' + opts.label : ''}]`;
    // `result` event = CLI đã xong việc. Claude CLI đôi khi KHÔNG tự thoát sau đó (treo tới timeout) →
    // nhận event này thì kết thúc ngay + kill tiến trình, tránh chờ vô ích / timeout sai.
    let resolveDone: (() => void) | null = null;
    const doneEvent = new Promise<'done'>(resolve => { resolveDone = () => resolve('done'); });
    const handler = makeStreamHandler(tag, opts?.label, opts?.onActivity, () => resolveDone?.());

    // Strip ANTHROPIC_API_KEY so Claude CLI uses its own stored credentials (~/.claude)
    const { ANTHROPIC_API_KEY: _unused, ...cleanEnv } = process.env;
    const proc = execa(claudeExe, args, {
      cwd: opts?.cwd ?? config.GIT_REPO_PATH,
      timeout: timeoutMs,
      input: prompt,
      env: cleanEnv,
    });
    proc.stdout?.on('data', (c: Buffer) => handler.feed(c.toString()));
    proc.stderr?.on('data', (c: Buffer) => {
      if (config.AGENT_VERBOSE) streamToConsole(c.toString(), tag, true);
    });

    try {
      const outcome = await Promise.race([proc.then(() => 'exit' as const), doneEvent]);
      handler.flush();
      if (outcome === 'done') {
        // CLI báo xong nhưng có thể còn treo → kill, nuốt lỗi do kill gây ra.
        proc.kill();
        proc.catch(() => { /* ignore: ta đã chủ động kill sau khi có kết quả */ });
      }
      return handler.result();
    } catch (err: unknown) {
      handler.flush();
      const e = err as { stderr?: string; exitCode?: number; timedOut?: boolean };
      // Lỗi/timeout NHƯNG đã có kết quả (event result tới trước khi crash) → vẫn dùng được.
      const partial = handler.result();
      if (partial) return partial;
      if (e.timedOut) throw new Error(`Claude CLI timed out after ${timeoutMs}ms`);
      throw new Error(`Claude CLI error (exit ${e.exitCode}): ${e.stderr?.slice(0, 300) ?? 'unknown'}`);
    }
  },

  async runForJson<T>(prompt: string, opts?: ClaudeCliOpts): Promise<T> {
    const jsonPrompt = `${prompt}\n\n---\nCRITICAL: End your response with a single JSON code block containing ONLY the structured result. No text after the code block.\n\`\`\`json\n{...your result here...}\n\`\`\``;
    const text = await this.run(jsonPrompt, opts);
    return extractJson(text) as T;
  },
};
