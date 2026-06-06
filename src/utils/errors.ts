export class AgentError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TrelloApiError extends AgentError {
  constructor(message: string, public readonly status: number, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class ClaudeApiError extends AgentError {}

export class GitError extends AgentError {}

export class RiskBudgetExceededError extends AgentError {
  constructor(public readonly budgetKey: string, public readonly limit: number, public readonly current: number) {
    super(`Risk budget exceeded: ${budgetKey} (limit=${limit}, current=${current})`);
  }
}

export class ShellError extends AgentError {
  constructor(message: string, public readonly exitCode: number | null, public readonly stderr: string) {
    super(message);
  }
}

export class OutOfScopeError extends AgentError {}

export class ConfirmationTimeoutError extends AgentError {}

export class WorktreeError extends AgentError {}
