import 'dotenv/config';
import { getDb, closeDb } from './state/db.js';
import { TrelloConnector } from './trello/TrelloConnector.js';
import { TrelloClient } from './trello/TrelloClient.js';
import { StageRouter } from './agents/StageRouter.js';
import { ConfirmationManager } from './confirmation/ConfirmationManager.js';
import { TaskRepository } from './state/TaskRepository.js';
import { WorktreeManager } from './git/WorktreeManager.js';
import { config, stageForListName, hasAiLabel } from './config.js';
import { logger } from './utils/logger.js';
import type { TrelloEvent } from './trello/types.js';

function isLabelName(name: string, configured: string): boolean {
  return name.toLowerCase() === configured.toLowerCase();
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
          logger.debug({ cardId: card.id, status: existing.status }, 'Card đã có Task — bỏ qua startup scan');
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
      closeDb();
      process.exit(0);
    });
  }
}

main().catch(err => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
