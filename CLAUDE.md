# AutoPilot Agent — Project Conventions

Hệ thống multi-agent AI tự động xử lý task từ **Trello** → dùng **Claude** (CLI hoặc API) phân tích /
viết code / review → thao tác **git** trên repo đích. **Đa-repo**: một cài đặt phục vụ nhiều dự án.

> 📌 Trạng thái + handoff: [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) · Đào sâu kiến trúc các
> hệ con: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). `docs/plan.md` là plan v1 đã lỗi thời.

## Tổng quan luồng (đa-process)

Entry = **`src/supervisor.ts`**: khởi tạo DB, chạy 1 **AdminServer** chung, và fork **1 worker process
cho MỖI dự án** (repo_config) qua `WorkerRegistry`. Card điều phối theo **list nó đang nằm** (kéo card =
đổi stage); card phải có nhãn **`AI`**.

```
supervisor.ts ── WorkerRegistry.fork(worker) cho mỗi repo_config (RepoRegistry.listProjects)
  worker.ts (1 dự án, env AUTOPILOT_REPO_KEY) ── TrelloConnector(project.boardIds) poll board của mình
    → StageRouter.dispatch(stage, card, listId)
        → resolve REPO theo BOARD (RepoRegistry.resolveForBoard) → lưu repo_key/repo_path vào Task
        → TaskQueue.run (p-queue)
            → [Refine]   Triage → BusinessAnalyst → TechnicalRefiner
            → [Epic]     PlannerAgent → "plan approve" → EpicManager sinh card con
            → [Planning] PlannerAgent → "plan approve"
            → [Dev]      DevAgent (hoặc executor theo kind) — code trong worktree
            → [Test]     ReviewAgent (review diff / nhánh người tự code, PASS/FAIL)
AdminServer (supervisor) ── đọc SQLite chung; lệnh task (rerun/modify/cancel) gửi worker qua IPC;
                            CRUD repo → registry.reconcile() (tự thêm/bớt/restart worker)
```

- **Một card = một Task** (SQLite chung mọi worker), đi qua các stage theo thời gian.
- Người dùng **tự kéo card**; agent không tự di chuyển card. Chốt plan = gắn nhãn **`plan approve`**.
- Điều phối ở `src/agents/StageRouter.ts`; `OrchestratorAgent` chỉ còn `handleError` dùng chung.
- **Cách ly lỗi:** 1 worker crash không ảnh hưởng dự án khác (tự restart, backoff). DB dùng WAL (đa-process).

## Đa-repo (1 board = 1 repo)

- Mỗi **board Trello map tới 1 repo** trên đĩa. Cấu hình qua **trang Admin → Repos** (bảng DB
  `repo_configs`: board_id, name, repo_path, base_branch, enabled). KHÔNG dùng nhãn để chọn repo.
- `RepoRegistry.resolveForBoard(boardId)`: board đã map → dùng repo đó; chưa map mà **chưa cấu hình
  board nào** → fallback repo mặc định (`GIT_REPO_PATH` trong `.env`); đã có cấu hình khác mà board này
  chưa map → comment nhắc admin, **không** tạo Task.
- Poller + startup scan + info card quét **`RepoRegistry.watchedBoardIds()` = `TRELLO_BOARD_IDS` ∪
  board đã cấu hình (enabled)** → thêm dự án qua admin là được quét ngay, không cần sửa `.env`.
- **base branch theo từng repo** (dev/staging/main…), sửa được trong admin. Mọi nơi cần base branch tra
  `RepoConfigRepository.getById(task.repo_key)?.base_branch ?? GIT_DEFAULT_BASE_BRANCH`.
- Task mang `repo_path`; mọi agent dùng `task.repo_path` (fallback `config.GIT_REPO_PATH`).
- **Repo ngữ cảnh (chỉ đọc):** mỗi board có thể khai báo thêm `context_repo_paths` (cột repo_configs, nhập ở
  admin) — các repo KHÁC mà agent được **Read/Glob/Grep để tra cứu** module liên quan (vd Permit) khi
  task tham chiếu chéo. `RepoRegistry.contextGuidanceForTask` bơm chỉ dẫn vào prompt BA/Tech/Planner/Dev/Review.
  **Vẫn 1 repo CHÍNH để ghi code/commit**; repo ngữ cảnh KHÔNG bị sửa.
- Code: `src/repos/RepoRegistry.ts`, `src/state/RepoConfigRepository.ts`, `src/admin/routes/repos.ts`,
  UI `public/admin/repos.html` + `public/admin/js/repos.js`.

## Refine — Triage → BA nghiệp vụ → (tuỳ chọn) BA kỹ thuật

Kéo card sơ sài vào list **`Refine`** (nhãn AI). **MẶC ĐỊNH chỉ chạy BA NGHIỆP VỤ** — test về sau chỉ chấm
tiêu chí NGHIỆP VỤ (tránh fail oan khi dev giải khác cách spec kỹ thuật). Chỉ khi card có **nhãn
`BA kỹ thuật`** (`TRELLO_TECH_REFINE_LABEL_NAME`) mới chạy thêm bước kỹ thuật. `runRefine`:

1. **Triage** (`agents/TriageAgent.ts`) — rẻ, KHÔNG quét repo. nhãn `quick` ép trivial · `RuleEngine` thấy
   `large` → không trivial · rule trivial · cuối cùng 1 LLM-call rẻ (`MODEL_TRIAGE`). **Trivial → fast-path**:
   ghi spec ra `plan_file_path` + `plan_approved` → kéo thẳng **Dev**.
2. **BusinessAnalyst** (`agents/BusinessAnalystAgent.ts`) — phân tích NGHIỆP VỤ (intent, requirements,
   acceptance criteria dạng **điều kiện quan sát được**, business_subtasks) + `decision` định tuyến mức
   nghiệp vụ. Đọc **docs**; thiếu docs → đọc code + `docs_missing`. Thiếu thông tin → `awaiting_clarification`.
   LLM lỗi → **fallback** từ card. **Viết NGẮN GỌN (đọc hiểu 5–10 phút).** Không tạo card con.
3a. **Không có nhãn `BA kỹ thuật`** → `StageRouter.finalizeBusinessRefine`: ghi đè mô tả card NGHIỆP VỤ-only
   (`## 🎯 Yêu cầu nghiệp vụ` + `## ✅ Tiêu chí nghiệm thu (nghiệp vụ)` + `## 🛠️ Ghi chú Dev` + `## 📌 Yêu cầu
   gốc`), `test_cases = []`, định tuyến theo `analyst.decision` (trivial→Dev / design→Planning / epic→Epic).
3b. **Có nhãn `BA kỹ thuật`** → **TechnicalRefiner** (`agents/TechnicalRefinerAgent.ts`): đọc code, quyết
   định KỸ THUẬT + định tuyến; `kind` `code|doc_card`; sinh `acceptance_criteria` kỹ thuật + `test_cases`.
   **Ghi đè mô tả card** 5 mục: `## 🎯` (BA) + `## 🔧 Yêu cầu kỹ thuật` (+field_details) + `## ✅ Tiêu chí
   nghiệm thu` (gộp) + `## 🧪 Trường hợp kiểm thử` + `## 🛠️ Ghi chú Dev` + `## 📌 Yêu cầu gốc`.

Tiêu chí + test_cases được lưu vào `task.metadata` (acceptance_criteria/test_cases) để stage Test nạp thẳng
vào reviewer. Mục **`## 🛠️ Ghi chú Dev`** để dev điền cách đã code + hướng test → reviewer đọc và test theo
(xem mục Test).


Bổ sung thông tin rồi reply `REFINE` (hoặc `RETRY` khi card còn ở Refine) để chạy lại.

## Tri thức dự án = TÀI LIỆU THẬT trong repo (docs)

Nguồn tri thức là **tài liệu do người kiểm soát**, commit cùng code tại `docsPath` (mặc định
`<repo>/docs`, hoặc cột `docs_path` trong repo_config / `PROJECT_DOCS_PATH`). KHÔNG còn cache tự sinh.

- **CHỈ MỤC tĩnh — `agents/IndexAgent.ts`** (`npm run index -- <board|path>`; cũng tự dựng trong gen-docs +
  lazy ở `StageRouter.dispatch` nếu thiếu): grep TĨNH **không LLM** (~free token) → `docs/00_CHI_MUC.md` =
  cây file + model + đăng ký component + template_name + class export + route → file nào. Agent **tra chỉ mục**
  để biết "X nằm file nào" thay vì đọc/grep lặp. **Đa-ngôn-ngữ** (Class/Hàm/Export…) + mở rộng per-repo qua
  `<repo>/.indexrc.json` (mảng `{label,pattern,globs}`) — KHÔNG hardcode 1 loại repo.
- **`gen-docs`** (`src/scripts/gen-docs.ts`, `npm run gen-docs -- <board|path> [--full|--continue]`, hoặc nút
  **Generate docs** ở admin): agent (vai **chuyên gia phân tích nghiệp vụ**) viết tài liệu **NGHIÊNG NGHIỆP VỤ**
  (thay việc đọc cả repo): `00_TONG_THE.md` (tổng thể + **1 sơ đồ** Mermaid), `<chức-năng>.md` (nghiệp vụ + luồng
  xử lý + 1 sơ đồ + dữ liệu + business rule + **con trỏ code, KHÔNG chép code**), `00_BAN_DO_TAI_LIEU.md`. "Thứ X
  ở file nào" → để **`00_CHI_MUC.md`** lo (đỡ token). Người **review + commit**. Chạy bằng **Sonnet** (`CLAUDE_MODEL`).
  - **3 chế độ:** mặc định = incremental theo commit (`docs/.docs_sync.json`, `<last>..HEAD`); `--full` = sinh
    lại toàn bộ; `--continue` = GIỮ file đã có, chỉ viết THÊM doc cho chức năng còn thiếu.
  - `GEN_DOCS_MAX_TURNS` (mặc định 120) + `GEN_DOCS_TIMEOUT_MS` (CLI mặc định 8 lượt = quá ít → docs rỗng).
  - docs_path mặc định `<repo_root>/docs`; code trong module con → đặt **docs_path** trong admin cho khớp.
- **`agents/ProjectDocs.ts`** `guidance(repoPath, docsPath)`: chèn chỉ dẫn vào prompt — agent **tự đọc**
  `00_TONG_THE.md` + `00_BAN_DO_TAI_LIEU.md` rồi Read feature doc liên quan (docs nằm trong cwd=repo).
- **BA đọc CHỈ docs**; **Tech/Planner/Dev** đọc docs + code. **Thiếu docs → fallback đọc THẲNG mã nguồn**
  (ground truth) + cờ `docs_missing` + nhắc chạy gen-docs. (Không fallback về cache tự sinh.)
- Overview `00_TONG_THE.md` còn được `PromptBuilder.repoContext` inject sẵn (sentinel token-opt).

## Test — review XÁC MINH (ReviewAgent), 2 chế độ

`agents/ReviewAgent.ts` **đọc CODE THẬT để xác minh, không chỉ đọc diff**: reviewer có tool
`Read/Glob/Grep` + `cwd` = repo/worktree → mở file bị sửa + code/config liên quan, kiểm chứng từng tiêu
chí. Dùng **model nặng** `REVIEW_MODEL` (trống = `CLAUDE_MODEL`) + `REVIEW_MAX_TURNS`/`REVIEW_TIMEOUT_MS`.
Tiêu chí nghiệm thu + `test_cases` được nạp từ `task.metadata` (do BA/Tech ghi), thiếu thì parse mục
`## ✅ Tiêu chí nghiệm thu` trong mô tả card, rồi truyền **structured** vào reviewer. Reviewer cũng đọc **Ghi chú Dev**
(mục **`## 🛠️ Ghi chú Dev`** trong mô tả card, HOẶC comment bắt đầu bằng `DEV:`/`[DEV]`/`Hướng test:`) → **test
theo hướng dev**; chấm theo MỤC TIÊU chứ không theo "cách làm" của spec (dev làm khác mà đạt mục tiêu = hợp
lệ; phân vân → NEEDS_INFO). Kết quả review gồm **`how_tested`** (cách đã test, ngắn gọn) + **`checklist`**
checkbox từng tiêu chí/test_case (✅ đạt / ❌ lỗi) + issues. Kéo card sang **`Test`**:

1. **Worktree review** (luồng Dev→Test của agent): có worktree → diff worktree vs base branch của repo
   (`cwd` = worktree). Card con epic → diff vs integration branch; PASS thì tự merge vào integration branch.
2. **Branch/Range review** (luồng "agent làm tester" cho code NGƯỜI tự viết, không qua Dev của agent):
   không có worktree → reviewer đọc code TẠI **ref đích của dải** (phần sau `..`/`...`) qua **worktree tạm
   detached** (`GitClient.addDetachedWorktree`, dọn sau khi xong) → bắt ĐÚNG thay đổi đang review, không lệ
   thuộc nhánh repo đang checkout (tránh footgun đọc nhầm code nhánh khác). **KÉO-THẢ:** không ghi directive → `autoDetectReviewBranch` (fetch all +
   prune → chọn nhánh remote có commit MỚI NHẤT, loại main/master/production) → review auto-incremental nhánh
   đó. Muốn chỉ định rõ thì ghi trong **mô tả card** (`StageRouter.runBranchReview`):
   - `Branch: <ref>` (mình nó) → **AUTO-INCREMENTAL**: review **commit mới kể từ lần review trước** trên
     nhánh đó (mốc lưu ở bảng `review_marks`, **tiến mốc khi PASS**). Lần đầu so với base branch.
   - `Branch: <ref>` + `Base: <ref>` → diff `base...branch` (3-dot). base nên là nhánh **CHƯA chứa**
     thay đổi → dù đã merge vào staging vẫn soi đúng.
   - `Range: a..b` / `Commits: a..b` / `Since: <sha>` (+ Branch) → diff đúng dải commit.
   - READ-ONLY (chỉ `fetch` + `diff`, KHÔNG worktree/commit/merge). PASS → người tự merge/promote.

**3 verdict:** `PASS` → `completed`; `FAIL` → `review_failed` (mỗi lỗi kèm `file:dòng` + gợi ý);
**`NEEDS_INFO`** → `awaiting_clarification` khi KHÔNG kết luận được đúng/sai (phụ thuộc config/UI/runtime/dữ
liệu không thấy trong code) — reviewer trả `checks_needed` (cần biết/kiểm tra gì, thao tác gì trước khi
sửa), **không** merge/không tiến mốc. "Chưa cấu hình" CHƯA chắc là sai. ReviewAgent **không nạp memory**
(review khách quan) nhưng khi FAIL/NEEDS_INFO thì *ghi* memory để vòng Dev sau đọc.

## Dev — executor theo `kind`

`StageRouter.runDev` đọc `kind` (do Tech phân loại, lưu `metadata.kind`) → `pickExecutor(kind)`:
- `code` (mặc định) → `DevAgent`: worktree branch từ base branch của repo (đa-repo), Claude CLI code,
  commit → Test. Nhãn `quick` cho phép thả thẳng vào Dev (coi `card.desc` là spec).
- `doc_card` → `DocCardExecutor`: sinh tài liệu → tạo card mới → `completed` (không qua git/Test).

Thêm năng lực: bổ sung `TaskKind` (`claude/types.ts`) + `Executor` + đăng ký `executors/registry.ts`.

## Epic — feature lớn

Card ở list **`Epic`**: PlannerAgent lập plan tổng → gắn `plan approve` → `EpicManager` tạo
**integration branch** `epic/<short>` (từ base branch của repo) + N **card con** theo `sequence` (mỗi
card có `Epic: <id>`, pre-approve, base_branch = integration branch). Card con đi Dev→Test theo thứ tự;
Test PASS → tự merge vào integration branch. Card con kế thừa `repo_key/repo_path` của epic.

## LLM client & độ bền

- `claude/LlmClient.ts` định tuyến provider (`MODEL_*` = claude|gemini|openai). Provider `claude`:
  có `ANTHROPIC_API_KEY` → gọi **API**; không có → fallback **Claude CLI** (`ClaudeCliClient`, dùng
  credentials `~/.claude`). DevAgent luôn spawn CLI (phiên agentic). `run/runForJson` nhận `model` override
  (API: id; CLI: `--model`). ClaudeCliClient nhận sự kiện `result` (stream-json) là **kết thúc ngay + kill**
  tiến trình (CLI hay treo sau khi xong → tránh chờ timeout).
- **Chọn model theo khâu (token):** **Triage** = **Haiku** (`TRIAGE_MODEL`, rẻ nhất — chỉ đọc text card);
  **BA/Tech** = **Sonnet** (`CLAUDE_MODEL`); **Planning thường** = Sonnet, **Epic** = **Opus** (`EPIC_MODEL`);
  **gen-docs** = **Opus** (`DOCS_MODEL`); **Review** = `REVIEW_MODEL` (trống = Sonnet; `opus` khi cần). DevAgent
  theo model của gói Claude CLI. Mọi cái đều đổi được trong `.env`.
- `runForJson` **thử lại tối đa 2 lần** khi output thiếu JSON (CLI đôi khi chỉ "chào rồi dừng"), nhắc
  cứng hơn ở lần 2. BA/Tech có **fallback** để 1 lần lỗi không giết cả task.
- Timeout: Refine (BA/Tech/DocCard) = `REFINE_TIMEOUT_MS`; gen-docs = `GEN_DOCS_TIMEOUT_MS`;
  Planning = `PLANNING_TIMEOUT_MS`. CLI mặc định 180s nếu không truyền.
- **Repo lớn hay timeout/thất thường trên CLI** → cách ổn định nhất là đặt `ANTHROPIC_API_KEY` (đi API).

## Đa-process — supervisor / worker

`src/supervisor.ts` (entry) fork **1 `src/worker.ts` cho mỗi dự án** (`RepoRegistry.listProjects()` =
repo_configs enabled; rỗng → 1 dự án `default` từ `.env`). `supervisor/WorkerRegistry.ts` quản vòng đời
(spawn/restart-backoff/`reconcile()`), `supervisor/ipc.ts` = giao thức lệnh admin. Worker resolve dự án
qua env `AUTOPILOT_REPO_KEY`, chỉ poll `project.boardIds`, có TaskQueue + dead-man riêng. DB SQLite (WAL)
dùng chung mọi worker.

**Concurrency:** mỗi worker chạy tối đa `QUEUE_CONCURRENCY` card SONG SONG (p-queue; refine/dev/test cùng
lúc) — tổng toàn hệ = `QUEUE_CONCURRENCY × số repo`. `dispatch`/`TaskQueue.run` không await nên không
serialize. Thao tác git dễ tranh chấp (`fetch`, `worktree add/remove`) được **khóa theo repoPath**
(`utils/keyedMutex.ts`) → nhiều card cùng repo chạy song song an toàn (việc nặng LLM vẫn song song, chỉ
nối tiếp đoạn git ngắn).

## Admin backend

`src/admin/AdminServer.ts(registry)` (Express, cổng `ADMIN_PORT`, bật khi có `ADMIN_API_TOKEN`). API
`/admin/api/*` (token Bearer): `routes/tasks.ts(registry)` (dashboard + rerun/modify/cancel **gửi worker
qua IPC** theo `task.repo_key`) + `routes/repos.ts(registry)` (CRUD board→repo + nút gen-docs; sau CRUD →
`registry.reconcile()`). UI tĩnh `public/admin/` (`index.html`/`task.html`/`repos.html`/`login.html`;
shell+sidebar `js/layout.js`). Mở từ máy khác: `ADMIN_BIND_HOST=0.0.0.0`.

## Memory — qua comment card

Agent stateless mỗi lần gọi; "ký ức" đẩy ra **comment Trello** (`agents/CardMemory.ts`): mỗi stage
append `🧠 [AI MEMORY]`; chạy lại nạp lại mô tả card (mới nhất) + 2 khối memory gần nhất + comment admin.
Mô tả card ưu tiên khi mâu thuẫn. ReviewAgent cố ý không nạp memory (chỉ ghi khi FAIL).

## Risk management

- Agent chỉ commit trong worktree được giao; review nhánh người là READ-ONLY (fetch+diff + đọc file qua
  Read/Glob/Grep để xác minh, KHÔNG commit/merge/sửa).
- `RiskGuard` giới hạn actions/turns/comments. `GitClient.assertNotProtected()` chặn merge vào
  main/dev/master. `ShellExecutor` chỉ chạy lệnh allowlist. `ToolExecutor` chặn đọc/ghi ngoài cwd.
- Dead man's switch: task >`MAX_TASK_PROCESSING_MINUTES` không heartbeat → auto halt.

## Quy ước code

- **TypeScript strict** (không `any`), **ESM** (`.js` trong import), không side-effect ở module-level
  (trừ entry `supervisor.ts`/`worker.ts`/`scripts/*`), mỗi class/object lớn một file. Trả lời người dùng
  bằng **tiếng Việt**, giữ nguyên tên file/biến/hàm/code.

## Cấu trúc src/

| File/Thư mục | Mục đích |
|---------|---------|
| `supervisor.ts` + `supervisor/` | Entry đa-process: WorkerRegistry (fork/restart/reconcile) + ipc |
| `worker.ts` | Vòng xử lý 1 dự án (poll board của mình, dispatch, dead-man, nhận lệnh admin IPC) |
| `scripts/gen-docs.ts` | Sinh tài liệu dự án vào `<repo>/docs/` |
| `agents/` | StageRouter, Triage, BusinessAnalyst, TechnicalRefiner, Planner, Dev, Review, Index, EpicManager, CardMemory, ProjectDocs, Orchestrator(handleError), executors/ |
| `repos/` | RepoRegistry (đa-repo: resolveForBoard, listProjects, docsPathForTask) |
| `trello/` | TrelloClient (REST), poller, webhook server, connector, types |
| `claude/` | LlmClient (router claude/gemini/openai), ClaudeCliClient, PromptBuilder, conventions, claudeStream |
| `admin/` | AdminServer + auth + routes (tasks, repos) |
| `git/` | GitClient (diff/branch/merge/fetch/revParse), WorktreeManager |
| `state/` | SQLite: db (schema + migration), TaskRepository, RepoConfigRepository, ReviewMarkRepository, … |
| `rules/` | RuleEngine + rules.yaml (hot-reload) |
| `shell/`,`risk/`,`actions/`,`confirmation/`,`queue/`,`utils/`,`vision/` | shell allowlist, RiskGuard, ActionRegistry, ConfirmationManager, TaskQueue, logger/errors/retry, vision |

## Cấu hình (.env — xem `.env.example`)

Trello: `TRELLO_API_KEY/TOKEN`, `TRELLO_BOARD_IDS`, nhãn `TRELLO_AI_LABEL_NAME`/`PLAN_APPROVE`/`QUICK`/`TECH_REFINE` (`BA kỹ thuật`),
tên list `TRELLO_*_LIST_NAMES`. · Model: `MODEL_REFINE/PLANNING/DEV/TEST/TRIAGE/INDEXER`,
`ANTHROPIC_API_KEY` (tuỳ chọn → đi API). · Git: `GIT_REPO_PATH` (repo mặc định), `GIT_WORKTREE_BASE`,
`GIT_DEFAULT_BASE_BRANCH`. · Docs: `PROJECT_DOCS_PATH` (override; mặc định `<repo>/docs`),
`GEN_DOCS_TIMEOUT_MS`, `GEN_DOCS_MAX_TURNS`. · Refine: `REFINE_TIMEOUT_MS`. · Test/Review: `REVIEW_MODEL`
(model nặng; trống = `CLAUDE_MODEL`), `REVIEW_MAX_TURNS`, `REVIEW_TIMEOUT_MS`. · Admin: `ADMIN_API_TOKEN`, `ADMIN_PORT`,
`ADMIN_BIND_HOST`. · `rules.yaml` hot-reload; `repos` cấu hình qua admin (DB), không cần restart.

## Getting started

```bash
cp .env.example .env   # điền TRELLO_*, GIT_REPO_PATH, GIT_WORKTREE_BASE, ADMIN_API_TOKEN
npm install
npm run dev            # chạy supervisor (fork worker/dự án). Cần Claude CLI đăng nhập, hoặc ANTHROPIC_API_KEY
npm run gen-docs -- <board_id>   # (1 lần/repo) sinh tài liệu vào <repo>/docs rồi commit
```
Mở admin `http://127.0.0.1:3457/admin` → tab **Repos** map board→repo (+ docs path, nút Generate docs).
Board cần list `Refine/Planning/Dev/Test/Epic` + nhãn `AI`, `plan approve`, `quick`.
