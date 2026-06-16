import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { GitOperationRepository } from '../state/GitOperationRepository.js';
import { TaskRepository } from '../state/TaskRepository.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import { WorktreeError } from '../utils/errors.js';

const log = childLogger('worktree');

function worktreePath(taskId: string): string {
  // Sanitize taskId to be filesystem-safe
  const safe = taskId.replace(/[^a-zA-Z0-9-_]/g, '-');
  return join(config.GIT_WORKTREE_BASE, safe);
}

export const WorktreeManager = {
  async add(taskId: string, repoPath: string, branchName: string, fromBranch: string): Promise<string> {
    const path = worktreePath(taskId);

    if (existsSync(path)) {
      log.warn({ path }, 'Worktree path already exists, removing first');
      await this.remove(taskId, repoPath).catch(() => {});
    }

    mkdirSync(config.GIT_WORKTREE_BASE, { recursive: true });

    // Fetch latest base branch
    await ShellExecutor.git(['fetch', 'origin', fromBranch], repoPath).catch(() => {});

    // Branch có sẵn chưa? (re-dev sau khi worktree bị xoá nhưng branch còn) → dùng lại branch
    // thay vì '-b' (sẽ lỗi "branch already exists"). Branch mới → tạo từ origin/<base>.
    const branchExists = await ShellExecutor
      .git(['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`], repoPath)
      .then(() => true)
      .catch(() => false);

    if (branchExists) {
      log.info({ branchName }, 'Branch already exists — reusing it for the worktree');
      await ShellExecutor.git(['worktree', 'add', path, branchName], repoPath);
    } else {
      // Base ref: ưu tiên origin/<base> (branch remote như dev); nếu không có (vd integration branch
      // 'epic/<short>' chỉ tồn tại local) thì dùng ref local <base>.
      let baseRef = `origin/${fromBranch}`;
      const hasOrigin = await ShellExecutor
        .git(['rev-parse', '--verify', '--quiet', baseRef], repoPath)
        .then(() => true)
        .catch(() => false);
      if (!hasOrigin) baseRef = fromBranch;

      await ShellExecutor.git(
        ['worktree', 'add', '-b', branchName, path, baseRef],
        repoPath,
      );
    }

    // Configure git user in worktree
    await ShellExecutor.git(['config', 'user.name', config.GIT_USER_NAME], path);
    await ShellExecutor.git(['config', 'user.email', config.GIT_USER_EMAIL], path);

    log.info({ taskId, branchName, path }, 'Worktree created');
    GitOperationRepository.log(taskId, 'worktree_add', { branch: branchName, output: path });

    return path;
  },

  async remove(taskId: string, repoPath?: string): Promise<void> {
    const path = worktreePath(taskId);
    // Caller dead-man switch không truyền repoPath → tra lại repo của task, fallback global.
    const rp = repoPath ?? TaskRepository.findById(taskId)?.repo_path ?? config.GIT_REPO_PATH;

    try {
      await ShellExecutor.git(['worktree', 'remove', '--force', path], rp);
    } catch {
      // If git worktree remove fails, forcibly delete the directory
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
      // Prune stale worktree refs
      await ShellExecutor.git(['worktree', 'prune'], rp).catch(() => {});
    }

    log.info({ taskId, path }, 'Worktree removed');
    GitOperationRepository.log(taskId, 'worktree_remove', { output: path });
  },

  getPath(taskId: string): string {
    const path = worktreePath(taskId);
    if (!existsSync(path)) {
      throw new WorktreeError(`Worktree not found for task ${taskId}: ${path}`);
    }
    return path;
  },

  exists(taskId: string): boolean {
    return existsSync(worktreePath(taskId));
  },

  async listActive(repoPath: string = config.GIT_REPO_PATH): Promise<string[]> {
    const { stdout } = await ShellExecutor.git(['worktree', 'list', '--porcelain'], repoPath);
    return stdout.split('\n').filter(l => l.startsWith('worktree ')).map(l => l.replace('worktree ', '').trim());
  },
};
