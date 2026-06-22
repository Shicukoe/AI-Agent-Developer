import { fork, type ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { RepoRegistry, type WorkerProject } from '../repos/RepoRegistry.js';
import { childLogger } from '../utils/logger.js';
import type { AdminCmd, AdminCommandMsg, AdminResultMsg } from './ipc.js';

const log = childLogger('worker-registry');
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Chạy dưới tsx (dev) hay node/dist (prod)? Quyết định cách fork worker. */
const IS_TS = __dirname.replace(/\\/g, '/').includes('/src/');
const WORKER_ENTRY = join(__dirname, '..', IS_TS ? 'worker.ts' : 'worker.js');
const WORKER_EXEC_ARGV = IS_TS ? ['--import', 'tsx'] : [];

const RESTART_MAX_DELAY_MS = 30_000;
const RESTART_BASE_DELAY_MS = 1_000;
const COMMAND_TIMEOUT_MS = 60_000;

interface WorkerHandle {
  project: WorkerProject;
  child: ChildProcess | null;
  signature: string;        // JSON của project — đổi nghĩa là cần restart
  restarts: number;
  stopping: boolean;        // chủ ý dừng (không tự restart)
  restartTimer: ReturnType<typeof setTimeout> | null;
}

interface PendingCommand {
  resolve: (r: AdminResultMsg) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Quản lý vòng đời worker process — MỖI repo_config (dự án) một process:
 * spawn, tự restart khi crash (backoff), reconcile khi cấu hình repo đổi, gửi lệnh admin qua IPC.
 */
export class WorkerRegistry {
  private workers = new Map<string, WorkerHandle>();   // key = project.key
  private pending = new Map<string, PendingCommand>();
  private shuttingDown = false;

  start(): void {
    this.reconcile();
    log.info({ count: this.workers.size, mode: IS_TS ? 'tsx' : 'node' }, 'Workers started');
  }

  /** Đồng bộ worker đang chạy với danh sách dự án hiện tại (gọi sau mỗi thay đổi cấu hình repo). */
  reconcile(): void {
    if (this.shuttingDown) return;
    const projects = RepoRegistry.listProjects();
    const wanted = new Map(projects.map(p => [p.key, p]));

    // Dừng worker không còn trong danh sách.
    for (const [key, h] of this.workers) {
      if (!wanted.has(key)) { this.stop(key); }
    }
    // Spawn mới / restart khi signature đổi.
    for (const project of projects) {
      const sig = JSON.stringify(project);
      const h = this.workers.get(project.key);
      if (!h) { this.spawn(project); }
      else if (h.signature !== sig) {
        log.info({ key: project.key }, 'Project config đổi — restart worker');
        h.project = project; h.signature = sig;
        h.child?.kill();   // 'exit' handler sẽ tự spawn lại
      }
    }
  }

  private spawn(project: WorkerProject): void {
    const signature = JSON.stringify(project);
    const child = fork(WORKER_ENTRY, [], {
      execArgv: WORKER_EXEC_ARGV,
      env: { ...process.env, AUTOPILOT_REPO_KEY: project.key },
    });
    const handle: WorkerHandle = this.workers.get(project.key) ?? {
      project, child, signature, restarts: 0, stopping: false, restartTimer: null,
    };
    handle.project = project; handle.signature = signature; handle.child = child; handle.stopping = false;
    this.workers.set(project.key, handle);

    child.on('message', (msg: AdminResultMsg) => {
      if (msg?.type === 'admin-result') {
        const p = this.pending.get(msg.id);
        if (p) { clearTimeout(p.timer); this.pending.delete(msg.id); p.resolve(msg); }
      }
    });
    child.on('exit', (code, signal) => {
      log.warn({ key: project.key, code, signal }, 'Worker exited');
      handle.child = null;
      if (this.shuttingDown || handle.stopping) { this.workers.delete(project.key); return; }
      // Backoff restart.
      const delay = Math.min(RESTART_BASE_DELAY_MS * 2 ** handle.restarts, RESTART_MAX_DELAY_MS);
      handle.restarts++;
      handle.restartTimer = setTimeout(() => { if (!this.shuttingDown && this.workers.has(project.key)) this.spawn(handle.project); }, delay);
    });
    log.info({ key: project.key, repo: project.repoPath, boards: project.boardIds }, 'Worker spawned');
  }

  private stop(key: string): void {
    const h = this.workers.get(key);
    if (!h) return;
    h.stopping = true;
    if (h.restartTimer) clearTimeout(h.restartTimer);
    h.child?.kill();
    this.workers.delete(key);
    log.info({ key }, 'Worker stopped (project removed)');
  }

  /** Gửi lệnh admin tới worker phục vụ repoKey; chờ kết quả qua IPC. */
  async sendCommand(repoKey: string, cmd: AdminCmd, taskId: string, payload?: { instruction?: string }): Promise<AdminResultMsg> {
    const h = this.workers.get(repoKey) ?? this.workers.get('default');
    if (!h?.child) return { type: 'admin-result', id: '', ok: false, code: 'no_worker', error: `Không có worker cho repo '${repoKey}'` };
    const id = randomUUID();
    const msg: AdminCommandMsg = { type: 'admin-command', id, cmd, taskId, payload };
    return new Promise<AdminResultMsg>(resolve => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ type: 'admin-result', id, ok: false, code: 'timeout', error: 'Worker không phản hồi' }); }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      h.child!.send(msg);
    });
  }

  stopAll(): void {
    this.shuttingDown = true;
    for (const h of this.workers.values()) { if (h.restartTimer) clearTimeout(h.restartTimer); h.child?.kill(); }
    this.workers.clear();
  }
}
