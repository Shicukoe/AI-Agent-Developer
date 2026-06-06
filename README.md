# AI Agent Developer (AutoPilot)

Hệ **multi-agent** chạy local: nhận task từ **Trello** → dùng **Claude CLI** để lập kế hoạch, viết code và review → thực thi **git** trên một repo đích. Mục tiêu: tự động hoá vòng đời task từ thẻ Trello đến nhánh code đã được AI review, con người chỉ duyệt kế hoạch và quyết định merge.

> Tài liệu chi tiết: [`CLAUDE.md`](CLAUDE.md) (kiến trúc + quy ước) · [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) (trạng thái + handoff).

## Luồng làm việc (theo list Trello)

Card được điều phối theo **list nó đang nằm**; card phải có nhãn **`AI`** mới được xử lý.

```
[Epic]     Feature lớn → lập plan tổng → gắn "plan approve" → tự sinh N card con (link về epic)
[Planning] 1 task      → lập plan      → gắn "plan approve"
[Dev]      kéo card sang → viết code theo plan đã duyệt → nhắc kéo sang Test
[Test]     kéo card sang → AI review diff → PASS (sẵn sàng merge) / FAIL (kéo lại Dev)
```

- **Điều phối:** `src/agents/StageRouter.ts`
- **Memory qua comment Trello:** agent ghi `🧠 [AI MEMORY]` sau mỗi stage và nạp lại khi chạy lại — `src/agents/CardMemory.ts`
- **Epic → card con + tracker:** `src/agents/EpicManager.ts`
- Agent trả lời **tiếng Việt**; nhiều task chạy song song (`QUEUE_CONCURRENCY`).

## Điều khiển trên Trello

- Chốt kế hoạch: gắn nhãn **`plan approve`**.
- Trong khi Planning, admin (trong `ADMIN_TRELLO_MEMBER_IDS`) reply comment:
  - `MODIFY: {hướng dẫn}` — chỉnh lại plan
  - `RETRY` / `THỬ LẠI` / `CHẠY LẠI` — lập lại plan (kể cả khi task lỗi)
  - `REJECT` / `HUỶ` — huỷ task

## Yêu cầu

- Node.js 18+
- **Claude CLI** đã đăng nhập (credentials ở `~/.claude`)
- Một board Trello có các list **`Epic` / `Planning` / `Dev` / `Test`** và nhãn **`AI`**, **`plan approve`**
- Repo đích đã clone sẵn (agent thao tác qua git worktree)

## Cài đặt & chạy

```bash
npm install
cp .env.example .env     # rồi điền cấu hình (xem bên dưới)
npm run dev
```

Kiểm tra type: `npx tsc --noEmit`

## Cấu hình (`.env`)

`.env` **không** được commit (chứa secret). Copy từ `.env.example` và điền:

| Nhóm | Biến chính |
|------|-----------|
| Trello | `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, `TRELLO_BOARD_IDS`, `ADMIN_TRELLO_MEMBER_IDS` |
| List/nhãn | `TRELLO_EPIC_LIST_NAMES`, `TRELLO_PLANNING_LIST_NAMES`, `TRELLO_DEV_LIST_NAMES`, `TRELLO_TEST_LIST_NAMES`, `TRELLO_AI_LABEL_NAME`, `TRELLO_PLAN_APPROVE_LABEL_NAME` |
| Git | `GIT_REPO_PATH` (repo đích), `GIT_WORKTREE_BASE`, `GIT_DEFAULT_BASE_BRANCH` |
| Hành vi | `QUEUE_CONCURRENCY`, `PLANNING_TIMEOUT_MS`, `PLANNING_MAX_TURNS`, `MAX_TASK_PROCESSING_MINUTES` |
| Claude CLI | `CLAUDE_CLI_PATH` (để trống = tự dò) |

## Cấu trúc `src/`

| Thư mục | Vai trò |
|---------|---------|
| `agents/` | StageRouter, PlannerAgent, DevAgent, ReviewAgent, EpicManager, CardMemory |
| `trello/` | REST client, poller, webhook server, connector |
| `claude/` | Claude CLI client, prompt builder |
| `git/` `shell/` | GitClient, WorktreeManager, ShellExecutor (allowlist) |
| `queue/` `rules/` `risk/` `confirmation/` | hàng đợi, luật phân loại, giới hạn an toàn, xác nhận |
| `state/` | SQLite: tasks, conversations, review_results… |

## An toàn

- Agent chỉ commit trong **worktree riêng** của task, không đụng repo chính.
- `GitClient` từ chối merge vào nhánh được bảo vệ (`dev`/`main`).
- `ShellExecutor` chỉ chạy lệnh trong allowlist; dead-man's switch tự dừng task treo.

## Trạng thái

Đã refactor sang luồng stage-list + epic + memory qua comment. Typecheck sạch; **chưa** test end-to-end với Trello thật — xem [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).
