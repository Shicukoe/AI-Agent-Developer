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
            → [Refine]   runRefine    → RefineAgent (làm rõ + chuẩn hoá task, ghi đè mô tả)
            → [Planning] runPlanning  → PlannerAgent → chờ nhãn "plan approve"
            → [Dev]      runDev       → DevAgent (code thẳng theo plan đã duyệt)
            → [Test]     runTest      → ReviewAgent (review diff, PASS/FAIL)
```

## Refine — làm rõ & chuẩn hoá task (cửa trước, tuỳ chọn)

Card sơ sài kéo vào list **`Refine`** (có nhãn AI): `RefineAgent` đọc card + codebase, **giải nghĩa
rõ từng chức năng**, **ghi đè mô tả card** theo format chuẩn (giữ "📌 Yêu cầu gốc" ở cuối), và phân loại:

- **small** → ghi sẵn spec ra `plan_file_path` + status `plan_approved` → kéo thẳng sang **Dev** (bỏ Planning).
- **large** → gợi ý kéo sang **Planning**. · **epic** → gợi ý kéo sang **Epic**.

Thiếu thông tin → đặt câu hỏi, status `awaiting_clarification`. Admin bổ sung vào card rồi reply
`REFINE` (hoặc `RETRY` khi card còn ở Refine) để chạy lại. Với task kiểu "thêm field", RefineAgent
điền `field_details` (kiểu dữ liệu, tên hiển thị, model, validation, default).

## Chọn executor theo `kind` — đa agent ở stage Dev

RefineAgent còn phân loại **`kind`** (năng lực/sản phẩm) và lưu vào `metadata.kind`. Ở stage **Dev**,
`StageRouter.runDev` đọc `kind` rồi `pickExecutor(kind)` (xem `agents/executors/registry.ts`):

- **`code`** (mặc định) → `DevAgent`: viết code trong worktree, commit → Test review diff.
- **`doc_card`** → `DocCardExecutor`: sinh nội dung tài liệu và **tạo một Trello card mới** (list theo
  `TRELLO_DOCS_LIST_NAMES` → Info → list nguồn), rồi set `completed` — **không qua git/Test**.

**Không tìm thấy executor** cho `kind` → runDev set `halted` và **comment báo admin** trên card.
Thêm năng lực/agent mới: bổ sung giá trị `TaskKind` (`claude/types.ts`) + một `Executor` +
đăng ký trong `executors/registry.ts` + dạy RefineAgent prompt phân loại kind đó.

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
   → gắn "plan approve" → EpicManager TẠO integration branch epic/<short> (từ dev) + N card con
        (theo thứ tự sequence), mỗi card:
        • mô tả có "Epic: <epicCardId>" + sequence + tiêu chí nghiệm thu
        • gắn sẵn nhãn AI + pre-approve (PLAN.md, status plan_approved); metadata: sequence, base_branch
        • 1 dòng trên checklist "Tasks" của epic
   → kéo card con theo THỨ TỰ sequence sang Dev → Test
        • Dev: branch tách từ integration branch epic/<short> (thấy code các card con trước)
        • cổng tuần tự: card con chưa tới lượt (còn card sequence nhỏ hơn chưa completed) sẽ bị chặn
   → card con Test PASS → TỰ MERGE branch con vào epic/<short> (conflict → review_failed, kéo lại Dev)
        → tick checklist + nhắc card con kế tiếp
   → tất cả card con xong → epic/<short> sẵn sàng để bạn merge thủ công vào dev
```

> **Epic A+B (tuần tự + integration branch):** card con không còn branch độc lập từ `dev` mà nối tiếp
> nhau trên `epic/<short>`, nên card sau thấy được code card trước (hết lỗi "thiếu code") và conflict
> được phát hiện/giải quyết từng bước thay vì dồn về cuối. Merge được serialize theo epic (mutex).
> Epic cũ (tạo trước cơ chế này, không có `base_branch`) vẫn chạy kiểu cũ: branch từ `dev`, merge tay.

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
