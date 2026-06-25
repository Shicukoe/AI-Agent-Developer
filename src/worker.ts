import 'dotenv/config';
import { getDb } from './state/db.js';
import { TrelloConnector } from './trello/TrelloConnector.js';
import { TrelloClient } from './trello/TrelloClient.js';
import { StageRouter } from './agents/StageRouter.js';
import { ConfirmationManager } from './confirmation/ConfirmationManager.js';
import { TaskRepository } from './state/TaskRepository.js';
import { WorktreeManager } from './git/WorktreeManager.js';
import { config, stageForListName, hasAiLabel, firstInfoListName } from './config.js';
import { RepoRegistry } from './repos/RepoRegistry.js';
import { childLogger } from './utils/logger.js';
import type { TrelloEvent, TrelloCard, TrelloList } from './trello/types.js';
import type { AdminCommandMsg, AdminResultMsg } from './supervisor/ipc.js';

/** Worker phục vụ ĐÚNG 1 dự án (repo_config). Resolve qua AUTOPILOT_REPO_KEY do supervisor truyền. */
const repoKey = process.env.AUTOPILOT_REPO_KEY || 'default';
const projects = RepoRegistry.listProjects();
const project = projects.find(p => p.key === repoKey) ?? projects[0];
const log = childLogger('worker', { project: project.key });

function isLabelName(name: string, configured: string): boolean {
  return name.toLowerCase() === configured.toLowerCase();
}

const INFO_CARD_TITLE = 'AutoPilot Agent Instructions';
const INFO_CARD_MARKER = '📝 [AI AGENT] Setup instructions';

function createInfoCardDescription(): string {
  return (
    `${INFO_CARD_MARKER}\n\n` +
    `Đây là thẻ hướng dẫn dành cho AutoPilot Agent. Giữ thẻ này trong list **${firstInfoListName()}** để làm tài liệu tham khảo.\n\n` +
    `## 🤖 Board FULL-AUTO (bật nút robot ở admin → Repos)\n` +
    `Chỉ cần **tạo card + gắn nhãn \`AI\`** → agent TỰ chạy hết: **BA → BA kỹ thuật → Plan (khi cần) → Dev → Test (lặp tới khi đạt) → Done**.\n` +
    `• KHÔNG cần kéo card qua các list — agent tự chuyển. Card xong tự nằm ở list **Done**.\n` +
    `• Gắn thêm nhãn **\`BA kỹ thuật\`** nếu muốn AI phân tích kỹ thuật sâu + sinh test case.\n` +
    `• Test PASS → KHÔNG auto-merge: branch \`feature/...\` sẵn sàng, bạn tự review + merge.\n` +
    `• Sửa nhiều lần vẫn FAIL (quá ngưỡng) / cần làm rõ → agent dừng (halt) chờ bạn xem.\n\n` +
    `---\n` +
    `## ✋ Board THƯỜNG (không bật full-auto)\n` +
    `• Để kích hoạt agent cho một task, gắn nhãn **AI** lên card.\n` +
    `• Task còn sơ sài? Kéo vào list **Refine** để AI làm rõ & chuẩn hoá; trả lời câu hỏi rồi reply \`REFINE\`.\n` +
    `• Gắn nhãn **plan approve** khi kế hoạch đã được duyệt; tự kéo card qua **Dev**, **Test**.\n` +
    `• Các list quan trọng: **Refine**, **Epic**, **Planning**, **Dev**, **Test**, **Done**.\n` +
    `• Tài liệu dự án (cho Refine) nằm ở thư mục \`docs/\` — sinh bằng \`npm run gen-docs\` hoặc nút **Generate docs** ở admin.\n` +
    `• Không xoá thẻ này; nó là tài liệu setup cho board.\n\n` +
    `---\n` +
    `## 🧪 Luồng "bạn tự code → agent review" (Refine + Test)\n` +
    `Dùng khi bạn (dev) tự viết code, agent đóng vai **BA** (Refine) và **tester** (Test).\n\n` +
    `**Bước làm:**\n` +
    `1. (Tuỳ chọn) Kéo card sang **Refine** để agent chuẩn hoá yêu cầu + tiêu chí nghiệm thu.\n` +
    `2. Code xong, \`git push\`. Thêm vào **mô tả card** một dòng chỉ định phần cần review (chọn 1 cách):\n` +
    `   • \`Branch: staging\` — **AUTO**: review **commit mới kể từ lần review trước** (lần đầu so với base branch).\n` +
    `   • \`Branch: feature/<x>\` + \`Base: dev\` — khi đã **merge vào staging**: so với nhánh **CHƯA chứa** thay đổi.\n` +
    `   • \`Range: dev..staging\` / \`Commits: <sha-cũ>..staging\` — review đúng dải commit.\n` +
    `   • \`Branch: staging\` + \`Since: <sha>\` — từ commit đó tới đầu nhánh.\n` +
    `3. Kéo card sang **Test**. Agent review **chỉ-đọc** (chỉ \`fetch\`+\`diff\`, không đụng nhánh, không tự merge).\n` +
    `4. **PASS** → bạn tự merge/promote. **FAIL** → sửa, push lại, kéo lại **Test** (hoặc reply \`RETRY\`).\n` +
    `> ⚠️ Đừng so trực tiếp với chính nhánh đã merge vào — diff sẽ rỗng. Luôn so với nhánh **chưa chứa** thay đổi.\n`
  );
}

function isInfoCard(card: TrelloCard): boolean {
  return card.name === INFO_CARD_TITLE || card.desc.includes(INFO_CARD_MARKER);
}

async function findExistingInfoCard(lists: TrelloList[]): Promise<TrelloCard | undefined> {
  for (const list of lists) {
    const cards = await TrelloClient.getCardsInList(list.id);
    const found = cards.find(isInfoCard);
    if (found) return found;
  }
  return undefined;
}

async function ensureBoardInfoCard(boardId: string): Promise<void> {
  const lists = await TrelloClient.getLists(boardId);
  const infoListName = firstInfoListName();
  let infoList = lists.find(l => l.name.toUpperCase() === infoListName.toUpperCase());
  if (!infoList) {
    infoList = await TrelloClient.createList(boardId, infoListName);
    log.info({ boardId, listName: infoListName }, 'Created missing Info list');
  }
  const existing = await findExistingInfoCard(lists);
  if (existing) {
    if (existing.idList !== infoList.id) await TrelloClient.moveCard(existing.id, infoList.id).catch(() => {});
    const latest = createInfoCardDescription();
    if (existing.desc !== latest) await TrelloClient.updateCardDescription(existing.id, latest).catch(() => {});
    return;
  }
  await TrelloClient.createCard(infoList.id, INFO_CARD_TITLE, createInfoCardDescription());
  log.info({ boardId, listId: infoList.id }, 'Created Info instruction card');
}

/** Quét card có nhãn AI đang nằm trong list stage (chỉ board của worker) khi khởi động. */
async function scanExistingStageCards(): Promise<void> {
  for (const boardId of project.boardIds) {
    let lists: TrelloList[];
    try { lists = await TrelloClient.getLists(boardId); }
    catch (err) { log.error({ err, boardId }, 'scan: không lấy được lists'); continue; }
    const stageLists = lists.map(l => ({ list: l, stage: stageForListName(l.name) })).filter(x => x.stage);
    for (const { list, stage } of stageLists) {
      let cards: TrelloCard[];
      try { cards = await TrelloClient.getCardsInList(list.id); }
      catch (err) { log.error({ err, listId: list.id }, 'scan: không lấy được cards'); continue; }
      for (const card of cards) {
        if (!hasAiLabel(card.labels ?? [])) continue;
        if (TaskRepository.findByCardId(card.id)) continue;   // đã có Task — bỏ qua khi khởi động
        log.info({ cardId: card.id, list: list.name, stage }, 'scan: routing AI card');
        StageRouter.dispatch(stage!, card, list.id);
      }
    }
  }
}

async function dispatchStageIfAi(cardId: string, stage: NonNullable<ReturnType<typeof stageForListName>>, listId: string): Promise<void> {
  const card = await TrelloClient.getCard(cardId);
  if (!hasAiLabel(card.labels ?? [])) return;
  StageRouter.dispatch(stage, card, listId);
}

/** Xử lý lệnh admin từ supervisor (IPC) — trong ngữ cảnh repo của worker này. */
const IN_FLIGHT = new Set(['processing', 'developing', 'testing']);
async function handleAdminCommand(msg: AdminCommandMsg): Promise<AdminResultMsg> {
  const base = { type: 'admin-result' as const, id: msg.id };
  const task = TaskRepository.findById(msg.taskId);
  if (!task) return { ...base, ok: false, code: 'not_found', error: 'Task không tồn tại' };
  if ((msg.cmd === 'rerun' || msg.cmd === 'modify') && IN_FLIGHT.has(task.status)) {
    return { ...base, ok: false, code: 'in_flight', error: `Task đang chạy (${task.status})` };
  }
  if (msg.cmd === 'rerun') {
    const card = await TrelloClient.getCard(task.card_id);
    const lists = await TrelloClient.getLists(card.idBoard);
    const stage = stageForListName(lists.find(l => l.id === card.idList)?.name ?? '');
    if (!stage) return { ...base, ok: false, code: 'bad_request', error: 'Card không ở list stage nào' };
    StageRouter.dispatch(stage, card, card.idList, true);   // force: Rerun là chạy lại CÓ CHỦ ĐÍCH (bỏ guard idempotency)
    return { ...base, ok: true, data: { stage } };
  }
  if (msg.cmd === 'modify') {
    void StageRouter.runPlanning(task, msg.payload?.instruction || undefined);
    return { ...base, ok: true };
  }
  if (msg.cmd === 'cancel') {
    TaskRepository.setStatus(task.id, 'failed', { error_message: 'Hủy bởi admin' });
    if (task.worktree_path) await WorktreeManager.remove(task.id).catch(() => {});
    await TrelloClient.addComment(task.card_id, '❌ **[ADMIN]** Task đã bị hủy.').catch(() => {});
    return { ...base, ok: true };
  }
  return { ...base, ok: false, code: 'bad_request', error: 'Lệnh không hỗ trợ' };
}

async function main(): Promise<void> {
  log.info({ repo: project.repoPath, boards: project.boardIds, baseBranch: project.baseBranch }, '👷 Worker starting');
  getDb();

  const connector = new TrelloConnector(project.boardIds);
  connector.on('trello:event', async (event: TrelloEvent) => {
    try {
      if (event.type === 'card:moved_to_stage') { await dispatchStageIfAi(event.cardId, event.stage, event.listId); return; }
      if (event.type === 'card:label_added') {
        if (isLabelName(event.labelName, config.TRELLO_PLAN_APPROVE_LABEL_NAME)) { await StageRouter.onPlanApprove(event.cardId); return; }
        if (isLabelName(event.labelName, config.TRELLO_AI_LABEL_NAME)) {
          const card = await TrelloClient.getCard(event.cardId);
          if (isInfoCard(card)) return;
          const lists = await TrelloClient.getLists(event.boardId);
          const stage = stageForListName(lists.find(l => l.id === card.idList)?.name ?? '');
          if (stage) { StageRouter.dispatch(stage, card, card.idList); return; }
          // Card KHÔNG ở list stage nào. Board full-auto: chỉ cần gắn nhãn AI là TỰ kéo sang Refine + chạy
          // (poller thấy move → dispatch refine). Board thường: giữ nguyên — người tự kéo vào Refine.
          if (RepoRegistry.autoPilotForBoard(event.boardId)) {
            const want = config.TRELLO_REFINE_LIST_NAMES.map(n => n.trim().toLowerCase());
            const refineList = lists.find(l => want.includes(l.name.trim().toLowerCase()));
            if (refineList) {
              await TrelloClient.moveCard(card.id, refineList.id).catch(() => {});
              log.info({ cardId: card.id }, 'Auto-pilot: gắn nhãn AI → tự kéo sang Refine');
            }
          }
        }
        return;
      }
      if (event.type === 'comment:added') { await ConfirmationManager.handleAdminReply(event.cardId, event.memberId, event.text); return; }
    } catch (err) { log.error({ err, event }, 'Lỗi xử lý Trello event'); }
  });
  connector.start();
  log.info({ mode: config.TRELLO_USE_WEBHOOK ? 'webhook' : 'polling' }, 'Connector started');

  for (const boardId of project.boardIds) {
    await ensureBoardInfoCard(boardId).catch(err => log.error({ boardId, err }, 'ensureBoardInfoCard lỗi'));
  }
  await scanExistingStageCards().catch(err => log.error({ err }, 'scan lỗi'));

  // Nhận lệnh admin từ supervisor (IPC).
  process.on('message', (msg: AdminCommandMsg) => {
    if (msg?.type !== 'admin-command') return;
    handleAdminCommand(msg).then(res => process.send?.(res)).catch(err =>
      process.send?.({ type: 'admin-result', id: msg.id, ok: false, code: 'error', error: String(err) }));
  });

  // Dead man's switch — chỉ task của repo này.
  setInterval(async () => {
    const stale = TaskRepository.findStaleTasks(config.MAX_TASK_PROCESSING_MINUTES)
      .filter(t => (t.repo_key || 'default') === project.key);
    for (const task of stale) {
      log.warn({ taskId: task.id }, 'Dead man: halt stale task');
      TaskRepository.setStatus(task.id, 'halted', { error_message: 'Halted by dead man\'s switch' });
      await TrelloClient.addComment(task.card_id, `🛑 **[AI AGENT]** Task tự dừng sau ${config.MAX_TASK_PROCESSING_MINUTES} phút không phản hồi.`).catch(() => {});
      if (task.worktree_path) await WorktreeManager.remove(task.id).catch(() => {});
    }
  }, 5 * 60 * 1000);

  log.info({ project: project.key }, '✅ Worker ready');
}

main().catch(err => { log.error({ err }, 'Worker fatal'); process.exit(1); });
