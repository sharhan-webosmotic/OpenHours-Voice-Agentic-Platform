// PostToolUse: format the file Claude just changed with the project's Prettier.
// Never fails the tool call; formatting problems surface in `pnpm check`.
import { spawnSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

try {
  const filePath = JSON.parse(raw)?.tool_input?.file_path;
  if (filePath && /\.(ts|tsx|js|mjs|json|css|md|yml|yaml)$/.test(filePath)) {
    spawnSync('pnpm', ['exec', 'prettier', '--write', '--ignore-unknown', filePath], {
      cwd: process.env.CLAUDE_PROJECT_DIR,
      stdio: 'ignore',
    });
  }
} catch {
  // ignore
}
process.exit(0);
