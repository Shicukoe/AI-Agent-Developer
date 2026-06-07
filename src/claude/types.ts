export type ActionType =
  | 'post_comment'
  | 'add_label'
  | 'move_card'
  | 'update_checklist_item'
  | 'create_card'
  | 'write_file'
  | 'read_file'
  | 'run_command';

export interface AgentAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface AgentResponse {
  thinking: string;
  actions: AgentAction[];
  requires_more_info: boolean;
  confidence: number;        // 0–1
  estimated_steps: number;
  message?: string;          // human-readable summary
}

export interface ReviewIssue {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  description: string;
  suggestion?: string;
}

export interface ReviewResponse {
  verdict: 'PASS' | 'FAIL';
  issues: ReviewIssue[];
  conventions_check: boolean;
  summary: string;
}

export interface ParsedTask {
  intent: string;
  scope: string[];
  acceptance_criteria: string[];
  context: string;
  estimated_complexity: 'simple' | 'medium' | 'complex';
  confidence: number;
  missing_info: string[];
}

/**
 * Loại task = năng lực/sản phẩm cần tạo → quyết định executor nào chạy ở stage Dev.
 * - 'code'     : viết/sửa code hoặc file repo → DevAgent (git → Test).
 * - 'doc_card' : sản phẩm là một Trello card chứa tài liệu/nội dung → DocCardExecutor (không qua git/Test).
 * Thêm năng lực mới: bổ sung giá trị ở đây + một Executor + đăng ký trong executors/registry.
 */
export type TaskKind = 'code' | 'doc_card';

/** Chi tiết một field cần thêm/sửa (vd thêm cột employee_name). */
export interface FieldDetail {
  name: string;
  data_type: string;       // vd char, integer, many2one, boolean...
  display_label: string;   // tên hiển thị trên UI
  model: string;           // model/bảng đích
  validation?: string;
  default?: string;
}

/** Kết quả RefineAgent: task đã được làm rõ + chuẩn hoá. */
export interface RefineResponse {
  intent: string;
  context: string;
  requirements: string[];              // giải nghĩa rõ từng chức năng
  field_details?: FieldDetail[];       // cho task kiểu "thêm/sửa field"
  acceptance_criteria: string[];
  test_cases?: Array<{ name: string; description: string; expected: string }>;
  open_questions: string[];            // thông tin còn thiếu cần admin trả lời
  size: 'small' | 'large' | 'epic';
  kind: TaskKind;                      // năng lực/sản phẩm cần tạo (chọn executor)
  target_list?: string;               // (doc_card) tên list người dùng chỉ định để đặt card kết quả
  confidence: number;                  // 0–1
  standardized_description: string;    // markdown chuẩn hoá để ghi đè desc card
}

export interface SubTaskSpec {
  title: string;
  description: string;
  acceptance_criteria: string[];
  files_expected: string[];
  sequence: number;
}

export interface PlanResponse {
  summary: string;
  sub_tasks: SubTaskSpec[];
  test_cases: Array<{ name: string; description: string; expected: string }>;
  risks: string[];
  estimated_complexity: number; // 1–10
}
