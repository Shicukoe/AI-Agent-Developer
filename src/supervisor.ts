import 'dotenv/config';
import { getDb } from './state/db.js';
import { AdminServer } from './admin/AdminServer.js';
import { WorkerRegistry } from './supervisor/WorkerRegistry.js';
import { TaskRepository } from './state/TaskRepository.js';
import { WorktreeManager } from './git/WorktreeManager.js';
import { RepoRegistry } from './repos/RepoRegistry.js';
import { config } from './config.js';
import { childLogger } from './utils/logger.js';

const log = childLogger('supervisor');

/**
 * Điểm vào hệ thống (đa-process). Supervisor:
 * - Khởi tạo DB (schema + migration) MỘT lần; recover task treo từ lần chạy trước.
 * - Chạy MỘT AdminServer chung (đọc SQLite chung, điều khiển worker qua IPC).
 * - Mỗi dự án (repo_config) = MỘT worker process riêng (WorkerRegistry); admin sửa repo → reconcile.
 */
async function main(): Promise<void> {
  getDb();
  log.info({ env: config.NODE_ENV, projects: RepoRegistry.listProjects().map(p => p.key) }, '🤖 AutoPilot supervisor starting');

  // Recover task kẹt 'processing' từ crash trước (làm 1 lần trước khi fork worker).
  const stale = TaskRepository.findStaleTasks(config.MAX_TASK_PROCESSING_MINUTES);
  for (const t of stale) {
    TaskRepository.setStatus(t.id, 'halted', { error_message: 'Recovered from stale state' });
    if (t.worktree_path) await WorktreeManager.remove(t.id).catch(() => {});
  }
  if (stale.length) log.warn({ count: stale.length }, 'Recovered stale tasks');

  const registry = new WorkerRegistry();
  const admin = new AdminServer(registry);
  admin.start();
  registry.start();

  const shutdown = (): void => { log.info('Shutting down'); registry.stopAll(); admin.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log.info('✅ Supervisor ready');
}

main().catch(err => { log.error({ err }, 'Supervisor fatal'); process.exit(1); });
