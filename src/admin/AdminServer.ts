import express from 'express';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import { requireAdminToken } from './auth.js';
import { tasksRouter } from './routes/tasks.js';
import { reposRouter } from './routes/repos.js';

const log = childLogger('admin-server');
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Thư mục UI tĩnh: <repo>/public/admin (chạy dev qua tsx) hoặc <dist>/../public/admin (build). */
function resolvePublicDir(): string {
  const candidates = [
    join(process.cwd(), 'public', 'admin'),
    join(__dirname, '..', '..', 'public', 'admin'),
  ];
  return candidates.find(existsSync) ?? candidates[0];
}

/**
 * Admin backend: Express app riêng (cổng ADMIN_PORT), chạy chung process với agent, dùng chung SQLite.
 * Bật khi có ADMIN_API_TOKEN; API dữ liệu (/admin/api/*) yêu cầu token, trang HTML/asset phục vụ tự do.
 */
export class AdminServer {
  private app = express();
  private server: Server | null = null;

  constructor() {
    this.app.use(express.json());

    // API có bảo vệ token. Đặt TRƯỚC static để mọi /admin/api/* đều qua auth.
    this.app.use('/admin/api', requireAdminToken, tasksRouter());
    this.app.use('/admin/api', requireAdminToken, reposRouter());

    // UI tĩnh từ template WinDOORS đã nhúng.
    const publicDir = resolvePublicDir();
    this.app.use('/admin', express.static(publicDir));
    // Truy cập /admin → login (JS sẽ chuyển về index nếu đã có token).
    this.app.get('/admin', (_req, res) => res.sendFile(join(publicDir, 'login.html')));

    log.debug({ publicDir }, 'Admin UI directory resolved');
  }

  start(): void {
    if (!config.ADMIN_API_TOKEN) {
      log.warn('ADMIN_API_TOKEN trống — admin server TẮT. Đặt token trong .env để bật.');
      return;
    }
    this.server = this.app.listen(config.ADMIN_PORT, config.ADMIN_BIND_HOST, () => {
      log.info({ host: config.ADMIN_BIND_HOST, port: config.ADMIN_PORT },
        `Admin server listening — http://${config.ADMIN_BIND_HOST}:${config.ADMIN_PORT}/admin`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}
