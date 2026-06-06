# Trạng thái dự án & Handoff — AutoPilot Agent

> Tài liệu để mở dự án này như một **workspace độc lập** (tách khỏi `target-repo`).
> Đọc cùng [`../CLAUDE.md`](../CLAUDE.md) (quy ước + kiến trúc) — file đó tự nạp khi mở workspace.

## Đây là gì
Hệ multi-agent chạy local, nhận task từ **Trello** → dùng **Claude CLI** phân tích/viết code/review →
thực thi **git** trên một repo đích. Repo đích hiện tại: `target-repo` (cấu hình qua `.env`).

## Kiến trúc hiện tại (đã refactor sang luồng stage-list)
Card được điều phối theo **list nó đang nằm** trên Trello; card phải có nhãn **`AI`** mới được xử lý.

```
[Epic]     feature lớn → lập plan tổng → gắn "plan approve" → tự sinh N card con (link về epic)
[Planning] 1 task → lập plan → gắn "plan approve"
[Dev]      kéo card sang → code thẳng theo plan đã duyệt → "kéo sang Test"
[Test]     kéo card sang → ReviewAgent review diff → PASS/FAIL
```
- Điều phối: `src/agents/StageRouter.ts` (thay vai trò pipeline cũ của `OrchestratorAgent`).
- **Memory = comment Trello**: agent append comment `🧠 [AI MEMORY]` sau mỗi stage; khi chạy lại/
  có yêu cầu mới thì nạp lại (`src/agents/CardMemory.ts`).
- **Epic → card con**: `src/agents/EpicManager.ts` (sinh card con + checklist + tick tiến độ).
- Agent trả lời **tiếng Việt**; queue concurrency mặc định **10**; Planning timeout/turns cấu hình
  qua `.env` (`PLANNING_TIMEOUT_MS`, `PLANNING_MAX_TURNS`).

> ⚠️ `docs/plan.md` là plan v1 (mô hình large/small + fan-out sub-task) — **đã lỗi thời**, giữ làm
> tham khảo lịch sử. Trạng thái đúng là file này + CLAUDE.md.

## Mức kiểm thử
- ✅ `npx tsc --noEmit` sạch.
- ❌ **Chưa** test end-to-end với Trello thật (luồng stage/epic/memory cần chạy thực để xác nhận).

## Chạy
```bash
npm install
npm run dev
```
Yêu cầu: đã đăng nhập **Claude CLI** (credentials ở `~/.claude`); board Trello có các list
`Epic`/`Planning`/`Dev`/`Test` và nhãn `AI`, `plan approve`.

## Lưu ý khi tách workspace (KHÔNG theo git — phải tự giữ)
`.gitignore` bỏ qua các thứ sau, nên nếu **clone/sao chép sang nơi khác** chúng sẽ không đi theo:
- **`.env`** — chứa secret (Trello key/token) + `GIT_REPO_PATH`. **Phải copy thủ công.**
  - `GIT_REPO_PATH` đang trỏ về `target-repo` (đúng — đây là repo đích agent thao tác). Giữ nguyên
    trừ khi muốn đổi repo đích.
  - `GIT_WORKTREE_BASE=D:\Coding_Stuffs\agent-worktrees` (ngoài thư mục này).
- **`data/agent.db`** (SQLite) — lưu **trạng thái task đang chạy**. Giữ lại nếu muốn liền mạch; bỏ đi
  là khởi động sạch.
- **`node_modules/`** — chạy lại `npm install`.

Nếu chỉ **mở đúng thư mục này** làm workspace mới (không di chuyển file) thì `.env` và `data/` vẫn
nằm nguyên — không mất gì.

## Git
Thư mục **chưa phải repo git** (`.gitignore` đã sẵn sàng). Để quản lý độc lập: `git init` rồi commit
(các file nhạy cảm đã được ignore sẵn).

## Bộ nhớ Claude (auto-memory)
Ghi chú auto-memory về dự án này hiện nằm ở project `target-repo`, **sẽ không tự nạp** ở workspace
mới. Kiến thức cốt lõi đã nằm trong CLAUDE.md + file này (đi theo repo). Khi mở workspace mới, có thể
nhờ Claude tạo lại memory cho project đó.
