import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { GitOperationRepository } from '../state/GitOperationRepository.js';
import { config } from '../config.js';
import { childLogger } from '../utils/logger.js';
import { withKeyedLock } from '../utils/keyedMutex.js';

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
    // Khóa theo repo: tránh 2 `git fetch` đồng thời trên cùng repo đụng lock refs/FETCH_HEAD.
    await withKeyedLock(repoPath, () => ShellExecutor.git(['fetch', 'origin', ...refs], repoPath));
  },

  /** SHA của 1 ref (vd "origin/staging"), null nếu không có. */
  async revParse(repoPath: string, ref: string): Promise<string | null> {
    try { const { stdout } = await ShellExecutor.git(['rev-parse', ref], repoPath); return stdout.trim() || null; }
    catch { return null; }
  },

  /**
   * Chuẩn hoá 1 ref về dạng GIẢI ĐƯỢC: thử `ref`, rồi `origin/<ref>` (nhánh chỉ có trên remote) hoặc bỏ
   * tiền tố `origin/`. Trả ref dùng được; không có thì trả nguyên ref. (SHA giải trực tiếp.)
   */
  async resolveRef(repoPath: string, ref: string): Promise<string> {
    const candidates = ref.startsWith('origin/') ? [ref, ref.slice('origin/'.length)] : [ref, `origin/${ref}`];
    for (const r of candidates) {
      if (await this.revParse(repoPath, r)) return r;
    }
    return ref;
  },

  /** Đồng bộ TẤT CẢ ref từ origin + prune nhánh đã xoá (để tự dò nhánh dev mới push được chắc chắn). */
  async fetchAll(repoPath: string): Promise<void> {
    await withKeyedLock(repoPath, () =>
      ShellExecutor.git(['fetch', '--all', '--prune'], repoPath).catch(() => { /* không có remote → bỏ qua */ }));
  },

  /** Danh sách nhánh remote (origin) kèm thời điểm commit cuối, MỚI NHẤT trước. */
  async remoteBranchesByDate(repoPath: string): Promise<Array<{ branch: string; ts: number }>> {
    try {
      const { stdout } = await ShellExecutor.git(
        ['for-each-ref', '--sort=-committerdate', 'refs/remotes/origin', '--format=%(refname:lstrip=3)|%(committerdate:unix)'],
        repoPath,
      );
      return stdout.split('\n').map(l => l.trim()).filter(Boolean)
        .map(l => { const [branch, ts] = l.split('|'); return { branch: branch.trim(), ts: Number(ts) || 0 }; })
        .filter(b => b.branch && b.branch.toUpperCase() !== 'HEAD');
    } catch { return []; }
  },

  /** Diff theo biểu thức range tuỳ ý (vd "a..b", "dev...staging", "<sha>..staging"). */
  async getDiffExpr(repoPath: string, expr: string): Promise<string> {
    const { stdout } = await ShellExecutor.git(['diff', expr], repoPath);
    return stdout;
  },

  /**
   * Tạo WORKTREE TẠM (detached) tại đúng `ref` để đọc code CHÍNH XÁC theo ref đang review (không phụ thuộc
   * nhánh working tree đang checkout). Thử `ref`, rồi `ref` bỏ tiền tố origin/, rồi `origin/<ref>`. Null nếu fail.
   */
  async addDetachedWorktree(repoPath: string, ref: string): Promise<string | null> {
    const base = config.GIT_WORKTREE_BASE;
    const safe = ref.replace(/[^a-zA-Z0-9-_]/g, '-');
    const path = join(base, `review-${safe}-${Date.now()}`);
    const candidates = ref.startsWith('origin/')
      ? [ref, ref.slice('origin/'.length)]
      : [ref, `origin/${ref}`];
    return withKeyedLock(repoPath, async () => {
      try { mkdirSync(base, { recursive: true }); } catch { /* đã có */ }
      for (const r of candidates) {
        const ok = await ShellExecutor.git(['worktree', 'add', '--detach', path, r], repoPath)
          .then(() => true).catch(() => false);
        if (ok) { log.info({ ref: r, path }, 'Detached review worktree created'); return path; }
      }
      log.warn({ repoPath, ref }, 'Không tạo được worktree review tại ref');
      return null;
    });
  },

  /** Gỡ worktree tạm (kèm prune); xoá thư mục nếu git remove lỗi. Retry vì Windows hay giữ handle 1 nhịp. */
  async removeWorktreePath(repoPath: string, path: string): Promise<void> {
    await withKeyedLock(repoPath, async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const ok = await ShellExecutor.git(['worktree', 'remove', '--force', path], repoPath)
          .then(() => true).catch(() => false);
        if (ok) return;
        if (attempt < 3) { await new Promise(r => setTimeout(r, 500)); continue; }
        // Hết retry: xoá tay + prune ref worktree mồ côi.
        try { rmSync(path, { recursive: true, force: true }); } catch { /* file còn bị khoá → để prune dọn sau */ }
        await ShellExecutor.git(['worktree', 'prune'], repoPath).catch(() => {});
      }
    });
  },

  /** Danh sách file thay đổi theo biểu thức range (vd "<sha>..HEAD"). Rỗng nếu lỗi/không có. */
  async changedFiles(repoPath: string, expr: string): Promise<string[]> {
    try {
      const { stdout } = await ShellExecutor.git(['diff', '--name-only', expr], repoPath);
      return stdout.split('\n').map(s => s.trim()).filter(Boolean);
    } catch { return []; }
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
