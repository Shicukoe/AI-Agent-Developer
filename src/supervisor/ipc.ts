/** Giao thức IPC giữa supervisor (admin) và worker process. */

export type AdminCmd = 'rerun' | 'modify' | 'cancel';

/** Supervisor → worker: yêu cầu thực thi một hành động admin trên task (trong ngữ cảnh repo của worker). */
export interface AdminCommandMsg {
  type: 'admin-command';
  id: string;            // id tương quan request/response
  cmd: AdminCmd;
  taskId: string;
  payload?: { instruction?: string };
}

/** Worker → supervisor: kết quả của một admin-command. */
export interface AdminResultMsg {
  type: 'admin-result';
  id: string;
  ok: boolean;
  code?: string;         // 'in_flight' | 'not_found' | 'bad_request'
  error?: string;
  data?: unknown;
}

export type WorkerMessage = AdminResultMsg;
export type SupervisorMessage = AdminCommandMsg;

/** Lỗi mang mã để worker báo về admin (map sang HTTP status). */
export class AdminCommandError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AdminCommandError';
  }
}
