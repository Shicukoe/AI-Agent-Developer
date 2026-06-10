import 'dotenv/config';
import { ClaudeCliClient } from './src/claude/ClaudeCliClient.js';

async function main(): Promise<void> {
  const out = await ClaudeCliClient.run('Reply with exactly the two letters: OK', {
    label: 'plan:test01',
    maxTurns: 1,
  });
  console.log('--- RESULT ---', JSON.stringify(out));
}

main().catch((e) => { console.error('SMOKE ERROR', e); process.exit(1); });
