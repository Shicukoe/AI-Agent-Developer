import type { Task } from '../../state/TaskRepository.js';
import type { TaskKind } from '../../claude/types.js';

/**
 * Executor = agent thực thi ở stage Dev cho một loại task (kind) cụ thể.
 * Executor tự đặt status cuối + comment lên card; runDev chỉ điều phối.
 */
export interface Executor {
  kind: TaskKind;
  label: string;
  run(task: Task): Promise<void>;
}

/** Đọc kind đã được phân loại (TechnicalRefiner) từ metadata, mặc định 'code'. */
export function taskKind(task: Task): TaskKind {
  if (!task.metadata) return 'code';
  try {
    const meta = JSON.parse(task.metadata) as { kind?: TaskKind };
    return meta.kind ?? 'code';
  } catch {
    return 'code';
  }
}
