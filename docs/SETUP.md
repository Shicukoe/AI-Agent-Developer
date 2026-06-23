# Hướng dẫn cài đặt & chạy thử — AutoPilot Agent

Tài liệu này để **dựng môi trường dev và test** từ đầu. Kiến trúc/quy ước: [`../CLAUDE.md`](../CLAUDE.md);
chi tiết hệ con: [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. Yêu cầu

- **Node.js ≥ 20** + npm.
- **Claude** (1 trong 2):
  - **Claude CLI** đã đăng nhập (Pro/Max): chạy `claude` một lần, `/login`. (Dev agent luôn dùng CLI.)
  - hoặc **API key**: đặt `ANTHROPIC_API_KEY` trong `.env` → các bước JSON (Refine/Test…) đi API, ổn
    định hơn CLI. **Khuyến nghị bật API key** cho repo lớn (CLI hay timeout/thiếu-JSON).
- **git** + quyền truy cập repo đích (đã `git clone` repo về máy).
- Tài khoản **Trello** + board, và **API key/token** Trello (lấy ở https://trello.com/app-key).

---

## 2. Cài đặt

```bash
cd ai-agent-developer
npm install
cp .env.example .env      # rồi sửa .env (xem mục 3)
```

---

## 3. Cấu hình `.env` (tối thiểu để test)

```ini
# Trello
TRELLO_API_KEY=...            # trello.com/app-key
TRELLO_API_TOKEN=...          # token sinh từ trang trên (tài khoản phải là thành viên board)
TRELLO_BOARD_IDS=             # có thể để TRỐNG nếu cấu hình repo qua admin (mục 5)

# Claude — chọn 1
ANTHROPIC_API_KEY=sk-ant-...  # (khuyến nghị) hoặc để trống và đăng nhập Claude CLI

# Git (repo MẶC ĐỊNH khi chưa map board nào trong admin)
GIT_REPO_PATH=D:\path\to\your-repo
GIT_WORKTREE_BASE=D:\path\to\agent-worktrees   # ngoài repo
GIT_DEFAULT_BASE_BRANCH=dev

# Admin (BẬT trang quản trị — bắt buộc để cấu hình đa-repo + xem task)
ADMIN_API_TOKEN=dat-mot-chuoi-manh
# ADMIN_BIND_HOST=0.0.0.0     # mở để truy cập từ máy khác (mặc định chỉ localhost)
```

> Nhãn trên board (mặc định): `AI` (công tắc), `plan approve` (chốt plan), `quick` (làm ngay).
> Tên list mặc định: `Refine`, `Planning`, `Dev`, `Test`, `Epic`, `Info`, `Docs`.

---

## 4. Chuẩn bị board Trello

1. Tạo board, tạo các list: **Refine, Planning, Dev, Test, Epic, Info** (đúng tên, không phân biệt hoa thường).
2. Tạo nhãn: **AI**, **plan approve**, **quick**.
3. Lấy **board id**: mở board → thêm `.json` vào URL, hoặc copy từ URL `trello.com/b/<boardId>/...`.

> Tài khoản tạo `TRELLO_API_TOKEN` **phải là thành viên** board (nếu không poller sẽ 401/403).

---

## 5. Chạy + cấu hình repo (đa-repo qua admin)

```bash
npm run dev        # chạy supervisor → fork worker cho mỗi dự án
```

Mở **admin**: `http://127.0.0.1:3457/admin` → nhập `ADMIN_API_TOKEN` → tab **Repos / Dự án**.

Thêm dự án: **Board ID** + **Tên** + **Repo path** (đường dẫn repo ĐÃ clone **trên máy chạy agent**) +
**Base branch** (`dev`/`staging`/`main`) + (tùy chọn) **Docs path** + (tùy chọn) **Repo ngữ cảnh (chỉ đọc)**.
Bấm **Lưu**.

- **Repo ngữ cảnh (chỉ đọc):** mỗi dòng 1 đường dẫn repo KHÁC để agent **đọc tham khảo** module liên quan
  (vd `Permit`) khi task tham chiếu chéo. Agent chỉ ĐỌC các repo này; **vẫn chỉ ghi code/commit ở repo chính**.

- **Tự chuẩn bị board:** khi **Lưu** repo mới, agent tự tạo các **list** (`Refine/Planning/Dev/Test/Epic/
  Info/Docs`) + **label** (`AI`, `plan approve`, `quick`, `BA kỹ thuật`) còn thiếu trên board — không phải
  tạo tay. Board cũ → bấm nút **Tạo list/label** ở dòng repo để bổ sung (idempotent, chạy lại an toàn).
- Mỗi repo_config = **1 worker process riêng** (cách ly lỗi). Sửa/thêm/xoá repo → supervisor tự
  thêm/bớt/restart worker (không cần restart tay).
- Nếu **không** cấu hình repo nào → 1 worker "default" dùng `GIT_REPO_PATH` + `TRELLO_BOARD_IDS` từ `.env`.

---

## 6. Sinh tài liệu dự án (gen-docs) — nên làm 1 lần/repo

Refine (BA) đọc **tài liệu thật trong repo** (`<repo>/docs`). Sinh tài liệu:

- Trên admin: nút **Generate docs** ở dòng repo (chạy nền). Hoặc CLI:
  ```bash
  npm run gen-docs -- <board_id>          # hoặc <repo_path>; trống = repo mặc định
  npm run gen-docs -- <board_id> --full   # ép sinh lại TOÀN BỘ
  ```
- Agent ghi `docs/00_TONG_THE.md` (tổng thể), `docs/<chức-năng>.md` (mỗi luồng/chức năng),
  `docs/00_BAN_DO_TAI_LIEU.md` (bản đồ). **Review rồi `git commit`** (gồm cả `.docs_sync.json`).
- **Incremental:** lần sau gen-docs chỉ đọc **commit mới kể từ lần trước** (mốc lưu ở `docs/.docs_sync.json`)
  và cập nhật đúng doc bị ảnh hưởng → nhanh & ít token. Lần đầu (chưa có mốc) sinh đầy đủ. Chỉ chạy KHI yêu cầu.
- **docs path:** mặc định `<repo_root>/docs`. Repo có code trong **module con** (vd Odoo
  `cons_weekly_report/`) → vào admin đặt **Docs path** = `cons_weekly_report/docs` cho khớp nơi team để docs,
  nếu không docs sẽ nằm ở `<repo_root>/docs`.
- Chưa có docs vẫn chạy được: agent **fallback đọc thẳng code** + nhắc chạy gen-docs.

---

## 7. Cách TEST từng luồng

### A. Refine (agent làm rõ task)
Tạo card sơ sài, gắn nhãn **AI**, kéo vào list **Refine**. **MẶC ĐỊNH chỉ làm rõ NGHIỆP VỤ** (Triage → BA):
- Ghi đè mô tả card: `🎯 Yêu cầu nghiệp vụ` + `✅ Tiêu chí nghiệm thu (nghiệp vụ)` + `🛠️ Ghi chú Dev` + `📌 Yêu cầu gốc`.
- Test về sau **chỉ chấm tiêu chí nghiệp vụ** → tránh fail oan khi dev giải khác cách kỹ thuật.
- Cần AI phân tích **kỹ thuật** (thêm `🔧 Yêu cầu kỹ thuật` + `🧪 Trường hợp kiểm thử`) → gắn nhãn
  **`BA kỹ thuật`** rồi kéo Refine (hoặc reply `REFINE`).
- Task tí hon (hoặc nhãn `quick`) → gợi ý kéo thẳng **Dev**. Thiếu thông tin → hỏi (bổ sung rồi reply `REFINE`).

### B. Agent tự code (Dev → Test)
Sau Refine, gắn **plan approve** (nếu qua Planning) → kéo card sang **Dev**: agent tạo branch từ base
branch, code, commit. Kéo sang **Test**: ReviewAgent **đọc code thật** (Read/Glob/Grep) đối chiếu tiêu chí
nghiệm thu + `test_cases` → **PASS / FAIL / NEEDS_INFO**.

> **Ghi chú Dev (hướng test):** dev ghi vào mục **`## 🛠️ Ghi chú Dev`** trong mô tả card **HOẶC** viết một
> **comment** bắt đầu bằng `DEV:` / `[DEV]` / `Hướng test:` (đã làm gì, vì sao, tester nên kiểm luồng nào).
> Reviewer đọc cả hai và **test theo hướng dev** — dev làm khác spec mà đạt mục tiêu vẫn hợp lệ.
> Kết quả review có **Cách test** (ngắn gọn) + **Checklist** checkbox từng tiêu chí (✅ đạt / ❌ lỗi).

### C. Bạn tự code, agent làm **tester** (Refine + Test)
Bạn tự viết code + `git push`, rồi **chỉ kéo card sang Test** — agent **tự dò nhánh mới push** để review.
Muốn chỉ định rõ thì thêm 1 dòng vào **mô tả card** (không bắt buộc):
- `Branch: staging` → agent review **commit mới kể từ lần trước** (auto-incremental); lần đầu so base branch.
- `Branch: feature/x` + `Base: dev` → so với nhánh **chưa chứa** thay đổi (đã merge staging vẫn đúng).
- `Range: dev..staging` / `Branch: staging` + `Since: <sha>` → review đúng dải commit.

Kéo card sang **Test** → agent review **chỉ-đọc** (fetch+diff + đọc file để xác minh, không sửa/merge).
**3 kết quả:** PASS → bạn tự merge; FAIL → mỗi lỗi kèm `file:dòng` + gợi ý; **NEEDS_INFO** → chưa kết luận
được (cần config/UI/dữ liệu) → agent nêu **checklist cần kiểm tra/làm trước khi sửa**, không tiến mốc.

> Review là task **nặng**: muốn dùng model mạnh hơn cho nó, đặt `REVIEW_MODEL` trong `.env` (vd
> `claude-opus-4-8` khi đi API, hoặc `opus` khi dùng Claude CLI). Trống = dùng `CLAUDE_MODEL`.

### D. Kiểm tra ĐA-PROCESS
- Cấu hình ≥2 repo (2 board) trong admin → log có 2 worker (`worker` + `project=<key>`).
- Tạo task ở mỗi board → 2 worker chạy độc lập. Kill 1 worker (Task Manager) → tự restart, repo kia không sao.
- Admin **rerun/cancel** 1 task → đúng worker xử lý (qua IPC).

---

## 8. Theo dõi & điều khiển (admin)

- Tab **Tasks**: danh sách task (cột **Dự án** phân biệt repo), KPI, lọc/tìm; bấm task xem chi tiết +
  rerun / bổ sung thông tin / lập lại kế hoạch / hủy.
- Tab **Repos / Dự án**: map board→repo, base branch, docs path, Generate docs, bật/tắt/xoá.

---

## 9. Build production

```bash
npm run build       # tsc + copy-assets (schema.sql, rules.yaml)
npm start           # node dist/supervisor.js
```

---

## 10. Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| Kéo card vào Refine **không phản ứng** | Board chưa được poll → cấu hình repo cho board đó trong admin (hoặc thêm vào `TRELLO_BOARD_IDS`). Card phải có nhãn **AI**. |
| Comment "Board chưa được cấu hình repo" | Đã có ≥1 repo cấu hình nhưng board này chưa map → vào admin map board. |
| `Claude CLI timed out` / `No valid JSON` | CLI thất thường trên repo lớn. Tăng `REFINE_TIMEOUT_MS`, hoặc **đặt `ANTHROPIC_API_KEY`** để đi API (ổn định nhất). Đã có retry≤2 + fallback nên hiếm khi crash. |
| Poll error 401/403 | Token Trello không phải thành viên board. |
| Admin mở từ máy khác không vào | Đặt `ADMIN_BIND_HOST=0.0.0.0` + mở cổng `ADMIN_PORT` (3457) + token mạnh. |
| BA báo "chưa có tài liệu" | Chạy **gen-docs** cho repo (mục 6) rồi commit docs. |

---

## 11. Dữ liệu local (không theo git)
- `.env` (secret), `data/agent.db` (SQLite: task + repo_configs + review_marks), `data/`,
  `node_modules/`. Đổi máy: clone lại repo đích + cập nhật **repo path trong admin** cho khớp máy mới.
