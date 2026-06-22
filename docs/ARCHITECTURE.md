# Kiến trúc chi tiết — AutoPilot Agent

Tài liệu cho **dev kế tiếp**: giải thích sâu các hệ con đã xây + điểm mở rộng. Tổng quan ngắn xem
[`../CLAUDE.md`](../CLAUDE.md); trạng thái/handoff xem [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

---

## 1. Vòng đời một task

```
supervisor.ts → fork worker.ts (1 process/dự án) → mỗi worker poll board của mình
Trello (card có nhãn AI ở 1 list stage)
  → TrelloPoller/Webhook (worker) phát hiện action → emit 'trello:event'
  → worker.ts → dispatchStageIfAi → StageRouter.dispatch(stage, card, listId)
       1) RepoRegistry.resolveForBoard(card.idBoard)  → repo của card (hoặc comment báo chưa cấu hình)
       2) findOrCreateTask → lưu repo_key/repo_path vào Task (1 card = 1 Task)
       3) TaskQueue.run → runRefine | runEpicPlanning | runPlanning | runDev | runTest
  → mỗi stage: ProjectDocs.guidance bơm chỉ dẫn docs → agent đọc docs/code → cập nhật status + comment
```

- **Status** (TaskRepository): queued → processing → awaiting_clarification / awaiting_plan_approval /
  plan_approved → developing → dev_done → testing → completed | review_failed | halted | failed.
- **Người dùng tự kéo card** giữa list; agent chỉ đổi status + comment, không di chuyển card.

---

## 2. Đa-repo (board → repo)

**Mục tiêu:** 1 cài đặt phục vụ nhiều dự án; mỗi **board = 1 repo**.

- Cấu hình lưu DB `repo_configs` (`state/RepoConfigRepository.ts`): `board_id (unique)`, `name`,
  `repo_path`, `base_branch`, `enabled`. CRUD qua admin (`admin/routes/repos.ts`, UI `repos.html`).
- `repos/RepoRegistry.ts`:
  - `resolveForBoard(boardId)` → `{ repoKey, repoPath, baseBranch, name }` | `{ error }`.
    - board đã map → dùng. · chưa map & `count()==0` → repo mặc định (`GIT_REPO_PATH`). · chưa map &
      đã có cấu hình khác → `{ error }` (StageRouter comment nhắc admin, không tạo Task).
  - `watchedBoardIds()` = `TRELLO_BOARD_IDS` ∪ board enabled trong DB → poller/scan/info-card đọc hàm
    này **mỗi vòng** ⇒ thêm dự án qua admin được quét ngay, không cần restart.
- **Thread repo_path:** Task lưu `repo_key/repo_path`. Mọi agent dùng `task.repo_path ?? GIT_REPO_PATH`.
  base branch tra `RepoConfigRepository.getById(task.repo_key)?.base_branch ?? GIT_DEFAULT_BASE_BRANCH`.
  WorktreeManager.add/remove nhận `repoPath`. EpicManager/ReviewAgent/DevAgent/Planner/BA/Tech đều theo.
- **Migration:** `state/db.ts::migrate()` tự `ALTER TABLE tasks ADD COLUMN repo_key/repo_path` cho DB cũ.
- **Thêm dự án mới:** tạo board → copy board id → `git clone` repo về máy chạy agent → admin Repos nhập
  `board id + path + base branch`. (Auto-clone từ git URL: chưa làm — điểm mở rộng.)

---

## 3. Refine: Triage → BusinessAnalyst → TechnicalRefiner

Tách "1 RefineAgent" cũ thành pipeline để **tiết kiệm token** + tách nghiệp vụ/kỹ thuật.

| Bước | File | Vai trò | Lối ra |
|---|---|---|---|
| Triage | `agents/TriageAgent.ts` | Phát hiện task tí hon (rẻ, không quét repo): nhãn `quick` / RuleEngine / rule trivial / 1 LLM `MODEL_TRIAGE` | trivial → `fastPathToDev` (spec + plan_approved → Dev) |
| BA | `agents/BusinessAnalystAgent.ts` | Phân tích nghiệp vụ → `AnalystResponse` (intent, requirements, AC, business_subtasks) | thiếu info → awaiting_clarification; lỗi LLM → fallback từ card |
| Tech | `agents/TechnicalRefinerAgent.ts` | Quyết định kỹ thuật + ghi đè mô tả card | trivial_solve→Dev · design_solve→Planning · epic_solve→Epic; lỗi → fallback Planning |

- Mô tả card cuối (composeFinalDescription): `🎯 Yêu cầu nghiệp vụ` + `🔧 Yêu cầu kỹ thuật` (+field_details)
  + `✅ Tiêu chí nghiệm thu` (gộp BA+Tech, dedupe) + `📌 Yêu cầu gốc (giữ nguyên)`.
- BA **không tạo card con** (quyết định chốt). Phân rã đa-tính-năng để Tech chọn `epic_solve` → Epic.
- **Dead code:** `agents/RefineAgent.ts`, `agents/AnalystAgent.ts` không còn được gọi.

---

## 4. Tri thức dự án = TÀI LIỆU THẬT trong repo (docs)

**Quyết định:** không dùng cache tự sinh (đã bỏ `ProjectKnowledge`). Tri thức = **docs do người kiểm
soát**, commit cùng code → minh bạch, sửa được, không lệch ngầm.

- **docsPath** = `repo_config.docs_path` || `PROJECT_DOCS_PATH` || `<repo>/docs`
  (`RepoRegistry.docsPathForTask` / `resolveForBoard().docsPath`).
- **`scripts/gen-docs.ts`** (`generateDocs(repoPath, docsPath)`): agent (LlmClient + Read/Glob/Grep +
  Write/Edit, cwd=repo, timeout `GEN_DOCS_TIMEOUT_MS`) **ghi** `docs/00_TONG_THE.md`,
  `docs/<chức-năng>.md`, `docs/00_BAN_DO_TAI_LIEU.md`. Chạy: `npm run gen-docs -- <board_id|repo_path>`
  hoặc admin `POST /repos/:id/gen-docs` (nền). Người **review + commit**.
- **`agents/ProjectDocs.ts`** `guidance(repoPath, docsPath)`: chèn chỉ dẫn vào prompt; `exists(docsPath)`
  cho cờ `docs_missing`. Agent **tự đọc** docs (docs trong cwc=repo nên Read được trực tiếp).
- **Thứ tự nguồn:** docs thật → nếu thiếu, **fallback đọc thẳng mã nguồn** (ground truth). BA chỉ đọc
  docs (thiếu → đọc code); Tech/Planner/Dev đọc code + docs. `PromptBuilder.repoContext` inject
  `00_TONG_THE.md` (sentinel token-opt).
- BA đặt `docs_missing` + comment nhắc gen-docs khi chưa có docs.

---

## 5. Test — review độc lập (ReviewAgent)

Review **tĩnh** (đọc diff, đối chiếu tiêu chí + bug/edge/security/convention; KHÔNG chạy build/test).

### 5a. Worktree review (Dev → Test của agent)
Có `task.worktree_path` → `diff worktree vs base branch`. Card con epic → vs integration branch; PASS
→ merge vào integration branch (conflict → review_failed).

### 5b. Branch/Range review (agent làm tester cho code NGƯỜI tự viết)
Không worktree → `StageRouter.runBranchReview` đọc directive trong mô tả card (`parseReviewSpec`):

| Directive | Diff | Ghi chú |
|---|---|---|
| `Branch: <ref>` | auto-incremental | review commit mới kể từ mốc trước (bảng `review_marks`); lần đầu vs base; **tiến mốc khi PASS** |
| `Branch: <ref>` + `Base: <ref>` | `base...ref` (3-dot) | base nên là nhánh CHƯA chứa thay đổi (đã merge staging vẫn đúng) |
| `Range: a..b` / `Commits: a..b` | đúng dải | vd `dev..staging`, `<sha>..staging` |
| `Branch: <ref>` + `Since: <sha>` | `<sha>..<ref>` | |

- READ-ONLY: `GitClient.fetch` + `getDiffExpr` (`ReviewAgent.reviewExpr`, fallback ref local nếu thiếu
  `origin/`). KHÔNG worktree/commit/merge — người tự merge sau PASS.
- **Nguyên tắc:** luôn so với nhánh **chưa chứa** thay đổi; so với chính nhánh đã merge vào → diff rỗng.
- Auto-incremental: `state/ReviewMarkRepository.ts` (`repo_key + branch → last_commit`).

---

## 6. LLM client & độ bền

- `claude/LlmClient.ts`: router theo provider. `claude` + có `ANTHROPIC_API_KEY` → API; không có →
  `ClaudeCliClient` (CLI, credentials `~/.claude`). DevAgent luôn spawn CLI (`agents/DevAgent.ts`).
- `runForJson`: prompt siết JSON; **retry tối đa 2 lần** khi thiếu JSON (`claude/LlmClient.ts`).
  Stream parse + token tracking: `claude/claudeStream.ts`.
- Fallback chống crash: BA → phân tích từ card (hoặc đọc code khi thiếu docs); Tech → route Planning.
- Timeout: `REFINE_TIMEOUT_MS` (BA/Tech/Doc), `GEN_DOCS_TIMEOUT_MS` (gen-docs), `PLANNING_TIMEOUT_MS`.
  CLI mặc định 180s.
- **Khuyến nghị repo lớn:** đặt `ANTHROPIC_API_KEY` → các bước JSON đi API, ổn định hơn CLI nhiều.

---

## 7. Admin backend

- `admin/AdminServer.ts`: Express cổng `ADMIN_PORT`, bật khi có `ADMIN_API_TOKEN`. `ADMIN_BIND_HOST`
  (mặc định 127.0.0.1; đặt `0.0.0.0` để truy cập từ máy khác — nhớ token mạnh).
- Chạy trong **supervisor**; nhận `WorkerRegistry`. API `/admin/api/*` (Bearer token, `admin/auth.ts`):
  `routes/tasks.ts(registry)` (dashboard + rerun/modify/cancel **gửi worker qua IPC** theo `task.repo_key`),
  `routes/repos.ts(registry)` (CRUD board→repo, validate path + `.git`, nút **gen-docs**; sau CRUD →
  `registry.reconcile()`).
- UI tĩnh `public/admin/`: `index.html` (Tasks), `task.html` (chi tiết), `repos.html` (cấu hình repo),
  `login.html`; `js/layout.js` dựng shell + sidebar, `js/api.js` (AdminApi token), `js/ui.js`.

---

## 8. Điểm mở rộng (cho dev kế tiếp)

- **Auto-clone repo:** admin nhập git URL → agent `git clone` vào thư mục chuẩn (xử lý credential).
- **Review chạy thật:** ReviewAgent checkout + `npm test/build` trong sandbox (cho phép Bash allowlist).
- **GitLab MR review:** directive `MR: <url>` → lấy diff MR qua API.
- **UsageRepository:** lưu token/chi phí mỗi call (port từ origin/dev) + view admin.
- **Thêm executor `kind`:** `claude/types.ts` (TaskKind) + `agents/executors/*` + `registry.ts`.

---

## 9. Đa-process — supervisor / worker (theo repo_config)

- **`supervisor.ts`** (entry): `getDb()` (schema+migration 1 lần) → recover stale → `AdminServer(registry)`
  → `WorkerRegistry.start()`.
- **`supervisor/WorkerRegistry.ts`**: nguồn = `RepoRegistry.listProjects()` (repo_configs enabled; rỗng →
  `default` từ `.env`). `fork(worker)` mỗi dự án (env `AUTOPILOT_REPO_KEY`); **restart backoff** khi crash;
  `reconcile()` (gọi sau CRUD repo ở admin) thêm/bớt/restart worker; `sendCommand(repoKey, cmd, taskId)` IPC.
- **`supervisor/ipc.ts`**: `AdminCommandMsg`/`AdminResultMsg` (rerun/modify/cancel) + `AdminCommandError`.
- **`worker.ts`**: 1 dự án — resolve qua `AUTOPILOT_REPO_KEY`; `TrelloConnector(project.boardIds)` (chỉ poll
  board của mình); event handler (dispatch/label/comment); ensure info card + scan board của mình; dead-man
  lọc `repo_key`; nhận IPC admin-command → thực thi qua StageRouter trong ngữ cảnh repo.
- **Cách ly:** worker crash không ảnh hưởng dự án khác. SQLite WAL (đa-process); task phân vùng theo
  `repo_key`. Worktree theo `taskId` (uuid, không đụng nhau giữa repo).

---

## 10. Thứ tự đọc code khi onboarding

1. `supervisor.ts` + `supervisor/WorkerRegistry.ts` → `worker.ts` (đa-process) → `agents/StageRouter.ts`.
2. `repos/RepoRegistry.ts` + `state/RepoConfigRepository.ts` (đa-repo, listProjects, docsPath).
3. `agents/{TriageAgent,BusinessAnalystAgent,TechnicalRefinerAgent}.ts` (Refine pipeline).
4. `agents/ProjectDocs.ts` + `scripts/gen-docs.ts` (docs) + `claude/LlmClient.ts` (gọi model).
5. `agents/{DevAgent,ReviewAgent,EpicManager}.ts` (Dev/Test/Epic).
6. `admin/*` + `public/admin/*` (cấu hình + theo dõi).
