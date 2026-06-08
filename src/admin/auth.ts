import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

/**
 * Middleware xác thực admin API bằng token tĩnh.
 * Chấp nhận `Authorization: Bearer <token>` hoặc query `?token=` (tiện cho test nhanh).
 * Chỉ áp cho các route dữ liệu (/admin/api/*); trang HTML/asset tĩnh phục vụ tự do.
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const expected = config.ADMIN_API_TOKEN;
  // Không cấu hình token → admin server lẽ ra đã không khởi động; chặn cho chắc.
  if (!expected) {
    res.status(503).json({ error: 'Admin API chưa được cấu hình (thiếu ADMIN_API_TOKEN).' });
    return;
  }

  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const provided = bearer || queryToken;

  if (provided && provided === expected) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
