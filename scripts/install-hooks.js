const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hookDir = path.join(process.cwd(), '.git', 'hooks');
const hookFile = path.join(hookDir, 'pre-commit');

const hookContent = `#!/bin/sh
node scripts/pre-commit-check.js
`;

try {
  if (!fs.existsSync(hookDir)) {
    fs.mkdirSync(hookDir, { recursive: true });
  }
  fs.writeFileSync(hookFile, hookContent, { encoding: 'utf8', mode: 0o755 });
  console.log('[SUCCESS] Pre-commit security hook installed at .git/hooks/pre-commit');
} catch (err) {
  console.error('[ERROR] Failed to install git hook:', err.message);
}
