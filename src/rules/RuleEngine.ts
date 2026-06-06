import { readFileSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { randomUUID } from 'crypto';
import { getDb } from '../state/db.js';
import { childLogger } from '../utils/logger.js';
import type { TrelloCard } from '../trello/types.js';
import type { ParsedTask } from '../claude/types.js';

const log = childLogger('rules');
const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(__dirname, 'rules.yaml');

export type TaskType = 'small' | 'large';

export interface RuleDecision {
  taskType: TaskType;
  isAutoRun: boolean;
  requiresConfirmation: boolean;
  allowedActions: string[];
  deniedActions: string[];
  reason: string;
}

interface RulesConfig {
  task_classification: {
    large_indicators: { label_names: string[]; keywords: string[]; min_description_length: number; min_checklist_items: number; has_attachments: boolean };
    small_indicators: { label_names: string[]; keywords: string[]; max_description_length: number };
  };
  auto_run_conditions: Array<{ label_name?: string; title_prefix?: string; complexity?: string }>;
  always_confirm_conditions: Array<{ label_name?: string; complexity?: string; missing_info_count?: number }>;
  allowed_actions: string[];
  requires_confirmation_actions: string[];
  complexity_threshold: number;
  confidence_threshold: number;
  escalation_keywords: string[];
  protected_branches: string[];
}

let _rules: RulesConfig | null = null;

function loadRules(): RulesConfig {
  if (_rules) return _rules;
  _rules = yaml.load(readFileSync(RULES_PATH, 'utf8')) as RulesConfig;
  watchFile(RULES_PATH, () => { _rules = null; log.info('rules.yaml reloaded'); });
  return _rules;
}

export const RuleEngine = {
  evaluate(card: TrelloCard, parsed?: ParsedTask): RuleDecision {
    const rules = loadRules();
    const labelNames = card.labels.map(l => l.name.toLowerCase());
    const titleLower = card.name.toLowerCase();
    const descLower = (card.desc ?? '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    // Task type classification
    const largeI = rules.task_classification.large_indicators;
    const smallI = rules.task_classification.small_indicators;

    const isLarge =
      labelNames.some(l => largeI.label_names.map(n => n.toLowerCase()).includes(l)) ||
      largeI.keywords.some(kw => combined.includes(kw.toLowerCase())) ||
      (card.desc?.length ?? 0) >= largeI.min_description_length ||
      card.checklists.reduce((s, cl) => s + cl.checkItems.length, 0) >= largeI.min_checklist_items ||
      (largeI.has_attachments && card.attachments.length > 0);

    const taskType: TaskType = isLarge ? 'large' : 'small';

    // Escalation keywords check
    const hasEscalation = rules.escalation_keywords.some(kw => combined.includes(kw.toLowerCase()));

    // Auto-run check
    const autoRunMatch = rules.auto_run_conditions.some(cond => {
      if (cond.label_name && labelNames.includes(cond.label_name.toLowerCase())) return true;
      if (cond.title_prefix && card.name.startsWith(cond.title_prefix)) return true;
      if (cond.complexity && parsed?.estimated_complexity === cond.complexity) return true;
      return false;
    });

    // Always confirm check
    const alwaysConfirm = hasEscalation || rules.always_confirm_conditions.some(cond => {
      if (cond.label_name && labelNames.includes(cond.label_name.toLowerCase())) return true;
      if (cond.complexity && parsed?.estimated_complexity === cond.complexity) return true;
      if (cond.missing_info_count !== undefined && (parsed?.missing_info.length ?? 0) >= cond.missing_info_count) return true;
      return false;
    });

    const isAutoRun = autoRunMatch && !alwaysConfirm;
    const requiresConfirmation = alwaysConfirm || (!autoRunMatch && taskType === 'large');

    const reason = hasEscalation
      ? 'Escalation keyword detected'
      : alwaysConfirm ? 'Matches always-confirm condition'
      : isAutoRun ? 'Matches auto-run condition'
      : 'Default: requires confirmation for large tasks';

    const decision: RuleDecision = {
      taskType,
      isAutoRun,
      requiresConfirmation,
      allowedActions: rules.allowed_actions,
      deniedActions: rules.requires_confirmation_actions,
      reason,
    };

    // Audit log
    getDb().prepare(`INSERT INTO rule_evaluations VALUES (?, ?, ?, ?, ?)`)
      .run(randomUUID(), 'unknown', card.id, JSON.stringify(decision), Date.now());

    log.debug({ cardId: card.id, decision }, 'Rule evaluated');
    return decision;
  },

  getProtectedBranches(): string[] {
    return loadRules().protected_branches;
  },

  getConfidenceThreshold(): number {
    return loadRules().confidence_threshold;
  },

  getComplexityThreshold(): number {
    return loadRules().complexity_threshold;
  },
};
