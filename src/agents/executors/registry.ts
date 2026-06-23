import type { TaskKind } from '../../claude/types.js';
import type { Executor } from './types.js';
import { DocCardExecutor } from './DocCardExecutor.js';

/**
 * Đăng ký các executor cho từng kind (trừ 'code' — do DevAgent xử lý trực tiếp trong runDev).
 * Thêm năng lực/agent mới: cài đặt một Executor rồi thêm vào đây + bổ sung giá trị TaskKind +
 * dạy TechnicalRefiner phân loại kind đó.
 */
const EXECUTORS: Partial<Record<TaskKind, Executor>> = {
  doc_card: DocCardExecutor,
};

/** Chọn executor cho kind. Trả null nếu là 'code' (đi luồng DevAgent mặc định). */
export function pickExecutor(kind: TaskKind): Executor | null {
  return EXECUTORS[kind] ?? null;
}
