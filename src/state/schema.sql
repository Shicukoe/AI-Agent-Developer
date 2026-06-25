-- Tasks: one row per Trello card being processed
CREATE TABLE IF NOT EXISTS tasks (
  id                TEXT PRIMARY KEY,
  card_id           TEXT NOT NULL UNIQUE,
  board_id          TEXT NOT NULL,
  list_id           TEXT NOT NULL,
  card_name         TEXT NOT NULL,
  task_type         TEXT NOT NULL DEFAULT 'small', -- small | large
  status            TEXT NOT NULL DEFAULT 'queued',
  -- queued | processing | paused_for_confirmation | paused_for_plan_approval
  -- waiting_review | completed | failed | halted
  parent_task_id    TEXT REFERENCES tasks(id),
  branch_name       TEXT,
  worktree_path     TEXT,
  plan_file_path    TEXT,
  actions_taken     INTEGER NOT NULL DEFAULT 0,
  turns_taken       INTEGER NOT NULL DEFAULT 0,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  rule_decision     TEXT,   -- JSON snapshot
  error_message     TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  completed_at      INTEGER,
  heartbeat_at      INTEGER,
  metadata          TEXT,   -- JSON blob
  repo_key          TEXT,   -- khoá repo (đa-repo, map theo board)
  repo_path         TEXT    -- đường dẫn repo của task
);

CREATE INDEX IF NOT EXISTS idx_tasks_card_id ON tasks(card_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent  ON tasks(parent_task_id);

-- Sub-tasks under a large task
CREATE TABLE IF NOT EXISTS sub_tasks (
  id              TEXT PRIMARY KEY,
  parent_task_id  TEXT NOT NULL REFERENCES tasks(id),
  trello_card_id  TEXT,
  title           TEXT NOT NULL,
  sequence        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  branch_name     TEXT,
  worktree_path   TEXT,
  review_result   TEXT,   -- JSON ReviewResult
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sub_tasks_parent ON sub_tasks(parent_task_id);

-- Per-task Claude conversation history
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  turn        INTEGER NOT NULL,
  role        TEXT NOT NULL,   -- user | assistant
  content     TEXT NOT NULL,
  token_count INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_task ON conversations(task_id, turn);

-- Confirmation/approval requests pending admin response
CREATE TABLE IF NOT EXISTS confirmation_requests (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  request_type    TEXT NOT NULL DEFAULT 'action', -- action | plan_approval
  question        TEXT NOT NULL,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | modified | timed_out
  created_at      INTEGER NOT NULL,
  resolved_at     INTEGER,
  resolved_by     TEXT,   -- Trello member ID
  response        TEXT,
  reminders_sent  INTEGER NOT NULL DEFAULT 0
);

-- Rule evaluation audit log (append-only)
CREATE TABLE IF NOT EXISTS rule_evaluations (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  decision     TEXT NOT NULL,  -- JSON RuleDecision
  evaluated_at INTEGER NOT NULL
);

-- Git operations audit log (append-only)
CREATE TABLE IF NOT EXISTS git_operations (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL,
  operation    TEXT NOT NULL,  -- create_branch | commit | merge | push | worktree_add | worktree_remove
  branch       TEXT,
  commit_hash  TEXT,
  output       TEXT,
  executed_at  INTEGER NOT NULL
);

-- Review results per task/sub-task
CREATE TABLE IF NOT EXISTS review_results (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL,
  sub_task_id  TEXT,
  attempt      INTEGER NOT NULL DEFAULT 1,
  verdict      TEXT NOT NULL,  -- PASS | FAIL
  issues       TEXT,           -- JSON array of {file, line, severity, description, suggestion}
  summary      TEXT,
  reviewed_at  INTEGER NOT NULL
);

-- Usage token/chi phí mỗi lượt gọi LLM (append-only). Worker ghi, admin đọc gộp (đa-process qua DB chung).
CREATE TABLE IF NOT EXISTS usage_events (
  id            TEXT PRIMARY KEY,
  task_key      TEXT,            -- key gộp theo card (hậu tố sau ':' của label) — null nếu không rõ
  label         TEXT,            -- nhãn gốc vd "plan:abc123"
  stage         TEXT,            -- phần trước ':' của label (refine/plan/dev/test/triage…)
  provider      TEXT,            -- claude | gemini | openai
  model         TEXT,            -- model-id đã dùng
  source        TEXT,            -- api | cli | gemini | openai (nguồn đo)
  input_tokens  INTEGER NOT NULL DEFAULT 0,   -- ĐÃ gồm cache
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read    INTEGER NOT NULL DEFAULT 0,
  cache_write   INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,       -- giá API quy đổi (KHÔNG phải % gói thuê bao)
  cost_estimated INTEGER NOT NULL DEFAULT 1,   -- 1 = ước tính qua bảng giá; 0 = số thật do nguồn báo (CLI)
  repo_key      TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_task    ON usage_events(task_key);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_model   ON usage_events(model);

-- Trello poller state (last seen action per board)
CREATE TABLE IF NOT EXISTS poller_state (
  board_id          TEXT PRIMARY KEY,
  last_seen_action  TEXT,
  last_poll_at      INTEGER
);

-- Mốc commit đã review trên một nhánh (auto-incremental: lần sau chỉ review phần mới).
CREATE TABLE IF NOT EXISTS review_marks (
  repo_key     TEXT NOT NULL,
  branch       TEXT NOT NULL,
  last_commit  TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (repo_key, branch)
);

-- Cấu hình repo theo board (đa-repo, cấu hình qua admin). 1 board = 1 repo.
CREATE TABLE IF NOT EXISTS repo_configs (
  id           TEXT PRIMARY KEY,
  board_id     TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,            -- tên dự án (hiển thị)
  repo_path    TEXT NOT NULL,            -- đường dẫn tuyệt đối tới repo trên đĩa
  base_branch  TEXT NOT NULL DEFAULT 'dev',
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  docs_path    TEXT,            -- thư mục tài liệu dự án (mặc định <repo>/docs)
  context_repo_paths TEXT,      -- JSON array path repo NGỮ CẢNH (chỉ đọc) cho agent tra cứu
  auto_pilot   INTEGER NOT NULL DEFAULT 0  -- 1 = full-auto: agent tự đẩy card qua các stage (Refine→Dev→Test→Done)
);
