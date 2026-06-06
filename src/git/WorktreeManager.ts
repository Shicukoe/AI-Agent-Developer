import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { GitOperationRepository } from '../state/GitOperationRepository.js';
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
  async add(taskId: string, branchName: string, fromBranch: string): Promise<string> {
    const path = worktreePath(taskId);
    const repoPath = config.GIT_REPO_PATH;

    if (existsSync(path)) {
      log.warn({ path }, 'Worktree path already exists, removing first');
      await this.remove(taskId).catch(() => {});
    }

    mkdirSync(config.GIT_WORKTREE_BASE, { recursive: true });

    // Fetch latest base branch
    await ShellExecutor.git(['fetch', 'origin', fromBranch], repoPath).catch(() => {});

    // Create worktree with new branch
    await ShellExecutor.git(
      ['worktree', 'add', '-b', branchName, path, `origin/${fromBranch}`],
      repoPath,
    );

    // Configure git user in worktree
    await ShellExecutor.git(['config', 'user.name', config.GIT_USER_NAME], path);
    await ShellExecutor.git(['config', 'user.email', config.GIT_USER_EMAIL], path);

    log.info({ taskId, branchName, path }, 'Worktree created');
    GitOperationRepository.log(taskId, 'worktree_add', { branch: branchName, output: path });

    return path;
  },

  async remove(taskId: string): Promise<void> {
    const path = worktreePath(taskId);
    const repoPath = config.GIT_REPO_PATH;

    try {
      await ShellExecutor.git(['worktree', 'remove', '--force', path], repoPath);
    } catch {
      // If git worktree remove fails, forcibly delete the directory
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
      // Prune stale worktree refs
      await ShellExecutor.git(['worktree', 'prune'], repoPath).catch(() => {});
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

  async listActive(): Promise<string[]> {
    const { stdout } = await ShellExecutor.git(['worktree', 'list', '--porcelain'], config.GIT_REPO_PATH);
    return stdout.split('\n').filter(l => l.startsWith('worktree ')).map(l => l.replace('worktree ', '').trim());
  },
};
