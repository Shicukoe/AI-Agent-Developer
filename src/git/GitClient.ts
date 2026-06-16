import { ShellExecutor } from '../shell/ShellExecutor.js';
import { GitOperationRepository } from '../state/GitOperationRepository.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('git');

export const GitClient = {
  async ensureConfig(repoPath: string): Promise<void> {
    await ShellExecutor.git(['config', 'user.name', config.GIT_USER_NAME], repoPath);
    await ShellExecutor.git(['config', 'user.email', config.GIT_USER_EMAIL], repoPath);
  },

  async createBranch(taskId: string, repoPath: string, branchName: string, fromBranch: string): Promise<void> {
    await ShellExecutor.git(['fetch', 'origin', fromBranch], repoPath).catch(() => {});
    await ShellExecutor.git(['checkout', '-b', branchName, `origin/${fromBranch}`], repoPath);
    log.info({ branchName, fromBranch }, 'Branch created');
    GitOperationRepository.log(taskId, 'create_branch', { branch: branchName });
  },

  async commit(taskId: string, worktreePath: string, message: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      await ShellExecutor.git(['add', ...files], worktreePath);
    } else {
      await ShellExecutor.git(['add', '-A'], worktreePath);
    }
    const { stdout } = await ShellExecutor.git(['commit', '--message', message], worktreePath);
    const hash = (await ShellExecutor.git(['rev-parse', 'HEAD'], worktreePath)).stdout.trim();
    log.info({ hash, message }, 'Committed');
    GitOperationRepository.log(taskId, 'commit', { branch: await this.currentBranch(worktreePath), commitHash: hash });
    return hash;
  },

  async currentBranch(repoPath: string): Promise<string> {
    const { stdout } = await ShellExecutor.git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
    return stdout.trim();
  },

  /** Fetch các ref từ origin (read-only) — phục vụ review nhánh do người tự code. */
  async fetch(repoPath: string, refs: string[]): Promise<void> {
    await ShellExecutor.git(['fetch', 'origin', ...refs], repoPath);
  },

  async getDiff(repoPath: string, base: string, head?: string): Promise<string> {
    const args = head
      ? ['diff', `${base}...${head}`]
      : ['diff', base];
    const { stdout } = await ShellExecutor.git(args, repoPath);
    return stdout;
  },

  async getDiffStat(repoPath: string, base: string): Promise<string> {
    const { stdout } = await ShellExecutor.git(['diff', '--stat', base], repoPath);
    return stdout;
  },

  async mergeBranch(taskId: string, repoPath: string, targetBranch: string, sourceBranch: string): Promise<void> {
    await ShellExecutor.git(['checkout', targetBranch], repoPath);
    await ShellExecutor.git(['merge', '--no-ff', sourceBranch, '-m', `Merge ${sourceBranch} into ${targetBranch}`], repoPath);
    log.info({ targetBranch, sourceBranch }, 'Merged');
    GitOperationRepository.log(taskId, 'merge', { branch: `${sourceBranch} -> ${targetBranch}` });
  },

  /**
   * Thử merge sourceBranch vào branch đang checkout tại worktreePath (integration worktree).
   * Conflict/lỗi → tự `merge --abort` và trả ok:false để caller xử lý mềm (không throw).
   */
  async tryMerge(taskId: string, worktreePath: string, sourceBranch: string): Promise<{ ok: boolean; output: string }> {
    try {
      const { stdout } = await ShellExecutor.git(
        ['merge', '--no-ff', sourceBranch, '-m', `Merge ${sourceBranch}`],
        worktreePath,
      );
      log.info({ taskId, sourceBranch }, 'Merged into integration branch');
      GitOperationRepository.log(taskId, 'merge', { branch: sourceBranch, output: 'ok' });
      return { ok: true, output: stdout };
    } catch (err) {
      await ShellExecutor.git(['merge', '--abort'], worktreePath).catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ taskId, sourceBranch, err: msg.slice(0, 200) }, 'Merge conflict — aborted');
      GitOperationRepository.log(taskId, 'merge', { branch: sourceBranch, output: `conflict: ${msg.slice(0, 200)}` });
      return { ok: false, output: msg };
    }
  },

  async push(taskId: string, repoPath: string, branchName: string): Promise<void> {
    await ShellExecutor.git(['push', '-u', 'origin', branchName], repoPath);
    log.info({ branchName }, 'Pushed');
    GitOperationRepository.log(taskId, 'push', { branch: branchName });
  },

  // Safety: refuse merging into protected branches
  assertNotProtected(branchName: string): void {
    const protected_ = ['main', 'master', 'dev', 'develop', 'staging', 'production'];
    if (protected_.includes(branchName.toLowerCase())) {
      throw new Error(`Refusing to merge directly into protected branch: ${branchName}. Admin must do this manually.`);
    }
  },
};
