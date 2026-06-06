import PQueue from 'p-queue';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('task-queue');

const queue = new PQueue({ concurrency: config.QUEUE_CONCURRENCY });

log.info({ concurrency: config.QUEUE_CONCURRENCY }, 'Task queue ready');

export const TaskQueue = {
  /** Run a stage handler for a task on the shared concurrency-limited queue. */
  run(taskId: string, fn: () => Promise<void>): void {
    log.info({ taskId, queued: queue.size, running: queue.pending, concurrency: config.QUEUE_CONCURRENCY }, 'Enqueue stage job');
    queue.add(async () => {
      log.info({ taskId, running: queue.pending }, 'Stage job started');
      try {
        await fn();
      } catch (err) {
        log.error({ taskId, err }, 'Unhandled error in queue worker');
      } finally {
        log.info({ taskId, queued: queue.size, running: queue.pending }, 'Stage job finished');
      }
    });
  },

  get size(): number { return queue.size; },
  get pending(): number { return queue.pending; },

  async onIdle(): Promise<void> { return queue.onIdle(); },
};
