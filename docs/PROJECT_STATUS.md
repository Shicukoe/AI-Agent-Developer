# Trạng thái dự án & Handoff — AutoPilot Agent

> Đọc cùng [`../CLAUDE.md`](../CLAUDE.md) (quy ước + kiến trúc tóm tắt) và
> [`ARCHITECTURE.md`](ARCHITECTURE.md) (đào sâu từng hệ con).

## Đây là gì
Hệ multi-agent chạy local: nhận task từ **Trello** → dùng **Claude** (CLI hoặc API) phân tích / viết
code / review → thao tác **git** trên repo đích. **Đa-repo**: 1 cài đặt phục vụ nhiều dự án, mỗi
**board Trello = 1 repo** (cấu hình qua trang Admin).

## Kiến trúc hiện tại (stage-list, đa-repo)
Card điều phối theo **list nó đang nằm**; phải có nhãn **`AI`**. Repo của card xác định theo **board**.

```
TrelloConnector (poll/webhook, quét watchedBoardIds)
 → StageRouter.dispatch → resolve repo theo board → TaskQueue.run
   [Refine]   Triage (fast-path tí hon) → BusinessAnalyst → TechnicalRefiner (định tuyến)
   [Epic]     PlannerAgent → "plan approve" → EpicManager sinh card con (integration branch)
   [Planning] PlannerAgent → "plan approve"
   [Dev]      DevAgent (hoặc executor theo kind) — worktree từ base branch của repo
   [Test]     ReviewAgent — (a) review worktree  (b) review nhánh/range người tự code (auto-incremental)
```

## Tính năng chính (đã làm trong các vòng gần đây)
- **Đa-repo theo board** — `repos/RepoRegistry.ts`, bảng `repo_configs`, cấu hình qua **Admin → Repos**;
  base branch theo từng repo (dev/staging/main). `watchedBoardIds` tự gồm board cấu hình qua admin.
- **Refine pipeline** — Triage (fast-path + nhãn `quick`) → BusinessAnalyst (nghiệp vụ) → TechnicalRefiner
  (kỹ thuật + định tuyến). Mô tả card cuối gồm 🎯 nghiệp vụ + 🔧 kỹ thuật + ✅ nghiệm thu + 📌 gốc.
- **Project Knowledge đa-tầng** — `overview.md` + `flows/<key>.md`; mỗi task chỉ bơm overview + luồng
  liên quan (chọn bằng 1 LLM rẻ, cache vào task). Dựng cache chạy NỀN, không chặn refine.
- **Test = tester độc lập** — review worktree (Dev→Test) HOẶC review nhánh/range của code người tự viết
  (`Branch/Base/Range/Since` + **auto-incremental** theo mốc commit `review_marks`).
- **Admin backend** — dashboard task + cấu hình repo (`/admin`, token `ADMIN_API_TOKEN`).
- **Độ bền** — `runForJson` retry tối đa 2; BA/Tech fallback chống crash; timeout cấu hình qua `.env`.

> ⚠️ `docs/plan.md` là plan v1 (large/small + fan-out) **đã lỗi thời**. Trạng thái đúng = file này +
> CLAUDE.md + ARCHITECTURE.md. `agents/RefineAgent.ts`, `agents/AnalystAgent.ts` là code chết.

## Mức kiểm thử
- ✅ `npx tsc --noEmit` sạch · ✅ unit (vitest) 21/21 pass.
- ⚠️ E2E Trello: chạy thực để xác nhận (đa-repo, refine pipeline, knowledge cache, tester modes).
- ⚠️ Trên repo lớn, Claude **CLI** đôi khi timeout/thiếu-JSON → đã có retry + fallback; ổn định nhất là
  đặt `ANTHROPIC_API_KEY` (các bước JSON đi API).

## Chạy
```bash
cp .env.example .env   # TRELLO_*, GIT_REPO_PATH, GIT_WORKTREE_BASE, ADMIN_API_TOKEN, (ANTHROPIC_API_KEY tuỳ chọn)
npm install
npm run dev            # cần đăng nhập Claude CLI, hoặc đặt ANTHROPIC_API_KEY
```
- Mở **admin** `http://127.0.0.1:3457/admin` → tab **Repos** map `board id → repo path → base branch`.
- Board cần list `Refine/Planning/Dev/Test/Epic` + nhãn `AI`, `plan approve`, `quick`.
- Thẻ **Info** trên mỗi board tự sinh/cập nhật hướng dẫn (gồm cách dùng tester modes).

## Tách workspace / di chuyển máy (KHÔNG theo git — tự giữ)
`.gitignore` bỏ qua:
- **`.env`** — secret + `GIT_REPO_PATH`/`GIT_WORKTREE_BASE` + `ADMIN_API_TOKEN`. Copy thủ công.
- **`data/agent.db`** (SQLite) — trạng thái task + cấu hình repo (`repo_configs`) + mốc review
  (`review_marks`). Giữ để liền mạch; xoá là khởi động sạch (phải cấu hình lại repo).
- **`data/knowledge/`** — cache hiểu dự án (dựng lại được).
- **`node_modules/`** — `npm install` lại.

> Lưu ý đa-repo: `repo_path` trong admin là đường dẫn **trên máy chạy agent**. Khi đổi máy, clone lại
> repo và cập nhật path trong admin cho khớp.

## Git
Thư mục chưa phải repo git (`.gitignore` sẵn sàng). Quản lý độc lập: `git init` rồi commit (secret đã ignore).
