import { join } from 'path';
import { config } from '../config.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import type { Task } from '../state/TaskRepository.js';

/** Repo đã xác định cho 1 card (theo board). 1 board = 1 repo độc lập. */
export interface ResolvedRepo {
  repoKey: string;
  repoPath: string;
  baseBranch: string;
  docsPath: string;
  name: string;
}
export type RepoResolution = ResolvedRepo | { error: string };

/** Một "dự án" cho 1 worker process (đa-process). Mỗi repo_config = 1 dự án. */
export interface WorkerProject {
  key: string;          // repo_config.id hoặc 'default'
  name: string;
  boardIds: string[];
  repoPath: string;
  baseBranch: string;
  docsPath: string;
}

/** Đường dẫn docs mặc định: PROJECT_DOCS_PATH (env) override, hoặc <repo>/docs. */
function defaultDocsPath(repoPath: string): string {
  return config.PROJECT_DOCS_PATH?.trim() || join(repoPath, 'docs');
}

/** Parse context_repo_paths (ưu tiên JSON array; fallback tách theo xuống dòng/;). Lọc rỗng. */
function parseContextPaths(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(s => String(s).trim()).filter(Boolean);
  } catch { /* không phải JSON → tách thủ công */ }
  return raw.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean);
}

/** Repo mặc định (backward-compat khi chưa cấu hình board nào) — lấy từ .env. */
function defaultRepo(): ResolvedRepo {
  return {
    repoKey: 'default',
    repoPath: config.GIT_REPO_PATH,
    baseBranch: config.GIT_DEFAULT_BASE_BRANCH,
    docsPath: defaultDocsPath(config.GIT_REPO_PATH),
    name: 'default',
  };
}

export const RepoRegistry = {
  isConfigured(): boolean {
    return RepoConfigRepository.count() > 0;
  },

  defaultRepo,

  /** Tập board cần theo dõi = TRELLO_BOARD_IDS (.env) ∪ board đã cấu hình repo (admin, enabled). */
  watchedBoardIds(): string[] {
    const set = new Set<string>(config.TRELLO_BOARD_IDS);
    for (const c of RepoConfigRepository.list()) if (c.enabled) set.add(c.board_id);
    return [...set];
  },

  /**
   * Danh sách "dự án" cho đa-process (1 worker / dự án). Nguồn = repo_configs (enabled); nếu rỗng →
   * 1 dự án "default" tổng hợp từ .env (GIT_REPO_PATH + TRELLO_BOARD_IDS).
   */
  listProjects(): WorkerProject[] {
    const enabled = RepoConfigRepository.list().filter(c => c.enabled);
    if (enabled.length === 0) {
      const d = defaultRepo();
      return [{ key: d.repoKey, name: d.name, boardIds: config.TRELLO_BOARD_IDS, repoPath: d.repoPath, baseBranch: d.baseBranch, docsPath: d.docsPath }];
    }
    return enabled.map(c => ({
      key: c.id,
      name: c.name,
      boardIds: [c.board_id],
      repoPath: c.repo_path,
      baseBranch: c.base_branch,
      docsPath: c.docs_path?.trim() || defaultDocsPath(c.repo_path),
    }));
  },

  /** Xác định repo cho 1 card theo BOARD của nó. */
  resolveForBoard(boardId: string): RepoResolution {
    const cfg = RepoConfigRepository.getByBoard(boardId);
    if (cfg) {
      if (!cfg.enabled) return { error: `Board này đã bị TẮT trong cấu hình repo (Admin → Repos). Bật lại để xử lý.` };
      return {
        repoKey: cfg.id, repoPath: cfg.repo_path, baseBranch: cfg.base_branch,
        docsPath: cfg.docs_path?.trim() || defaultDocsPath(cfg.repo_path), name: cfg.name,
      };
    }
    if (RepoConfigRepository.count() === 0) return defaultRepo();
    return { error: `Board \`${boardId}\` chưa được cấu hình repo. Vào trang **Admin → Repos** để map board này tới một repo.` };
  },

  /** Đường dẫn docs cho 1 task (tra theo repo_key, fallback <repo_path>/docs). */
  docsPathForTask(task: Task): string {
    const cfg = task.repo_key ? RepoConfigRepository.getById(task.repo_key) : undefined;
    if (cfg) return cfg.docs_path?.trim() || defaultDocsPath(cfg.repo_path);
    return defaultDocsPath(task.repo_path ?? config.GIT_REPO_PATH);
  },

  /** Các repo NGỮ CẢNH (chỉ đọc) của task — để agent tra cứu module liên quan ngoài repo chính. */
  contextReposForTask(task: Task): string[] {
    const cfg = task.repo_key ? RepoConfigRepository.getById(task.repo_key) : undefined;
    return parseContextPaths(cfg?.context_repo_paths);
  },

  /** Khối chỉ dẫn (chèn vào prompt) về repo ngữ cảnh; rỗng nếu không có. */
  contextGuidanceForTask(task: Task): string {
    const paths = this.contextReposForTask(task);
    if (!paths.length) return '';
    return `\n## Repo NGỮ CẢNH (CHỈ ĐỌC — KHÔNG sửa/commit ở đây)\n` +
      `Để hiểu/đối chiếu module liên quan NGOÀI repo chính, được Read/Glob/Grep tại các đường dẫn sau:\n` +
      paths.map(p => `- ${p}`).join('\n') +
      `\nDùng để tra cứu/tham chiếu. Mọi thay đổi code VẪN chỉ ở repo chính (cwd).\n`;
  },
};
