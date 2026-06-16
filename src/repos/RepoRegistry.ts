import { config } from '../config.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';

/** Repo đã xác định cho 1 card (theo board). 1 board = 1 repo độc lập. */
export interface ResolvedRepo {
  repoKey: string;
  repoPath: string;
  baseBranch: string;
  name: string;
}
export type RepoResolution = ResolvedRepo | { error: string };

/** Repo mặc định (backward-compat khi chưa cấu hình board nào) — lấy từ .env. */
function defaultRepo(): ResolvedRepo {
  return {
    repoKey: 'default',
    repoPath: config.GIT_REPO_PATH,
    baseBranch: config.GIT_DEFAULT_BASE_BRANCH,
    name: 'default',
  };
}

export const RepoRegistry = {
  /** Đã có ít nhất 1 board được cấu hình repo → bắt buộc board phải được map. */
  isConfigured(): boolean {
    return RepoConfigRepository.count() > 0;
  },

  defaultRepo,

  /**
   * Tập board cần theo dõi = TRELLO_BOARD_IDS (.env) ∪ board đã cấu hình repo (admin, enabled).
   * Nhờ vậy thêm dự án qua admin là board được poll ngay (không cần sửa .env / restart).
   */
  watchedBoardIds(): string[] {
    const set = new Set<string>(config.TRELLO_BOARD_IDS);
    for (const c of RepoConfigRepository.list()) if (c.enabled) set.add(c.board_id);
    return [...set];
  },

  /**
   * Xác định repo cho 1 card theo BOARD của nó.
   * - Board đã map (admin) → dùng cấu hình đó (báo lỗi nếu bị tắt).
   * - Chưa map nhưng CHƯA cấu hình board nào → fallback repo mặc định (.env) cho mọi board.
   * - Chưa map mà ĐÃ có cấu hình khác → yêu cầu vào admin map board này.
   */
  resolveForBoard(boardId: string): RepoResolution {
    const cfg = RepoConfigRepository.getByBoard(boardId);
    if (cfg) {
      if (!cfg.enabled) return { error: `Board này đã bị TẮT trong cấu hình repo (Admin → Repos). Bật lại để xử lý.` };
      return { repoKey: cfg.id, repoPath: cfg.repo_path, baseBranch: cfg.base_branch, name: cfg.name };
    }
    if (RepoConfigRepository.count() === 0) {
      return defaultRepo();
    }
    return { error: `Board \`${boardId}\` chưa được cấu hình repo. Vào trang **Admin → Repos** để map board này tới một repo.` };
  },
};
