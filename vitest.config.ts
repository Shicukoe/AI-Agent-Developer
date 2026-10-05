import { defineConfig } from 'vitest/config';

// ponytail: env giả để test chạy được khi clone sạch (config.ts bắt buộc các biến này lúc import).
export default defineConfig({
  test: {
    env: {
      TRELLO_API_KEY: 'test',
      TRELLO_API_TOKEN: 'test',
      GIT_REPO_PATH: '.',
      GIT_WORKTREE_BASE: './.worktrees',
    },
  },
});
