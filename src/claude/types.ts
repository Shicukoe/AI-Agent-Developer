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

/** Trường hợp kiểm thử: điều kiện cần kiểm chứng (đầu vào → kết quả mong đợi). */
export interface TestCase {
  name: string;
  description: string;
  expected: string;
}

export interface ReviewResponse {
  /** PASS = đúng · FAIL = sai chắc chắn · NEEDS_INFO = chưa kết luận được (cần kiểm tra thêm). */
  verdict: 'PASS' | 'FAIL' | 'NEEDS_INFO';
  issues: ReviewIssue[];
  conventions_check: boolean;
  summary: string;
  /** Khi NEEDS_INFO: những thứ CẦN BIẾT / thao tác cần làm để kết luận đúng/sai (config, UI, flag, lệnh chạy…). */
  checks_needed?: string[];
  /** Mô tả NGẮN GỌN, dễ hiểu: đã test thế nào (đọc gì, kiểm chứng ra sao). */
  how_tested?: string;
  /**
   * Checklist từng tiêu chí/trường hợp kiểm thử: ok=true (đạt) / false (lỗi) + ghi chú ngắn (kèm file:dòng + cách
   * sửa nếu lỗi). manual=true: chỉ kiểm được khi CHẠY (UI) hoặc trong DATABASE — note nêu thao tác kiểm tay.
   */
  checklist?: Array<{ item: string; ok: boolean; manual?: boolean; note?: string }>;
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

/** Kết quả Triage (phát hiện task tí hon — rẻ, không đọc repo). */
export interface TriageResult {
  trivial: boolean;
  source: 'quick_label' | 'rule' | 'llm';
  reason: string;
  spec?: string;   // dùng làm planContext cho Dev khi trivial
}

/** Kết quả Business Analyst: phân tích nghiệp vụ theo ý người dùng (chưa quyết kỹ thuật). */
export interface AnalystResponse {
  intent: string;
  context: string;
  requirements: string[];              // yêu cầu nghiệp vụ đã giải nghĩa
  acceptance_criteria: string[];
  open_questions: string[];
  confidence: number;                  // 0–1
  /** Khi yêu cầu lớn/đa tính năng → tách thành các đầu việc nghiệp vụ (mỗi cái → 1 card con). */
  business_subtasks: Array<{ title: string; description: string }>;
  /** Dự án chưa có tài liệu (docs) → kết quả dựa trên card; nên chạy gen-docs. */
  docs_missing?: boolean;
  /** Định tuyến ở mức NGHIỆP VỤ (dùng khi KHÔNG bật BA kỹ thuật): trivial→Dev, design→Planning, epic→Epic. */
  decision?: 'trivial_solve' | 'design_solve' | 'epic_solve';
}

/** Kết quả Technical Refiner: quyết định kỹ thuật sau khi nhận AnalystResponse. */
export interface TechRefineResponse {
  decision: 'trivial_solve' | 'design_solve' | 'epic_solve';
  kind: TaskKind;                      // 'code' | 'doc_card'
  standardized_description: string;    // markdown chuẩn hoá để ghi đè desc card
  field_details?: FieldDetail[];
  acceptance_criteria: string[];
  test_cases?: Array<{ name: string; description: string; expected: string }>;
  target_list?: string;               // (doc_card) list đích
  reason: string;
}
