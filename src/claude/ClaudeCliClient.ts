import { existsSync } from 'fs';
import { execa } from 'execa';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('claude-cli-client');

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

export const ClaudeCliClient = {
  async run(prompt: string, opts?: {
    allowedTools?: string[];
    cwd?: string;
    timeoutMs?: number;
    maxTurns?: number;
  }): Promise<string> {
    const claudeExe = resolveClaudeCli();
    const timeoutMs = opts?.timeoutMs ?? 180000;
    const maxTurns = opts?.maxTurns ?? 8;

    const args = [
      '--print',
      '--output-format', 'text',
      '--max-turns', String(maxTurns),
    ];

    if (opts?.allowedTools && opts.allowedTools.length > 0) {
      args.push('--allowedTools', opts.allowedTools.join(','));
    }

    log.debug({ cwd: opts?.cwd, tools: opts?.allowedTools }, 'Spawning Claude CLI');

    try {
      // Strip ANTHROPIC_API_KEY so Claude CLI uses its own stored credentials (~/.claude)
      const { ANTHROPIC_API_KEY: _unused, ...cleanEnv } = process.env;
      const result = await execa(claudeExe, args, {
        cwd: opts?.cwd ?? config.GIT_REPO_PATH,
        timeout: timeoutMs,
        input: prompt,
        env: cleanEnv,
      });
      return result.stdout.trim();
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; exitCode?: number; timedOut?: boolean };
      if (e.timedOut) throw new Error(`Claude CLI timed out after ${timeoutMs}ms`);
      // Non-zero exit can still have valid stdout
      if (e.stdout?.trim()) return e.stdout.trim();
      throw new Error(`Claude CLI error (exit ${e.exitCode}): ${e.stderr?.slice(0, 300) ?? 'unknown'}`);
    }
  },

  async runForJson<T>(prompt: string, opts?: {
    allowedTools?: string[];
    cwd?: string;
    timeoutMs?: number;
    maxTurns?: number;
  }): Promise<T> {
    const jsonPrompt = `${prompt}\n\n---\nCRITICAL: End your response with a single JSON code block containing ONLY the structured result. No text after the code block.\n\`\`\`json\n{...your result here...}\n\`\`\``;
    const text = await this.run(jsonPrompt, opts);
    return extractJson(text) as T;
  },
};
