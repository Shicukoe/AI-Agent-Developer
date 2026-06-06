# AutoPilot Agent — Project Conventions

Hệ thống multi-agent AI tự động xử lý task từ Trello, viết code, và review.

> 📌 Trạng thái hiện tại + hướng dẫn mở workspace độc lập: [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).
> `docs/plan.md` là plan v1 đã lỗi thời (giữ làm lịch sử).

## Tổng quan kiến trúc — luồng 3 stage list

Card được điều phối theo **list nó đang nằm** trên Trello (kéo card = chuyển stage). Card phải có
nhãn **`AI`** (công tắc) thì agent mới xử lý.

```
TrelloConnector (webhook/poll)
    → StageRouter.dispatch(stage, card)        ← route theo list
        → TaskQueue.run (p-queue, concurrency=3)
            → [Planning] runPlanning  → PlannerAgent → chờ nhãn "plan approve"
            → [Dev]      runDev       → DevAgent (code thẳng theo plan đã duyệt)
            → [Test]     runTest      → ReviewAgent (review diff, PASS/FAIL)
```

- **Một card = một Task record duy nhất**, đi qua các stage theo thời gian.
- Duyệt plan bằng cách **gắn nhãn `plan approve`** (không qua comment APPROVE nữa).
- Comment `MODIFY: ...` / `RETRY` / `REJECT` của admin điều khiển lại stage Planning.
- Người dùng **tự kéo card** giữa các list; agent không tự di chuyển card.

## Quy ước code

- **TypeScript strict mode** — không dùng `any`, không tắt type errors
- **ESM modules** (`"type": "module"`) — dùng `.js` extension trong imports
- **Không có sideeffects** trong module-level code trừ `index.ts`
- **Mỗi class/object lớn một file riêng**

## Cấu trúc src/

| Thư mục | Mục đích |
|---------|---------|
| `agents/` | 5 agent types: Orchestrator, Planner, Analyst, Dev, Review |
| `trello/` | Kết nối Trello: REST client, webhook server, poller |
| `claude/` | Claude API: client, prompt builder, conversation store |
| `vision/` | Claude Vision: phân tích ảnh thiết kế và screenshot bug |
| `git/` | Git operations: GitClient, WorktreeManager |
| `shell/` | Shell execution với allowlist |
| `rules/` | RuleEngine + rules.yaml (hot-reload) |
| `risk/` | RiskGuard — hard limits enforcement |
| `actions/` | ActionRegistry — handlers cho mỗi action type |
| `confirmation/` | ConfirmationManager — pause/resume/timeout |
| `queue/` | TaskQueue — p-queue concurrency |
| `state/` | SQLite: db, schema, repositories |
| `utils/` | logger, errors, retry |

## Epic — feature lớn cần nhiều task

Card đặt trong list **`Epic`** (có nhãn AI) = một feature lớn:

```
[Epic] kéo card vào list Epic → PlannerAgent lập plan tổng (nhiều phần việc) → chờ "plan approve"
   → gắn "plan approve" → EpicManager TỰ TẠO N card con (trong list Planning), mỗi card:
        • mô tả có dòng "Epic: <epicCardId>" (link ngược) + tiêu chí nghiệm thu
        • gắn sẵn nhãn AI + pre-approve (có PLAN.md, status plan_approved)
        • 1 dòng trên checklist "Tasks" của epic để theo dõi
   → bạn kéo từng card con sang Dev → Test (song song được)
   → card con Test PASS → tick checklist trên epic + ghi memory tiến độ
```

- **Card con / card điều chỉnh** có dòng `Epic: <id>` → Planner/Dev tự **nạp thêm context epic**
  (PLAN.md tổng + 🧠 memory của epic) qua `CardMemory.epicContext`. Đây là cách xử lý task phát
  sinh **sau khi feature đã hoàn thiện**: tạo card mới, ghi `Epic: <id>`, kéo qua Dev/Test.
- Epic là **nơi lưu tri thức feature lâu dài** (PLAN.md + memory tích luỹ), không tự đi Dev.
- Code: `agents/EpicManager.ts` (sinh card con, tick tiến độ), `agents/CardMemory.ts` (epicContext).

## Luồng 3 stage (cho từng card đơn / card con)

```
[Planning]  Kéo card (có nhãn AI) vào list Planning
            → PlannerAgent: phân tích + lập plan (PLAN.md) → post tóm tắt lên card
            → status 'awaiting_plan_approval'
            → admin có thể reply MODIFY: ... / RETRY để chỉnh, REJECT để huỷ
            → gắn nhãn "plan approve" → status 'plan_approved'

[Dev]       Người dùng kéo card sang list Dev
            → runDev: tạo feature branch từ dev, DevAgent code thẳng theo plan đã duyệt
            → commit → status 'dev_done' → nhắc kéo sang Test

[Test]      Người dùng kéo card sang list Test
            → ReviewAgent: review diff vs dev (Claude instance riêng)
            → PASS: status 'completed' (sẵn sàng merge) · FAIL: status 'review_failed' (kéo lại Dev)
```

> Lưu ý: luồng fan-out sub-task song song (sub-card + nhiều worktree) của bản cũ đã được thay bằng
> Dev một branch để khớp quy trình tuyến tính Plan→Dev→Test. `OrchestratorAgent` giờ chỉ giữ
> `handleError` dùng chung; điều phối nằm ở `StageRouter`.

## Risk management

- Agents chỉ commit vào worktree được giao, không đụng vào repo chính
- `RiskGuard` enforce max actions/turns/comments per task
- `GitClient.assertNotProtected()` từ chối merge vào main/dev/master
- `ShellExecutor` chỉ chạy lệnh trong allowlist
- Dead man's switch: task > 30 phút không heartbeat → auto halt

## Memory — ghi nhớ qua comment card

Agent **stateless mỗi lần gọi**; "ký ức" được đẩy ra **comment Trello** (xem `agents/CardMemory.ts`):

- Sau mỗi stage, agent **append** một comment mốc **`🧠 [AI MEMORY]`** (quyết định, đã làm gì, rủi ro,
  hoặc issue review khi FAIL).
- Khi **chạy lại / có yêu cầu mới**, Planner & Dev nạp lại: **mô tả card (yêu cầu mới nhất)** +
  **2 khối `🧠 [AI MEMORY]` gần nhất** + **vài comment admin gần nhất** (MODIFY/phản hồi).
- Mô tả card luôn được ưu tiên khi mâu thuẫn với ghi nhớ cũ.
- `PLAN.md` vẫn là kế hoạch chuẩn; memory chỉ ghi diễn biến/quyết định, **bổ sung** chứ không thay thế.
- **ReviewAgent (Test) cố ý KHÔNG nạp memory** — review độc lập để khách quan; nhưng khi FAIL nó *ghi*
  memory để vòng Dev sau đọc được.

Bảng SQLite `conversations` là nhật ký cũ, không còn nạp ngược vào prompt.

## Cấu hình

Tất cả config qua `.env` (xem `.env.example`). Không hardcode bất kỳ key hoặc URL nào.

`rules.yaml` hot-reload khi thay đổi — không cần restart.

## Trello — điều khiển stage Planning

Chốt plan: **gắn nhãn `plan approve`** lên card (rồi tự kéo card sang Dev).

Trong khi ở Planning, admin (trong `ADMIN_TRELLO_MEMBER_IDS`) có thể reply comment:
- `MODIFY: {hướng dẫn}` — chỉnh lại plan theo hướng dẫn
- `RETRY` — lập lại plan từ đầu (sau khi bổ sung thông tin vào card)
- `REJECT` — huỷ task

## Getting started

```bash
cp .env.example .env
# Điền TRELLO_API_KEY, TRELLO_API_TOKEN, ANTHROPIC_API_KEY, GIT_REPO_PATH

npm install
npm run dev
```
