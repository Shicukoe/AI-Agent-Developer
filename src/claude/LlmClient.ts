import { config } from '../config.js';
import { ClaudeCliClient } from './ClaudeCliClient.js';
import { executeTool, TOOLS } from '../utils/ToolExecutor.js';
import { childLogger } from '../utils/logger.js';
import { TokenTracker } from '../utils/TokenTracker.js';
import { optimizeFirstMessage } from './promptOptimize.js';

const log = childLogger('llm-client');

export type LlmProvider = 'claude' | 'gemini' | 'openai';

// Helper to escape literal newlines/tabs inside JSON string values
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
  // Try last ```json block
  const blocks = [...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g)];
  if (blocks.length > 0) {
    const last = blocks[blocks.length - 1][1].trim();
    try { return tryParse(last); } catch { /* fall through */ }
  }
  // Fallback: find outermost { }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return tryParse(text.slice(first, last + 1)); } catch { /* fall through */ }
  }
  throw new Error(`No valid JSON in LLM output:\n${text.slice(0, 500)}`);
}

// optimizeFirstMessage được tách sang ./promptOptimize.ts (pure, test được không cần config).

async function callClaude(
  systemInstruction: string,
  messages: any[],
  apiKey: string,
  model: string,
  useTools: boolean
): Promise<any> {
  const url = 'https://api.anthropic.com/v1/messages';
  
  const formattedMessages = messages.map(m => {
    // Anthropic messages cannot have system role, and must follow user/assistant turns.
    return {
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || ''
    };
  });

  const body: any = {
    model: model === 'claude-sonnet-4-6' ? 'claude-3-5-sonnet-20241022' : model,
    messages: formattedMessages,
    max_tokens: config.CLAUDE_MAX_TOKENS || 4096,
    temperature: 0.1,
  };

  if (systemInstruction) {
    body.system = systemInstruction;
  }

  if (useTools) {
    body.tools = TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function callGemini(
  systemInstruction: string,
  messages: any[],
  apiKey: string,
  model: string,
  useTools: boolean
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const contents = messages.map(m => {
    if (m.parts) return { role: m.role, parts: m.parts };
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    };
  });

  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.1,
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (useTools) {
    body.tools = [{
      functionDeclarations: TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: Object.fromEntries(
            Object.entries(t.parameters.properties).map(([k, v]) => [
              k,
              { type: (v.type as string).toUpperCase(), description: v.description }
            ])
          ),
          required: t.parameters.required
        }
      }))
    }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function callOpenAi(
  systemInstruction: string,
  messages: any[],
  apiKey: string,
  model: string,
  useTools: boolean,
  baseUrl?: string
): Promise<any> {
  const url = baseUrl || 'https://api.openai.com/v1/chat/completions';
  
  const formattedMessages = [];
  if (systemInstruction) {
    formattedMessages.push({ role: 'system', content: systemInstruction });
  }
  
  for (const m of messages) {
    formattedMessages.push({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content || '',
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
    });
  }

  const body: any = {
    model,
    messages: formattedMessages,
    temperature: 0.1,
  };

  if (useTools) {
    body.tools = TOOLS.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export const LlmClient = {
  async run(prompt: string, provider: LlmProvider, opts?: {
    allowedTools?: string[];
    cwd?: string;
    timeoutMs?: number;
    maxTurns?: number;
    label?: string;
    /** Override model id (API) / --model (CLI) cho riêng call này. Trống = model mặc định của provider. */
    model?: string;
  }): Promise<string> {
    const cwd = opts?.cwd ?? config.GIT_REPO_PATH;
    const maxTurns = opts?.maxTurns ?? 10;
    const label = opts?.label ?? 'agent';
    const useTools = opts?.allowedTools && opts.allowedTools.length > 0;
    const tag = `[${provider}${opts?.label ? ':' + opts.label : ''}]`;

    if (provider === 'claude') {
      const apiKey = config.ANTHROPIC_API_KEY;
      if (!apiKey || apiKey === 'not-configured' || apiKey.trim() === '') {
        // Fallback to CLI
        return ClaudeCliClient.run(prompt, opts);
      }
      
      const model = opts?.model ?? config.CLAUDE_MODEL;
      const messages: any[] = [{ role: 'user', content: prompt }];
      let turn = 0;

      while (turn < maxTurns) {
        log.info({ label, turn }, `Calling Claude API (${model})`);

        // OPTIMIZATION: Filter large project conventions and truncate older tool output from history
        const optimizedMessages = messages.map((m, idx) => {
          // Turn 0: gửi ĐẦY ĐỦ quy ước. Turn 1+: lược bỏ để khỏi lặp token.
          if (idx === 0 && turn > 0 && config.OPTIMIZE_HISTORY) {
            if (typeof m.content === 'string') {
              return { ...m, content: optimizeFirstMessage(m.content) };
            }
          }

          // Truncate older tool outputs
          if (m.role === 'user' && Array.isArray(m.content) && idx < messages.length - 1) {
            const newContent = m.content.map((c: any) => {
              if (c.type === 'tool_result' && typeof c.content === 'string') {
                const result = c.content;
                if (result.length > 2000) {
                  return {
                    ...c,
                    content: `[Tool output truncated for token optimization. Length: ${result.length} chars. Recall the tool if you need to read this content again.]`
                  };
                }
              }
              return c;
            });
            return { ...m, content: newContent };
          }
          return m;
        });

        const responseData = await callClaude('', optimizedMessages, apiKey, model, !!useTools);
        
        // Token usage → gom theo task (TokenTracker tự in per-call + tổng task khi AGENT_VERBOSE)
        const usage = responseData.usage;
        if (usage) {
          TokenTracker.record(label, usage.input_tokens || 0, usage.output_tokens || 0);
        }

        const assistantContent = responseData.content;
        const textBlock = assistantContent.find((b: any) => b.type === 'text');
        const textContent = textBlock?.text?.trim() || '';

        if (textContent && config.AGENT_VERBOSE) {
          for (const line of textContent.split('\n')) {
            if (line.trim()) process.stdout.write(`  \x1b[2m${tag}\x1b[0m ${line}\n`);
          }
        }

        const toolUses = assistantContent.filter((b: any) => b.type === 'tool_use');
        if (toolUses && toolUses.length > 0) {
          messages.push({
            role: 'assistant',
            content: assistantContent
          });

          const responseParts = [];
          for (const call of toolUses) {
            const toolName = call.name;
            const args = call.input;
            const toolUseId = call.id;

            if (config.AGENT_VERBOSE) {
              process.stdout.write(`  \x1b[2m${tag} tool-use\x1b[0m Call tool: ${toolName} with ${JSON.stringify(args)}\n`);
            }

            const result = executeTool(cwd, toolName, args);

            if (config.AGENT_VERBOSE) {
              const preview = result.length > 150 ? result.slice(0, 150) + '...' : result;
              process.stdout.write(`  \x1b[2m${tag} tool-result\x1b[0m Tool output: ${preview.replace(/\n/g, ' ')}\n`);
            }

            responseParts.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: result
            });
          }

          messages.push({
            role: 'user',
            content: responseParts
          });

          turn++;
        } else {
          return textContent;
        }
      }
      throw new Error(`Claude exceeded max turns (${maxTurns})`);
    }

    if (provider === 'gemini') {
      const apiKey = config.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in .env');
      }
      const model = opts?.model ?? config.GEMINI_MODEL;
      const messages: any[] = [{ role: 'user', content: prompt }];
      let turn = 0;

      while (turn < maxTurns) {
        log.info({ label, turn }, `Calling Gemini (${model})`);

        // OPTIMIZATION: Filter large project conventions and truncate older tool output from history
        const optimizedMessages = messages.map((m, idx) => {
          // Turn 0: gửi ĐẦY ĐỦ quy ước. Turn 1+: lược bỏ để khỏi lặp token.
          if (idx === 0 && turn > 0 && config.OPTIMIZE_HISTORY) {
            if (m.content) {
              return { ...m, content: optimizeFirstMessage(m.content) };
            }
          }

          // Truncate older tool outputs
          if (m.role === 'user' && m.parts && idx < messages.length - 1) {
            const newParts = m.parts.map((p: any) => {
              if (p.functionResponse?.response?.result) {
                const result = p.functionResponse.response.result;
                if (result.length > 2000) {
                  return {
                    functionResponse: {
                      name: p.functionResponse.name,
                      response: {
                        result: `[Tool output truncated for token optimization. Length: ${result.length} chars. Recall the tool if you need to read this content again.]`
                      }
                    }
                  };
                }
              }
              return p;
            });
            return { role: m.role, parts: newParts };
          }
          return m;
        });

        const responseData = await callGemini('', optimizedMessages, apiKey, model, !!useTools);
        
        // Token usage → gom theo task
        const usage = responseData.usageMetadata;
        if (usage) {
          TokenTracker.record(label, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
        }
        const candidate = responseData.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (!part) {
          throw new Error('No content returned from Gemini');
        }

        // If model wants to output text
        const textContent = candidate.content.parts.map((p: any) => p.text || '').join('').trim();
        if (textContent && config.AGENT_VERBOSE) {
          for (const line of textContent.split('\n')) {
            if (line.trim()) process.stdout.write(`  \x1b[2m${tag}\x1b[0m ${line}\n`);
          }
        }

        const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
        if (functionCalls && functionCalls.length > 0) {
          // Record model turn in conversation history
          messages.push({
            role: 'model',
            parts: candidate.content.parts
          });

          const responseParts = [];
          for (const call of functionCalls) {
            const toolName = call.functionCall.name;
            const args = call.functionCall.args;
            
            if (config.AGENT_VERBOSE) {
              process.stdout.write(`  \x1b[2m${tag} tool-use\x1b[0m Call tool: ${toolName} with ${JSON.stringify(args)}\n`);
            }

            const result = executeTool(cwd, toolName, args);

            if (config.AGENT_VERBOSE) {
              const preview = result.length > 150 ? result.slice(0, 150) + '...' : result;
              process.stdout.write(`  \x1b[2m${tag} tool-result\x1b[0m Tool output: ${preview.replace(/\n/g, ' ')}\n`);
            }

            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { result }
              }
            });
          }

          messages.push({
            role: 'user',
            parts: responseParts
          });

          turn++;
        } else {
          // Finished generating
          return textContent;
        }
      }
      throw new Error(`Gemini exceeded max turns (${maxTurns})`);
    }

    if (provider === 'openai') {
      const apiKey = config.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured in .env');
      }
      const model = opts?.model ?? config.OPENAI_MODEL;
      const baseUrl = config.OPENAI_BASE_URL;
      const messages: any[] = [{ role: 'user', content: prompt }];
      let turn = 0;

      while (turn < maxTurns) {
        log.info({ label, turn }, `Calling OpenAI (${model})`);

        // OPTIMIZATION: Filter large project conventions and truncate older tool output from history
        const optimizedMessages = messages.map((m, idx) => {
          // Turn 0: gửi ĐẦY ĐỦ quy ước. Turn 1+: lược bỏ để khỏi lặp token.
          if (idx === 0 && turn > 0 && config.OPTIMIZE_HISTORY) {
            if (m.content) {
              return { ...m, content: optimizeFirstMessage(m.content) };
            }
          }

          // Truncate older tool outputs
          if (m.role === 'tool' && m.content && idx < messages.length - 1) {
            const result = m.content;
            if (result.length > 2000) {
              return {
                ...m,
                content: `[Tool output truncated for token optimization. Length: ${result.length} chars. Recall the tool if you need to read this content again.]`
              };
            }
          }
          return m;
        });

        const responseData = await callOpenAi('', optimizedMessages, apiKey, model, !!useTools, baseUrl);
        
        // Token usage → gom theo task
        const usage = responseData.usage;
        if (usage) {
          TokenTracker.record(label, usage.prompt_tokens || 0, usage.completion_tokens || 0);
        }
        const choice = responseData.choices?.[0];
        const msg = choice?.message;

        if (!msg) {
          throw new Error('No message returned from OpenAI');
        }

        const textContent = (msg.content || '').trim();
        if (textContent && config.AGENT_VERBOSE) {
          for (const line of textContent.split('\n')) {
            if (line.trim()) process.stdout.write(`  \x1b[2m${tag}\x1b[0m ${line}\n`);
          }
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          messages.push(msg);

          for (const call of msg.tool_calls) {
            const toolName = call.function.name;
            const args = JSON.parse(call.function.arguments);

            if (config.AGENT_VERBOSE) {
              process.stdout.write(`  \x1b[2m${tag} tool-use\x1b[0m Call tool: ${toolName} with ${JSON.stringify(args)}\n`);
            }

            const result = executeTool(cwd, toolName, args);

            if (config.AGENT_VERBOSE) {
              const preview = result.length > 150 ? result.slice(0, 150) + '...' : result;
              process.stdout.write(`  \x1b[2m${tag} tool-result\x1b[0m Tool output: ${preview.replace(/\n/g, ' ')}\n`);
            }

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: toolName,
              content: result
            });
          }

          turn++;
        } else {
          return textContent;
        }
      }
      throw new Error(`OpenAI exceeded max turns (${maxTurns})`);
    }

    throw new Error(`Unsupported provider: ${provider}`);
  },

  async runForJson<T>(prompt: string, provider: LlmProvider, opts?: {
    allowedTools?: string[];
    cwd?: string;
    timeoutMs?: number;
    maxTurns?: number;
    label?: string;
    model?: string;
  }): Promise<T> {
    // Lần 1 đã siết để model engage + chỉ trả JSON (tránh kiểu "chào rồi dừng") → thường đậu ngay 1 lần.
    const jsonPrompt = `${prompt}\n\n---\n` +
      `QUAN TRỌNG: TUYỆT ĐỐI không viết lời chào/mở đầu/giải thích ("Tôi sẽ…", "Được rồi…"). ` +
      `Nếu cần, dùng tool (Read/Glob/Grep) để kiểm tra trước, RỒI kết thúc câu trả lời bằng DUY NHẤT một ` +
      `khối JSON hợp lệ — không có bất kỳ chữ nào trước hay sau khối đó:\n\`\`\`json\n{...kết quả...}\n\`\`\``;
    // Lưới an toàn: nếu lần 1 vẫn thiếu JSON (CLI thi thoảng trả thiếu) → thử LẠI 1 lần với nhắc gắt hơn.
    // Tối đa 2 lần; không lặp vô hạn để giữ tốc độ/chi phí.
    const retryPrompt = `${prompt}\n\n---\nLƯU Ý: Trả lời trước của bạn THIẾU khối JSON nên KHÔNG dùng được. ` +
      `KHÔNG chào hỏi/giải thích. Dùng tool nếu cần, rồi KẾT THÚC bằng DUY NHẤT một khối \`\`\`json {...} \`\`\` — không chữ nào sau đó.`;
    let lastText = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      lastText = await this.run(attempt === 1 ? jsonPrompt : retryPrompt, provider, opts);
      try {
        return extractJson(lastText) as T;
      } catch {
        log.warn({ provider, label: opts?.label, attempt, preview: lastText.slice(0, 120) },
          'runForJson: output thiếu JSON' + (attempt < 2 ? ' — thử lại lần cuối' : ' — hết lượt'));
      }
    }
    throw new Error(`No valid JSON in LLM output (sau 2 lần thử):\n${lastText.slice(0, 200)}`);
  }
};
