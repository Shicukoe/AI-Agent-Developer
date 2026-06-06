import { randomUUID } from 'crypto';
import { getDb } from './db.js';

export type TaskStatus =
  | 'queued' | 'processing' | 'paused_for_confirmation' | 'paused_for_plan_approval'
  | 'waiting_review' | 'completed' | 'failed' | 'halted'
  // Stage-based flow (Planning / Dev / Test)
  | 'awaiting_plan_approval' | 'plan_approved' | 'developing' | 'dev_done'
  | 'testing' | 'review_failed';

export type TaskType = 'small' | 'large' | 'epic';

export interface Task {
  id: string;
  card_id: string;
  board_id: string;
  list_id: string;
  card_name: string;
  task_type: TaskType;
  status: TaskStatus;
  parent_task_id: string | null;
  branch_name: string | null;
  worktree_path: string | null;
  plan_file_path: string | null;
  actions_taken: number;
  turns_taken: number;
  retry_count: number;
  rule_decision: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  heartbeat_at: number | null;
  metadata: string | null;
}

export interface CreateTaskInput {
  card_id: string;
  board_id: string;
  list_id: string;
  card_name: string;
  task_type?: TaskType;
  parent_task_id?: string;
  metadata?: Record<string, unknown>;
}

export const TaskRepository = {
  create(input: CreateTaskInput): Task {
    const db = getDb();
    const now = Date.now();
    const task: Task = {
      id: randomUUID(),
      card_id: input.card_id,
      board_id: input.board_id,
      list_id: input.list_id,
      card_name: input.card_name,
      task_type: input.task_type ?? 'small',
      status: 'queued',
      parent_task_id: input.parent_task_id ?? null,
      branch_name: null,
      worktree_path: null,
      plan_file_path: null,
      actions_taken: 0,
      turns_taken: 0,
      retry_count: 0,
      rule_decision: null,
      error_message: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
      heartbeat_at: now,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    };
    db.prepare(`INSERT INTO tasks VALUES (
      @id, @card_id, @board_id, @list_id, @card_name, @task_type, @status,
      @parent_task_id, @branch_name, @worktree_path, @plan_file_path,
      @actions_taken, @turns_taken, @retry_count, @rule_decision, @error_message,
      @created_at, @updated_at, @completed_at, @heartbeat_at, @metadata
    )`).run(task);
    return task;
  },

  findByCardId(cardId: string): Task | undefined {
    return getDb().prepare('SELECT * FROM tasks WHERE card_id = ?').get(cardId) as Task | undefined;
  },

  findById(id: string): Task | undefined {
    return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  },

  findByStatus(status: TaskStatus): Task[] {
    return getDb().prepare('SELECT * FROM tasks WHERE status = ?').all(status) as Task[];
  },

  findActiveByCardId(cardId: string): Task | undefined {
    return getDb().prepare(`
      SELECT * FROM tasks WHERE card_id = ? AND status IN (
        'queued','processing','paused_for_confirmation','paused_for_plan_approval','waiting_review',
        'awaiting_plan_approval','plan_approved','developing','dev_done','testing','review_failed'
      )
    `).get(cardId) as Task | undefined;
  },

  findSubTasks(parentId: string): Task[] {
    return getDb().prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC').all(parentId) as Task[];
  },

  update(id: string, patch: Partial<Omit<Task, 'id' | 'card_id' | 'created_at'>>): void {
    const now = Date.now();
    const fields = { ...patch, updated_at: now };
    const sets = Object.keys(fields).map(k => `${k} = @${k}`).join(', ');
    getDb().prepare(`UPDATE tasks SET ${sets} WHERE id = @id`).run({ ...fields, id });
  },

  setStatus(id: string, status: TaskStatus, extra?: Partial<Task>): void {
    this.update(id, { status, ...extra, ...(status === 'completed' || status === 'failed' || status === 'halted' ? { completed_at: Date.now() } : {}) });
  },

  heartbeat(id: string): void {
    getDb().prepare('UPDATE tasks SET heartbeat_at = ?, updated_at = ? WHERE id = ?').run(Date.now(), Date.now(), id);
  },

  incrementActions(id: string): void {
    getDb().prepare('UPDATE tasks SET actions_taken = actions_taken + 1, updated_at = ? WHERE id = ?').run(Date.now(), id);
  },

  incrementTurns(id: string): void {
    getDb().prepare('UPDATE tasks SET turns_taken = turns_taken + 1, updated_at = ? WHERE id = ?').run(Date.now(), id);
  },

  findStaleTasks(maxMinutes: number): Task[] {
    const cutoff = Date.now() - maxMinutes * 60 * 1000;
    return getDb().prepare(`
      SELECT * FROM tasks WHERE status = 'processing' AND heartbeat_at < ?
    `).all(cutoff) as Task[];
  },
};
