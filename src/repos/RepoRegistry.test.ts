import 'dotenv/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoRegistry } from './RepoRegistry.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';

vi.mock('../state/RepoConfigRepository.js', () => ({
  RepoConfigRepository: { count: vi.fn(), getByBoard: vi.fn() },
}));

const mockCount = RepoConfigRepository.count as unknown as ReturnType<typeof vi.fn>;
const mockGet = RepoConfigRepository.getByBoard as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

describe('RepoRegistry.resolveForBoard — map repo theo board', () => {
  it('board đã map + enabled → trả repo', () => {
    mockGet.mockReturnValue({ id: 'r1', board_id: 'b1', name: 'web', repo_path: '/tmp/web', base_branch: 'main', enabled: 1 });
    const res = RepoRegistry.resolveForBoard('b1');
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.repoPath).toBe('/tmp/web');
    expect(res.baseBranch).toBe('main');
    expect(res.name).toBe('web');
  });

  it('board map nhưng bị TẮT → error', () => {
    mockGet.mockReturnValue({ id: 'r1', board_id: 'b1', name: 'web', repo_path: '/tmp/web', base_branch: 'dev', enabled: 0 });
    expect('error' in RepoRegistry.resolveForBoard('b1')).toBe(true);
  });

  it('chưa map + chưa cấu hình board nào → repo mặc định (.env)', () => {
    mockGet.mockReturnValue(undefined);
    mockCount.mockReturnValue(0);
    const res = RepoRegistry.resolveForBoard('bX');
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.repoKey).toBe('default');
  });

  it('chưa map nhưng đã có board khác được cấu hình → error (bắt map)', () => {
    mockGet.mockReturnValue(undefined);
    mockCount.mockReturnValue(2);
    expect('error' in RepoRegistry.resolveForBoard('bX')).toBe(true);
  });
});
