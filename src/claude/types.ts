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
