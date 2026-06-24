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
  // List "cửa trước": làm rõ & chuẩn hoá task sơ sài trước khi sang Planning/Dev.
  TRELLO_REFINE_LIST_NAMES: csv('Refine'),
  TRELLO_PLANNING_LIST_NAMES: csv('Planning'),
  TRELLO_DEV_LIST_NAMES: csv('Dev'),
  TRELLO_TEST_LIST_NAMES: csv('Test'),
  TRELLO_INFO_LIST_NAMES: csv('Info'),
  // List đích cho card tài liệu do DocCardExecutor sinh ra (fallback: Info list, rồi list nguồn).
  TRELLO_DOCS_LIST_NAMES: csv('Docs'),
  // Label name that triggers the agent (case-insensitive). Create this label on your board.
  TRELLO_AI_LABEL_NAME: z.string().default('AI'),
  // Label người dùng gắn để chốt plan ở stage Planning.
  TRELLO_PLAN_APPROVE_LABEL_NAME: z.string().default('plan approve'),
  // Nhãn BẬT bước "BA kỹ thuật" (TechnicalRefiner). MẶC ĐỊNH refine chỉ chạy BA nghiệp vụ; chỉ khi card
  // có nhãn này mới thêm phân tích kỹ thuật + tiêu chí/test_cases kỹ thuật. Tránh test fail oan vì spec kỹ thuật.
  TRELLO_TECH_REFINE_LABEL_NAME: z.string().default('BA kỹ thuật'),
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

  // Model Routing
  MODEL_REFINE: z.enum(['claude', 'gemini', 'openai']).default('claude'),
  MODEL_PLANNING: z.enum(['claude', 'gemini', 'openai']).default('claude'),
  MODEL_DEV: z.enum(['claude', 'gemini', 'openai']).default('claude'),
  MODEL_TEST: z.enum(['claude', 'gemini', 'openai']).default('claude'),
  // Triage (phát hiện task tí hon — rẻ, chỉ đọc text card) và Indexer (dựng cache hiểu dự án).
  MODEL_TRIAGE: z.enum(['claude', 'gemini', 'openai']).default('claude'),
  MODEL_INDEXER: z.enum(['claude', 'gemini', 'openai']).default('claude'),
  // Model cụ thể theo khâu (API: id; CLI: --model). Triage rẻ → Haiku; lập kế hoạch EPIC (lớn) → Opus.
  // MỖI KHÂU đổi model độc lập. TRỐNG = dùng model mặc định của provider khâu đó (CLAUDE_MODEL/GEMINI_MODEL/
  // OPENAI_MODEL). Model phải KHỚP provider của khâu (MODEL_* ): vd đặt MODEL_REFINE=gemini thì REFINE_MODEL
  // nên là id gemini; nếu để id Claude khi provider=gemini, hệ sẽ TỰ dùng GEMINI_MODEL (không gửi nhầm id).
  TRIAGE_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  EPIC_MODEL: z.string().default('claude-opus-4-8'),
  REFINE_MODEL: z.string().default(''),    // BA + Technical Refiner (provider = MODEL_REFINE)
  PLANNING_MODEL: z.string().default(''),  // Planning thường (provider = MODEL_PLANNING); Epic dùng EPIC_MODEL
  DEV_MODEL: z.string().default(''),       // Dev khi provider ≠ claude (provider = MODEL_DEV; claude → Claude CLI)

  // Toggle lược bỏ quy ước lặp (CLAUDE.md/overview) ở Turn 1+ để tiết kiệm token.
  // Đặt false để TẮT (A/B test so sánh token).
  OPTIMIZE_HISTORY: bool(true),

  // gen-docs: tài liệu CHI TIẾT (thay cho việc đọc cả repo) → khảo sát + ghi nhiều → để timeout rộng (20 phút).
  GEN_DOCS_TIMEOUT_MS: num(1200000),
  // gen-docs là việc agentic ĐỌC NHIỀU + GHI NHIỀU FILE chi tiết → cần nhiều lượt tool (CLI mặc định chỉ 8 =
  // quá ít, agent hết lượt trước khi kịp ghi → docs/ rỗng). Để rộng cho tài liệu sâu + sơ đồ.
  GEN_DOCS_MAX_TURNS: num(120),
  // gen-docs (đọc repo + VIẾT tài liệu) là khâu QUAN TRỌNG → dùng model NẶNG (Opus). API: id model; CLI: --model.
  DOCS_MODEL: z.string().default('claude-opus-4-8'),
  // gen-docs --deepen: feature doc NHỎ HƠN ngưỡng (byte) coi là "mỏng" → viết lại SÂU; file lớn hơn giữ nguyên.
  GEN_DOCS_DEEPEN_MIN_BYTES: num(6000),
  // Nhãn cho task "làm luôn" — ép fast-path thẳng Dev, bỏ refine/plan.
  TRELLO_QUICK_LABEL_NAME: z.string().default('quick'),

  // Gemini API
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  // OpenAI API
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().optional(),

  // Queue
  QUEUE_BACKEND: z.enum(['memory', 'redis']).default('memory'),
  // Số card chạy SONG SONG trong MỖI worker (mỗi repo = 1 worker). Tổng toàn hệ = giá trị này × số repo.
  // Nâng lên để chạy nhiều card cùng lúc (refine + test + dev song song). Thao tác git được khóa theo repo.
  QUEUE_CONCURRENCY: num(5),
  REDIS_URL: z.string().optional(),

  // Git
  GIT_REPO_PATH: z.string().min(1),
  GIT_WORKTREE_BASE: z.string().min(1),
  GIT_DEFAULT_BASE_BRANCH: z.string().default('dev'),
  // Override toàn cục đường dẫn docs dự án (mặc định <repo>/docs nếu trống).
  PROJECT_DOCS_PATH: z.string().optional(),
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
  // Refine (BA/Tech/DocCard) đọc code repo lớn có thể >180s → cho timeout rộng hơn (mặc định 5 phút).
  REFINE_TIMEOUT_MS: num(300000),
  // Test/Review: model NẶNG cho task khó (review xác minh code). Trống = dùng CLAUDE_MODEL.
  // API: id model (vd 'claude-opus-4-8'); CLI: tên truyền vào --model.
  REVIEW_MODEL: z.string().optional(),
  REVIEW_MAX_TURNS: num(25),       // reviewer đọc code trong ngữ cảnh để xác minh → cần nhiều lượt tool
  REVIEW_TIMEOUT_MS: num(420000),  // 7 phút
  // Kéo-thả/Branch LẦN ĐẦU (chưa có mốc): chỉ review commit của N NGÀY mới nhất trên nhánh thay vì cả dải
  // base...branch (tránh diff khổng lồ → chậm/tốn token). Dev muốn rộng hơn thì ghi `Base:`/`Range:` trong card.
  REVIEW_AUTODETECT_DAYS: num(1),

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

  // Stream output thật của Claude (đọc/ghi file, suy luận) ra console theo thời gian thực.
  // true = thấy chi tiết agent đang làm gì; false = chỉ thấy status.
  AGENT_VERBOSE: bool(true),

  // Admin backend (API + UI tích hợp, chạy chung process với agent)
  ADMIN_PORT: num(3457),
  // Token tĩnh cho admin API. Để trống = TẮT admin server (an toàn mặc định).
  ADMIN_API_TOKEN: z.string().optional(),
  // Chỉ bind localhost mặc định; đổi thành 0.0.0.0 nếu muốn truy cập từ máy khác (nhớ đặt token mạnh).
  ADMIN_BIND_HOST: z.string().default('127.0.0.1'),

  // Gói thuê bao (subscription) — để admin tính "giá ĐÚNG" theo phí cố định thay vì giá API/token.
  // Claude Max 5x = $100/tháng CỐ ĐỊNH (không tính theo token; giới hạn = cửa sổ trượt 5h + trần tuần).
  // USAGE_PLAN_MONTHLY_USD > 0 → admin hiện "giá hiệu dụng/1M = phí ÷ token thực dùng" + so với API quy đổi.
  // Đặt = 0 nếu bạn trả theo token (pay-as-you-go API) → admin chỉ hiện giá API quy đổi như cũ.
  // ── Cửa sổ "session" rolling của gói (Claude Max = 5 giờ) ──
  // Nguồn CHÍNH: ccusage (đọc transcript ~/.claude — cùng dữ liệu /usage dùng, read-only, không proxy) →
  // lấy block 5h đang chạy: token + thời gian còn lại + burn rate. `/usage` slash không script được nên dùng nó.
  CCUSAGE_ENABLED: bool(true),
  // Lệnh chạy ccusage (đổi nếu cài global: 'ccusage'). Mặc định npx tự tải bản mới.
  CCUSAGE_CMD: z.string().default('npx -y ccusage@latest'),
  USAGE_SESSION_HOURS: num(5),
  // Trần token quy %. 0 = TỰ HIỆU CHỈNH theo block 5h cao nhất từ trước (giống ccusage -t max). >0 = ép trần này.
  USAGE_SESSION_LIMIT_TOKENS: num(0),

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
  if (inList(config.TRELLO_REFINE_LIST_NAMES)) return 'refine';
  if (inList(config.TRELLO_PLANNING_LIST_NAMES)) return 'planning';
  if (inList(config.TRELLO_DEV_LIST_NAMES)) return 'dev';
  if (inList(config.TRELLO_TEST_LIST_NAMES)) return 'test';
  return null;
}

/** Id của list Planning đầu tiên trên board (nơi đặt card con do epic sinh ra). */
export function firstPlanningListName(): string {
  return config.TRELLO_PLANNING_LIST_NAMES[0] ?? 'Planning';
}

/** Tên list Refine đầu tiên (cửa trước làm rõ task). */
export function firstRefineListName(): string {
  return config.TRELLO_REFINE_LIST_NAMES[0] ?? 'Refine';
}

/** Card info list name for board setup and instructions. */
export function firstInfoListName(): string {
  return config.TRELLO_INFO_LIST_NAMES[0] ?? 'Info';
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

/** Card có nhãn bật BA kỹ thuật (TechnicalRefiner) không? Không có → refine chỉ chạy BA nghiệp vụ. */
export function hasTechRefineLabel(labels: Array<{ name: string }>): boolean {
  return hasLabelNamed(labels, config.TRELLO_TECH_REFINE_LABEL_NAME);
}

/** Card có nhãn "làm luôn" (quick) — ép fast-path thẳng Dev không? */
export function hasQuickLabel(labels: Array<{ name: string }>): boolean {
  return hasLabelNamed(labels, config.TRELLO_QUICK_LABEL_NAME);
}
