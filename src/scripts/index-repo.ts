/**
 * Dựng/làm mới CHỈ MỤC tĩnh (grep, không LLM) cho repo → `<docs>/00_CHI_MUC.md`.
 * Agent (gen-docs, BA, Tech, Review) tra chỉ mục này để biết "thứ X ở file nào" thay vì đọc/grep lặp.
 *
 *   npm run index                  → repo mặc định (.env)
 *   npm run index -- <board_id>    → repo của board (cấu hình admin)
 *   npm run index -- <repo_path>   → repo theo đường dẫn
 */
import 'dotenv/config';
import { join } from 'path';
import { IndexAgent } from '../agents/IndexAgent.js';
import { RepoConfigRepository } from '../state/RepoConfigRepository.js';
import { RepoRegistry } from '../repos/RepoRegistry.js';
import { config } from '../config.js';

function resolveTarget(arg?: string): { repoPath: string; docsPath: string } {
  if (!arg) { const d = RepoRegistry.defaultRepo(); return { repoPath: d.repoPath, docsPath: d.docsPath }; }
  const cfg = RepoConfigRepository.getByBoard(arg) ?? RepoConfigRepository.list().find(c => c.repo_path === arg);
  if (cfg) return { repoPath: cfg.repo_path, docsPath: cfg.docs_path?.trim() || join(cfg.repo_path, 'docs') };
  return { repoPath: arg, docsPath: config.PROJECT_DOCS_PATH?.trim() || join(arg, 'docs') };
}

const { repoPath, docsPath } = resolveTarget(process.argv.slice(2).find(a => !a.startsWith('--')));
const out = join(docsPath, '00_CHI_MUC.md');
console.log(`\n🗂️  index: ${repoPath} → ${out}\n`);
IndexAgent.build(repoPath, out)
  .then(r => console.log(`✅ Xong (${r.files} file). Kiểm ${out}.`))
  .catch(err => { console.error('index lỗi:', err); process.exit(1); });
