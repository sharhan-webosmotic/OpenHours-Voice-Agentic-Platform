// PreToolUse guard: blocks edits that must never be made by an AI session.
// Exit code 2 sends the stderr message back to Claude as the reason.
import { existsSync } from 'node:fs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let filePath = '';
try {
  const input = JSON.parse(raw);
  filePath = String(input?.tool_input?.file_path ?? '').replaceAll('\\', '/');
} catch {
  process.exit(0); // not our payload; do not block
}

const block = (reason) => {
  console.error(`Blocked: ${reason}`);
  process.exit(2);
};

if (/(^|\/)\.env(\..*)?$/.test(filePath) && !filePath.endsWith('.env.example')) {
  block('never write real .env files; edit .env.example and tell the developer which variables to set.');
}
if (/(^|\/)pnpm-lock\.yaml$/.test(filePath)) {
  block('pnpm-lock.yaml is generated; run pnpm install instead of editing it.');
}
if (/(^|\/)prisma\/migrations\/.+/.test(filePath) && existsSync(filePath)) {
  block('applied migrations are immutable; add a new migration instead.');
}
process.exit(0);
