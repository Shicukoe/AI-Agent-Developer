import { z } from 'zod';
import type { Stage } from './trello/types.js';

const csv = (def: string) => z.string().default(def).transform(s => s.split(',').map(v => v.trim()).filter(Boolean));
const num = (def: number) => z.coerce.number().default(def);
const bool = (def: boolean) => z.string().default(String(def)).transform(s => s === 'true');

const schema = z.object({
  // Trello
  TRELLO_API_KEY: z.string().min(1),
  TRELLO_API_TOKEN: z.string().min(1),
  TRELLO_BOARD_IDS: csv(''),
  // Stage lists — card được route theo list nó đang nằm. Tên list khớp không phân biệt hoa thường.
  // List chứa card "epic" (feature lớn): agent lập plan rồi sinh card con khi được chốt.
  TRELLO_EPIC_LIST_NAMES: csv('Epic'),
  TRELLO_PLANNING_LIST_NAMES: csv('Planning'),
  TRELLO_DEV_LIST_NAMES: csv('Dev'),
  TRELLO_TEST_LIST_NAMES: csv('Test'),
  // Label name that triggers the agent (case-insensitive). Create this label on your board.
  TRELLO_AI_LABEL_NAME: z.string().default('AI'),
  // Label người dùng gắn để chốt plan ở stage Planning.
  TRELLO_PLAN_APPROVE_LABEL_NAME: z.string().default('plan approve'),
  ADMIN_TRELLO_MEMBER_IDS: csv(''),

  // Webhook vs Polling
  TRELLO_USE_WEBHOOK: bool(false),
  TRELLO_WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_PORT: num(3456),
  WEBHOOK_PATH: z.string().default('/webhook/trello'),
  POLL_INTERVAL_MS: num(30000),

  // Claude — optional: only needed if using Anthropic SDK directly. ClaudeCliClient doesn't need this.
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-6'),
  CLAUDE_MAX_TOKENS: num(8096),
  CLAUDE_MAX_TURNS_PER_TASK: num(20),

  // Queue
  QUEUE_BACKEND: z.enum(['memory', 'redis']).default('memory'),
  QUEUE_CONCURRENCY: num(3),
  REDIS_URL: z.string().optional(),

  // Git
  GIT_REPO_PATH: z.string().min(1),
  GIT_WORKTREE_BASE: z.string().min(1),
  GIT_DEFAULT_BASE_BRANCH: z.string().default('dev'),
  GIT_USER_NAME: z.string().default('AI Agent'),
  GIT_USER_EMAIL: z.string().default('ai-agent@local'),
  GITLAB_TOKEN: z.string().optional(),

  // Agent behavior
  MAX_SUBTASKS_PARALLEL: num(3),
  MAX_DEV_RETRY_ATTEMPTS: num(2),
  PLAN_APPROVAL_TIMEOUT_HOURS: num(48),
  MAX_TASK_PROCESSING_MINUTES: num(30),
  // Planning stage — thời gian tối đa cho 1 lần lập plan (ms) và số lượt tool tối đa
  PLANNING_TIMEOUT_MS: num(600000),
  PLANNING_MAX_TURNS: num(30),

  // Risk
  RISK_MAX_ACTIONS_PER_TASK: num(20),
  RISK_MAX_COMMENTS_PER_TASK: num(10),
  RISK_MAX_CARD_MOVES_PER_TASK: num(2),
  RISK_FORBIDDEN_LIST_IDS: csv(''),

  // Confirmation
  CONFIRMATION_TIMEOUT_HOURS: num(24),
  CONFIRMATION_MAX_REMINDERS: num(2),

  // Shell
  SHELL_COMMAND_ALLOWLIST: csv('git,node,npm,npx,tsc,eslint'),
  SHELL_TIMEOUT_MS: num(120000),

  // Claude CLI (for DevAgent subprocess mode)
  // Leave empty to auto-detect from PATH or common install locations
  CLAUDE_CLI_PATH: z.string().optional(),

  // General
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  DATA_DIR: z.string().default('./data'),
});

function loadConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`[config] Missing or invalid environment variables:\n${missing}`);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;

/** Map một tên list Trello sang stage tương ứng, hoặc null nếu không phải stage list. */
export function stageForListName(listName: string): Stage | null {
  const upper = listName.toUpperCase();
  const inList = (names: string[]) => names.map(n => n.toUpperCase()).includes(upper);
  if (inList(config.TRELLO_EPIC_LIST_NAMES)) return 'epic';
  if (inList(config.TRELLO_PLANNING_LIST_NAMES)) return 'planning';
  if (inList(config.TRELLO_DEV_LIST_NAMES)) return 'dev';
  if (inList(config.TRELLO_TEST_LIST_NAMES)) return 'test';
  return null;
}

/** Id của list Planning đầu tiên trên board (nơi đặt card con do epic sinh ra). */
export function firstPlanningListName(): string {
  return config.TRELLO_PLANNING_LIST_NAMES[0] ?? 'Planning';
}

/** Card có nhãn tên cụ thể không (so khớp không phân biệt hoa thường)? */
export function hasLabelNamed(labels: Array<{ name: string }>, name: string): boolean {
  return labels.some(l => l.name.toLowerCase() === name.toLowerCase());
}

/** Card có nhãn bật agent (AI) không? */
export function hasAiLabel(labels: Array<{ name: string }>): boolean {
  return hasLabelNamed(labels, config.TRELLO_AI_LABEL_NAME);
}

/** Card có nhãn chốt plan (plan approve) không? */
export function hasPlanApproveLabel(labels: Array<{ name: string }>): boolean {
  return hasLabelNamed(labels, config.TRELLO_PLAN_APPROVE_LABEL_NAME);
}
