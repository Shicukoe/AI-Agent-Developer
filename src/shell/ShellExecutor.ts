import { execa, ExecaError } from 'execa';
import { config } from '../config.js';
import { ShellError } from '../utils/errors.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('shell');

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const ShellExecutor = {
  async run(cmd: string, args: string[], cwd: string, opts: { timeout?: number } = {}): Promise<ShellResult> {
    const exe = cmd.split('/').pop()!.split('\\').pop()!.replace(/\.exe$/i, '');
    if (!config.SHELL_COMMAND_ALLOWLIST.includes(exe)) {
      throw new ShellError(`Command not in allowlist: ${cmd}`, null, '');
    }

    const timeout = opts.timeout ?? config.SHELL_TIMEOUT_MS;
    log.debug({ cmd, args, cwd }, 'Running shell command');

    try {
      const result = await execa(cmd, args, { cwd, timeout, reject: false });
      if (result.exitCode !== 0) {
        log.warn({ cmd, args, exitCode: result.exitCode, stderr: result.stderr }, 'Command failed');
        throw new ShellError(`${cmd} exited with ${result.exitCode}: ${result.stderr}`, result.exitCode ?? null, String(result.stderr ?? ''));
      }
      return { stdout: String(result.stdout), stderr: String(result.stderr ?? ''), exitCode: result.exitCode ?? 0 };
    } catch (err) {
      if (err instanceof ShellError) throw err;
      const e = err as ExecaError;
      throw new ShellError(e.message, e.exitCode ?? null, typeof e.stderr === 'string' ? e.stderr : '');
    }
  },

  async git(args: string[], cwd: string): Promise<ShellResult> {
    return this.run('git', args, cwd);
  },
};
