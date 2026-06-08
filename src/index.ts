import 'dotenv/config';
import { getDb, closeDb } from './state/db.js';
import { TrelloConnector } from './trello/TrelloConnector.js';
import { TrelloClient } from './trello/TrelloClient.js';
import { StageRouter } from './agents/StageRouter.js';
import { ConfirmationManager } from './confirmation/ConfirmationManager.js';
import { AdminServer } from './admin/AdminServer.js';
import { TaskRepository } from './state/TaskRepository.js';
import { WorktreeManager } from './git/WorktreeManager.js';
import { config, stageForListName, hasAiLabel, hasPlanApproveLabel, firstInfoListName } from './config.js';
import { logger } from './utils/logger.js';
import type { TrelloEvent, TrelloCard, TrelloList } from './trello/types.js';

function isLabelName(name: string, configured: string): boolean {
  return name.toLowerCase() === configured.toLowerCase();
}

const INFO_CARD_TITLE = 'AutoPilot Agent Instructions';
const INFO_CARD_MARKER = '📝 [AI AGENT] Setup instructions';

function createInfoCardDescription(): string {
  return (
    `${INFO_CARD_MARKER}\n\n` +
    `Đây là thẻ hướng dẫn dành cho AutoPilot Agent. Giữ thẻ này trong list **${firstInfoListName()}** để làm tài liệu tham khảo.\n\n` +
    `• Để kích hoạt agent cho một task, gắn nhãn **AI** lên card.\n` +
    `• Task còn sơ sài? Kéo vào list **Refine** để AI làm rõ & chuẩn hoá; trả lời câu hỏi rồi reply \`REFINE\`.\n` +
    `• Gắn nhãn **plan approve** khi kế hoạch đã được duyệt.\n` +
    `• Các list quan trọng: **Refine**, **Epic**, **Planning**, **Dev**, **Test**.\n` +
    `• Nếu bạn đổi tên list, cập nhật biến môi trường tương ứng trong .env.\n` +
    `• Không xoá thẻ này; nó là tài liệu setup cho board.\n\n` +
    `Nếu bạn cần thay đổi yêu cầu hàng loạt, chỉnh nội dung thẻ này bằng cách sửa mô tả card.`
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
    logger.info({ boardId, listName: infoListName }, 'Created missing Info list');
  }

  const existingInfoCard = await findExistingInfoCard(lists);
  if (existingInfoCard) {
    if (existingInfoCard.idList !== infoList.id) {
      await TrelloClient.moveCard(existingInfoCard.id, infoList.id);
      logger.info({ boardId, cardId: existingInfoCard.id, listId: infoList.id }, 'Moved existing instruction card back to Info list');
    }
    return;
  }

  await TrelloClient.createCard(infoList.id, INFO_CARD_TITLE, createInfoCardDescription());
  logger.info({ boardId, listId: infoList.id }, 'Created new Info instruction card');
}

/** On startup: scan all stage lists (Planning/Dev/Test) for AI-labelled cards and route them by stage. */
async function scanExistingStageCards(): Promise<void> {
  logger.info('Scanning existing stage-list cards for AI label...');
  let found = 0;

  for (const boardId of config.TRELLO_BOARD_IDS) {
    let lists;
    try {
      lists = await TrelloClient.getLists(boardId);
    } catch (err) {
      logger.error({ err, boardId }, 'Failed to fetch lists for startup scan');
      continue;
    }

    const stageLists = lists
      .map(l => ({ list: l, stage: stageForListName(l.name) }))
      .filter((x): x is { list: typeof x.list; stage: NonNullable<typeof x.stage> } => x.stage !== null);

    logger.debug({ boardId, stageLists: stageLists.map(x => `${x.list.name}→${x.stage}`) }, 'Stage lists found on board');

    for (const { list, stage } of stageLists) {
      let cards;
      try {
        cards = await TrelloClient.getCardsInList(list.id);
      } catch (err) {
        logger.error({ err, listId: list.id }, 'Failed to fetch cards for startup scan');
        continue;
      }

      for (const card of cards) {
        if (!hasAiLabel(card.labels ?? [])) continue;

        // Chỉ tự xử lý card HOÀN TOÀN MỚI khi khởi động (chưa có Task). Card đã có Task
        // (đang chờ giữa stage, card con pre-approve, epic tracker…) thì bỏ qua để tránh
        // chạy lại nhầm — người dùng kéo lại nếu muốn kích hoạt.
        const existing = TaskRepository.findByCardId(card.id);
        if (existing) {
          logger.debug({ cardId: card.id, status: existing.status }, 'Card đã có Task — checking startup approval state');
          if (hasPlanApproveLabel(card.labels ?? []) && existing.status === 'awaiting_plan_approval') {
            logger.info({ cardId: card.id, status: existing.status }, 'Startup scan: existing card already has plan-approve label, triggering onPlanApprove');
            await StageRouter.onPlanApprove(card.id);
          }
          continue;
        }

        logger.info({ cardId: card.id, cardName: card.name, list: list.name, stage }, 'Startup scan: routing AI card');
        StageRouter.dispatch(stage, card, list.id);
        found++;
      }
    }
  }

  logger.info({ found }, 'Startup scan complete');
}

/** Resolve a card, verify the AI switch label, and dispatch the given stage. */
async function dispatchStageIfAi(cardId: string, stage: NonNullable<ReturnType<typeof stageForListName>>, listId: string): Promise<void> {
  const card = await TrelloClient.getCard(cardId);
  if (!hasAiLabel(card.labels ?? [])) {
    logger.debug({ cardId, stage }, 'Card has no AI label — skipped');
    return;
  }
  StageRouter.dispatch(stage, card, listId);
}

async function main(): Promise<void> {
  logger.info({ version: '2.0.0', env: config.NODE_ENV }, '🤖 AutoPilot Agent starting (3-stage flow)');

  // Init database
  getDb();
  logger.info('Database ready');

  // Recover any tasks stuck in processing from previous crash
  const staleTasks = TaskRepository.findStaleTasks(config.MAX_TASK_PROCESSING_MINUTES);
  if (staleTasks.length > 0) {
    logger.warn({ count: staleTasks.length }, 'Recovering stale tasks');
    for (const task of staleTasks) {
      TaskRepository.setStatus(task.id, 'halted', { error_message: 'Recovered from stale state' });
      if (task.worktree_path) await WorktreeManager.remove(task.id).catch(() => {});
    }
  }

  // Wire Trello connector
  const connector = new TrelloConnector();

  connector.on('trello:event', async (event: TrelloEvent) => {
    logger.debug({ event }, 'Trello event received');

    try {
      // Card dragged into a stage list → route to the matching stage
      if (event.type === 'card:moved_to_stage') {
        await dispatchStageIfAi(event.cardId, event.stage, event.listId);
        return;
      }

      // A label was added — could be the AI switch or the plan-approve label
      if (event.type === 'card:label_added') {
        if (isLabelName(event.labelName, config.TRELLO_PLAN_APPROVE_LABEL_NAME)) {
          await StageRouter.onPlanApprove(event.cardId);
          return;
        }
        if (isLabelName(event.labelName, config.TRELLO_AI_LABEL_NAME)) {
          // AI switch turned on — process the card at whatever stage list it's currently in
          const card = await TrelloClient.getCard(event.cardId);
          const lists = await TrelloClient.getLists(event.boardId);
          const currentList = lists.find(l => l.id === card.idList);
          const stage = currentList ? stageForListName(currentList.name) : null;
          if (stage) {
            StageRouter.dispatch(stage, card, card.idList);
          } else {
            logger.debug({ cardId: event.cardId, list: currentList?.name }, 'AI label added but card not in a stage list — skipped');
          }
        }
        return;
      }

      // Admin comment — MODIFY / RETRY / REJECT during planning
      if (event.type === 'comment:added') {
        await ConfirmationManager.handleAdminReply(event.cardId, event.memberId, event.text);
        return;
      }
    } catch (err) {
      logger.error({ err, event }, 'Failed to handle Trello event');
    }
  });

  connector.start();
  logger.info({ mode: config.TRELLO_USE_WEBHOOK ? 'webhook' : 'polling' }, 'Trello connector started');

  // Admin backend (API + UI) — chạy độc lập với chế độ Trello (webhook/polling).
  const adminServer = new AdminServer();
  adminServer.start();

  // Ensure each board has a persistent instruction card in the Info list.
  for (const boardId of config.TRELLO_BOARD_IDS) {
    await ensureBoardInfoCard(boardId).catch(err =>
      logger.error({ boardId, err }, 'Failed to ensure Info instruction card')
    );
  }

  // Route cards already sitting in stage lists before the agent started
  await scanExistingStageCards().catch(err =>
    logger.error({ err }, 'Startup scan failed — continuing without it')
  );

  // Dead man's switch: halt tasks stuck in 'processing' with no heartbeat
  setInterval(async () => {
    const stale = TaskRepository.findStaleTasks(config.MAX_TASK_PROCESSING_MINUTES);
    for (const task of stale) {
      logger.warn({ taskId: task.id }, 'Dead man\'s switch: halting stale task');
      TaskRepository.setStatus(task.id, 'halted', { error_message: 'Halted by dead man\'s switch' });
      await TrelloClient.addComment(task.card_id, `🛑 **[AI AGENT]** Task bị tự động dừng sau ${config.MAX_TASK_PROCESSING_MINUTES} phút không phản hồi.`).catch(() => {});
      if (task.worktree_path) await WorktreeManager.remove(task.id).catch(() => {});
    }
  }, 5 * 60 * 1000);

  logger.info({ concurrency: config.QUEUE_CONCURRENCY, boards: config.TRELLO_BOARD_IDS }, '✅ AutoPilot Agent ready');

  // Graceful shutdown
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      logger.info(`Received ${sig}, shutting down`);
      connector.stop();
      adminServer.stop();
      closeDb();
      process.exit(0);
    });
  }
}

main().catch(err => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
