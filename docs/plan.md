# Plan: Multi-Agent AI System — Trello-driven, Level 3 Code Implementation

> ⚠️ **LỖI THỜI** — đây là plan v1 (mô hình large/small + fan-out sub-task song song). Hệ thống đã
> refactor sang luồng stage-list (Epic/Planning/Dev/Test) + memory qua comment. Xem trạng thái đúng ở
> [`PROJECT_STATUS.md`](PROJECT_STATUS.md) và [`../CLAUDE.md`](../CLAUDE.md). Giữ file này làm lịch sử.

## Context
Xây dựng hệ thống multi-agent chạy local trên máy developer, kết nối Trello để nhận task, dùng Claude API để phân tích + viết code + review, và thực thi git operations. Mục tiêu: agent tự động xử lý end-to-end từ Trello card → code commit → AI review, admin chỉ cần duyệt plan lớn và quyết định merge vào branch chính.

**Môi trường**: Local machine, repo đã clone sẵn.  
**Test strategy**: AI Code Review (Claude instance độc lập đọc diff).  
**Design source**: Ảnh/PDF đính kèm Trello card (Claude Vision).

---

## Hai luồng xử lý

### Luồng A — Task lớn (ví dụ: lên layout A03)

```
[Trello] Card DOING + AI AGENT assigned
    ↓
OrchestratorAgent: phân loại task → "large"
    ↓
PlannerAgent:
  • Download attachments (ảnh/PDF) từ Trello
  • Đọc code hiện tại liên quan
  • Claude Vision phân tích design vs code
  • Tạo PLAN.md (sub-tasks, acceptance criteria, files, risks)
  • Post comment tóm tắt lên Trello + attach PLAN.md
  • → task status: waiting_plan_approval
    ↓
Admin duyệt qua Trello comment: APPROVE / REJECT / MODIFY
    ↓
OrchestratorAgent:
  • Tạo Trello sub-cards cho từng sub-task
  • Tạo parent branch: feature/{cardId}-{slug} từ dev
  • Enqueue sub-tasks vào DevAgent queue
    ↓
[Parallel] Mỗi sub-task → DevAgent:
  • git worktree add feature/{cardId}-sub-{n}
  • Đọc PLAN.md + sub-task description
  • Implement code trong worktree riêng
  • Commit vào sub-branch
  • Post completion + diff summary lên Trello sub-card
    ↓
ReviewAgent (độc lập):
  • Đọc git diff sub-branch vs parent branch
  • Claude review: conventions (CLAUDE.md), correctness, design adherence
  • PASS → sub-task approved, sẵn sàng merge vào parent
  • FAIL → post comments cụ thể → DevAgent retry (max 2 lần)
    ↓
OrchestratorAgent: merge sub-branch → parent branch khi pass
    ↓
Khi tất cả sub-tasks done:
  • ReviewAgent review tổng thể parent vs dev
  • Post summary lên Trello parent card
  • Admin quyết định merge parent → dev
```

### Luồng B — Task nhỏ (ví dụ: sửa format số)

```
[Trello] Card DOING + AI AGENT assigned
    ↓
OrchestratorAgent: phân loại → "small"
    ↓
AnalystAgent:
  • Đọc files liên quan trong repo
  • Xác định: file path, line number, cách sửa, lưu ý từ CLAUDE.md
  • Post comment chi tiết lên Trello
  • Tạo branch: fix/{cardId}-{slug} từ dev
    ↓
DevAgent:
  • git worktree add fix/{cardId}-{slug}
  • Đọc analyst comment
  • Implement fix
  • Commit vào branch
  • Post done + diff lên Trello
    ↓
ReviewAgent:
  • Review diff vs dev branch
  • PASS → "Ready to merge" comment lên Trello
  • FAIL → feedback → DevAgent retry (max 2)
    ↓
Admin: merge fix branch → dev qua Trello approval
```

---

## Cấu trúc thư mục

```
target-repo/
├── agent/                          ← service mới
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   │
│   ├── src/
│   │   ├── index.ts                ← bootstrap: init db, queue, connector
│   │   ├── config.ts               ← zod env validation
│   │   │
│   │   ├── agents/
│   │   │   ├── OrchestratorAgent.ts ← task routing, phân loại large/small
│   │   │   ├── PlannerAgent.ts      ← design analysis, PLAN.md, xin duyệt
│   │   │   ├── AnalystAgent.ts      ← small task annotation
│   │   │   ├── DevAgent.ts          ← code implementation
│   │   │   └── ReviewAgent.ts       ← AI code review (instance riêng)
│   │   │
│   │   ├── git/
│   │   │   ├── GitClient.ts         ← branch/commit/merge/diff/push wrapper
│   │   │   └── WorktreeManager.ts   ← lifecycle worktrees per task
│   │   │
│   │   ├── shell/
│   │   │   └── ShellExecutor.ts     ← safe exec với timeout + command allowlist
│   │   │
│   │   ├── vision/
│   │   │   └── DesignAnalyzer.ts    ← download attachment + Claude Vision
│   │   │
│   │   ├── trello/
│   │   │   ├── TrelloClient.ts      ← REST wrapper (rate-limited)
│   │   │   ├── TrelloWebhookServer.ts
│   │   │   ├── TrelloPoller.ts
│   │   │   ├── TrelloConnector.ts   ← facade webhook/poller
│   │   │   └── types.ts
│   │   │
│   │   ├── claude/
│   │   │   ├── ClaudeClient.ts      ← @anthropic-ai/sdk, tool_use + vision
│   │   │   ├── PromptBuilder.ts     ← system prompts per agent type
│   │   │   └── ConversationStore.ts
│   │   │
│   │   ├── queue/
│   │   │   ├── TaskQueue.ts         ← p-queue (concurrency=3 default)
│   │   │   └── TaskProcessor.ts     ← entry point mỗi task job
│   │   │
│   │   ├── rules/
│   │   │   ├── RuleEngine.ts        ← large vs small, auto vs confirm
│   │   │   └── rules.yaml
│   │   │
│   │   ├── confirmation/
│   │   │   └── ConfirmationManager.ts ← pause/resume/timeout
│   │   │
│   │   ├── risk/
│   │   │   └── RiskGuard.ts         ← hard limits, branch isolation
│   │   │
│   │   ├── state/
│   │   │   ├── db.ts
│   │   │   ├── TaskRepository.ts
│   │   │   ├── ConversationRepository.ts
│   │   │   └── schema.sql
│   │   │
│   │   └── utils/
│   │       ├── logger.ts            ← pino
│   │       └── errors.ts
│   │
│   ├── data/agent.db               ← SQLite (gitignored)
│   └── tests/
│
└── agent-worktrees/                ← git worktrees tạm thời (gitignored)
    ├── feature-CARD123-a03-layout/
    ├── feature-CARD123-a03-sub-1/
    └── fix-CARD456-format/
```

---

## Chi tiết các thành phần mới (so với plan v1)

### WorktreeManager
```typescript
// Tạo worktree mới cho task
createWorktree(taskId: string, branchName: string, fromBranch: string): string
// → git worktree add ../agent-worktrees/{taskId} -b {branchName} {fromBranch}
// → trả về path tuyệt đối của worktree

// Xóa worktree sau khi xong
removeWorktree(taskId: string): void
// → git worktree remove ../agent-worktrees/{taskId} --force

// Lấy path hiện tại
getWorktreePath(taskId: string): string
```

Mỗi agent nhận `worktreePath` và chỉ thao tác trong path đó — không đụng vào working directory chính.

### GitClient
```typescript
createBranch(worktreePath: string, branchName: string, fromBranch: string): void
commit(worktreePath: string, message: string, files: string[]): string // → commitHash
getDiff(worktreePath: string, base: string): string // → unified diff text
mergeBranch(targetBranch: string, sourceBranch: string): void
push(branchName: string): void
```

### ShellExecutor
- Chạy lệnh với `execa` trong worktree path được chỉ định
- **Command allowlist**: chỉ cho phép `git`, `node`, `npm`, `tsc`, `eslint`
- Timeout 120 giây mặc định
- Không bao giờ chạy `rm -rf`, `git reset --hard`, hay lệnh không trong allowlist

### PlannerAgent
1. `TrelloClient.getAttachments(cardId)` → download ảnh/PDF
2. Đọc files hiện tại liên quan (dựa trên card description + labels)
3. Gọi Claude với `content: [{ type: "image", ... }, { type: "text", ... }]` (multimodal)
4. Claude trả về structured plan:
```typescript
interface Plan {
  summary: string;
  subTasks: SubTask[];     // tên, mô tả, acceptance criteria, files dự kiến
  testCases: TestCase[];   // input/expected output
  estimatedComplexity: number;
  risks: string[];
}
```
5. Lưu PLAN.md vào worktree root
6. `TrelloClient.attachFile(cardId, "PLAN.md")` + post comment tóm tắt

### ReviewAgent
Chạy trong một Claude conversation **hoàn toàn độc lập** (không share context với DevAgent):
```
System: "Bạn là code reviewer cho dự án target-repo Odoo/React.
Luật bắt buộc: [nội dung CLAUDE.md].
Chỉ nhận xét về diff được cung cấp."

User: [git diff content] + [sub-task description] + [acceptance criteria]

Response schema:
{
  verdict: "PASS" | "FAIL",
  issues: [{ file, line, severity, description, suggestion }],
  conventions_check: boolean,
  summary: string
}
```

### DesignAnalyzer
```typescript
async analyzeDesign(attachmentUrls: string[], existingCodeContext: string): Promise<DesignAnalysis>
// 1. Download từng attachment (ảnh/PDF page) qua Trello API
// 2. Convert sang base64
// 3. Gửi Claude với content array: images + code context
// 4. Nhận: component breakdown, color tokens, layout notes, delta vs existing
```

### OrchestratorAgent — Task Classification
```yaml
# rules.yaml bổ sung
task_classification:
  large_indicators:
    - card_has_attachment: true
    - description_length: "> 200"
    - checklist_items: "> 5"
    - label: "large-task"
    - keywords: ["layout", "thiết kế", "xây dựng", "tạo mới màn"]
  
  small_indicators:
    - label: "bug", "fix", "hotfix"
    - keywords: ["sửa", "fix", "update", "đổi", "format"]
    - description_length: "< 100"
```

---

## SQLite Schema (bổ sung)

```sql
-- Thêm vào schema hiện tại
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'small'; -- small | large
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;            -- cho sub-tasks
ALTER TABLE tasks ADD COLUMN branch_name TEXT;
ALTER TABLE tasks ADD COLUMN worktree_path TEXT;
ALTER TABLE tasks ADD COLUMN plan_file_path TEXT;

CREATE TABLE sub_tasks (
  id              TEXT PRIMARY KEY,
  parent_task_id  TEXT NOT NULL REFERENCES tasks(id),
  trello_card_id  TEXT,
  sequence        INTEGER,
  status          TEXT DEFAULT 'pending',
  branch_name     TEXT,
  review_result   TEXT,  -- JSON ReviewResult
  created_at      INTEGER,
  completed_at    INTEGER
);

CREATE TABLE git_operations (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL,
  operation    TEXT NOT NULL,  -- create_branch | commit | merge | push
  branch       TEXT,
  commit_hash  TEXT,
  executed_at  INTEGER,
  output       TEXT
);

CREATE TABLE review_results (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL,
  sub_task_id  TEXT,
  attempt      INTEGER DEFAULT 1,
  verdict      TEXT NOT NULL,  -- PASS | FAIL
  issues       TEXT,           -- JSON array
  reviewed_at  INTEGER
);
```

---

## Environment Variables (bổ sung)

```dotenv
# Git
GIT_REPO_PATH=D:\Coding_Stuffs\Github\Shicukoe.github.io
GIT_WORKTREE_BASE=D:\Coding_Stuffs\agent-worktrees
GIT_DEFAULT_BASE_BRANCH=dev
GIT_USER_NAME=AI Agent
GIT_USER_EMAIL=ai-agent@users.noreply.github.com

# Agent behavior
MAX_SUBTASKS_PARALLEL=3         # DevAgent concurrency
MAX_DEV_RETRY_ATTEMPTS=2        # retry sau ReviewAgent FAIL
MAX_REVIEW_ATTEMPTS=2           # ReviewAgent retry
PLAN_APPROVAL_TIMEOUT_HOURS=48  # tự reject plan sau N giờ không duyệt

# Shell safety
SHELL_COMMAND_ALLOWLIST=git,node,npm,tsc,eslint
SHELL_TIMEOUT_MS=120000
```

---

## Dependencies (bổ sung)

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "express": "^4.18",
    "better-sqlite3": "^9",
    "p-queue": "^8",
    "pino": "^9",
    "pino-pretty": "^11",
    "zod": "^3",
    "js-yaml": "^4",
    "execa": "^9",        ← thay node-fetch + child_process
    "node-fetch": "^3",
    "pdf-parse": "^1"    ← đọc PDF design file
  }
}
```

---

## Risk Mitigation (Level 3)

| Rủi ro | Biện pháp |
|--------|-----------|
| Agent commit sai branch | WorktreeManager enforce: chỉ commit trong worktree path của task |
| Merge vào dev/main trực tiếp | GitClient từ chối merge nếu target là `dev` hoặc `main` — chỉ admin làm qua Trello |
| Worktree bị bỏ quên | Dead man's switch: sau 2h không có heartbeat → removeWorktree + halt task |
| DevAgent loop vô hạn | Max retry = 2; sau 2 FAIL liên tiếp → halt + escalate admin |
| Shell injection | ShellExecutor chỉ nhận command từ allowlist, không interpolate string từ Claude output |
| Xung đột worktrees | Mỗi taskId có worktree path unique; dedup bằng SQLite trước khi tạo |
| Context leak giữa agents | ReviewAgent dùng Claude conversation riêng biệt, không nhận message history của DevAgent |

---

## Thứ tự triển khai

**Phase 1 — Foundation** (ngày 1-2)
`config.ts` → `logger.ts` → `db.ts` + `schema.sql` → repositories

**Phase 2 — Git & Shell** (ngày 3)
`ShellExecutor.ts` → `GitClient.ts` → `WorktreeManager.ts`

**Phase 3 — Trello Layer** (ngày 4-5)
`TrelloClient.ts` → `TrelloWebhookServer.ts` → `TrelloPoller.ts` → `TrelloConnector.ts`

**Phase 4 — Claude Layer** (ngày 6)
`ClaudeClient.ts` (multimodal + tool_use) → `PromptBuilder.ts` → `DesignAnalyzer.ts`

**Phase 5 — Rules & Risk** (ngày 7)
`rules.yaml` + `RuleEngine.ts` (large/small classification) → `RiskGuard.ts`

**Phase 6 — Agents** (ngày 8-10)
`AnalystAgent.ts` → `DevAgent.ts` → `ReviewAgent.ts` → `PlannerAgent.ts` → `OrchestratorAgent.ts`

**Phase 7 — Orchestration & Confirmation** (ngày 11-12)
`ConfirmationManager.ts` → `TaskQueue.ts` → `TaskProcessor.ts` → `index.ts`

---

## Verification

1. **Unit**: RuleEngine (large/small classification), RiskGuard, WorktreeManager mock
2. **Git smoke test**: tạo worktree, commit file dummy, đọc diff, merge, cleanup
3. **Design analysis**: upload ảnh test → PlannerAgent → kiểm tra PLAN.md output
4. **Small task end-to-end**: tạo card "Sửa format số A03" trên Trello test board → kiểm tra branch được tạo, commit tồn tại, ReviewAgent chạy, Trello comment cập nhật
5. **Large task end-to-end**: tạo card với ảnh đính kèm → kiểm tra PLAN.md được attach, sub-cards được tạo, sub-branches được merge vào parent
6. **Risk test**: force DevAgent vượt MAX_DEV_RETRY → verify halt + escalate
7. **Isolation test**: chạy 3 sub-tasks parallel → verify không worktree nào conflict
