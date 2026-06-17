import 'dotenv/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShellExecutor } from '../shell/ShellExecutor.js';
import { ProjectKnowledge, type Knowledge } from './ProjectKnowledge.js';

const REPO = '/tmp/fake-repo';

function fakeKnowledge(commit: string, ageDays = 0): Knowledge {
  return { overview: 'MAP', meta: { built_at_commit: commit, built_at: Date.now() - ageDays * 86_400_000, version: 2, flows: [] } };
}

// Mock git: rev-parse → revHash, diff --name-only → list các file (1 file/dòng).
function mockGit(revHash: string, diffFiles: string[] = []): void {
  vi.spyOn(ShellExecutor, 'git').mockImplementation(async (args: string[]) => {
    if (args[0] === 'rev-parse') return { stdout: revHash } as never;
    if (args[0] === 'diff') return { stdout: diffFiles.join('\n') } as never;
    return { stdout: '' } as never;
  });
}

describe('ProjectKnowledge.ensureFresh — cold start / freshness / staleness', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('(a) chưa có cache → BUILD (cold start)', async () => {
    vi.spyOn(ProjectKnowledge, 'get').mockReturnValue(null);
    mockGit('HASH_A');
    const build = vi.spyOn(ProjectKnowledge, 'build').mockResolvedValue(fakeKnowledge('HASH_A'));
    const inc = vi.spyOn(ProjectKnowledge, 'incrementalUpdate').mockResolvedValue(fakeKnowledge('HASH_A'));

    await ProjectKnowledge.ensureFresh(REPO);
    expect(build).toHaveBeenCalledTimes(1);
    expect(inc).not.toHaveBeenCalled();
  });

  it('(b) hash trùng → DÙNG cache, không build/incremental', async () => {
    vi.spyOn(ProjectKnowledge, 'get').mockReturnValue(fakeKnowledge('HASH_A'));
    mockGit('HASH_A');
    const build = vi.spyOn(ProjectKnowledge, 'build');
    const inc = vi.spyOn(ProjectKnowledge, 'incrementalUpdate');

    const r = await ProjectKnowledge.ensureFresh(REPO);
    expect(r.meta.built_at_commit).toBe('HASH_A');
    expect(build).not.toHaveBeenCalled();
    expect(inc).not.toHaveBeenCalled();
  });

  it('(c) hash đổi, ≤ MAX file → INCREMENTAL (chỉ đọc file đổi)', async () => {
    vi.spyOn(ProjectKnowledge, 'get').mockReturnValue(fakeKnowledge('HASH_A'));
    mockGit('HASH_B', ['a.ts', 'b.ts']);
    const build = vi.spyOn(ProjectKnowledge, 'build');
    const inc = vi.spyOn(ProjectKnowledge, 'incrementalUpdate').mockResolvedValue(fakeKnowledge('HASH_B'));

    await ProjectKnowledge.ensureFresh(REPO);
    expect(inc).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
  });

  it('(d) hash đổi, > MAX file → REBUILD', async () => {
    vi.spyOn(ProjectKnowledge, 'get').mockReturnValue(fakeKnowledge('HASH_A'));
    mockGit('HASH_B', Array.from({ length: 50 }, (_, i) => `f${i}.ts`));
    const build = vi.spyOn(ProjectKnowledge, 'build').mockResolvedValue(fakeKnowledge('HASH_B'));
    const inc = vi.spyOn(ProjectKnowledge, 'incrementalUpdate');

    await ProjectKnowledge.ensureFresh(REPO);
    expect(build).toHaveBeenCalledTimes(1);
    expect(inc).not.toHaveBeenCalled();
  });

  it('(e) hash trùng nhưng quá TTL → REBUILD', async () => {
    vi.spyOn(ProjectKnowledge, 'get').mockReturnValue(fakeKnowledge('HASH_A', 999));
    mockGit('HASH_A');
    const build = vi.spyOn(ProjectKnowledge, 'build').mockResolvedValue(fakeKnowledge('HASH_A'));

    await ProjectKnowledge.ensureFresh(REPO);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('(f) commit khác nhưng 0 file đổi → coi như tươi', async () => {
    vi.spyOn(ProjectKnowledge, 'get').mockReturnValue(fakeKnowledge('HASH_A'));
    mockGit('HASH_B', []);   // diff trả rỗng
    const build = vi.spyOn(ProjectKnowledge, 'build');
    const inc = vi.spyOn(ProjectKnowledge, 'incrementalUpdate');

    await ProjectKnowledge.ensureFresh(REPO);
    expect(build).not.toHaveBeenCalled();
    expect(inc).not.toHaveBeenCalled();
  });
});
