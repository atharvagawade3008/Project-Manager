#!/usr/bin/env node
/**
 * Project OS - Lightweight Pre-commit Secret Scanner
 * Prevents committing secrets, environment files, and vendor folders.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BLOCKED_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\.(?!example$)[a-z0-9_-]+$/i,
  /(?:^|[\\/])node_modules[\\/]/i,
  /(?:^|[\\/])\.env$/i,
  /(?:^|[\\/])\.env\.(?!example$)[a-z0-9_-]+$/i,
];

const SECRET_PATTERNS = [
  { name: 'MongoDB URI with Credentials', regex: /mongodb(?:\+srv)?:\/\/[^:\s"'`]+:[^@\s"'`]+@[^\s"'`]+/gi },
  { name: 'Postgres/MySQL URI with Credentials', regex: /(?:postgres(?:ql)?|mysql):\/\/[^:\s"'`]+:[^@\s"'`]+@[^\s"'`]+/gi },
  { name: 'Private Key Header', regex: /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/gi },
  { name: 'GitHub Token', regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/gi },
  { name: 'AWS Access Key', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g }
];

function run() {
  let stagedFiles = [];
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    stagedFiles = output.trim().split(/\r?\n/).filter(Boolean);
  } catch (err) {
    process.exit(0);
  }

  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  let violations = [];

  for (const file of stagedFiles) {
    // Check blocked file names
    for (const pat of BLOCKED_FILE_PATTERNS) {
      if (pat.test(file)) {
        violations.push({
          file,
          reason: 'Sensitive or vendor file blocked from version control (matched ' + pat.toString() + ')'
        });
      }
    }

    // Check file contents for secrets
    if (fs.existsSync(file)) {
      try {
        const stat = fs.statSync(file);
        if (stat.size > 2 * 1024 * 1024) continue; // skip large files

        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);

        lines.forEach((line, idx) => {
          for (const sp of SECRET_PATTERNS) {
            if (sp.regex.test(line)) {
              // Ignore standard placeholder strings
              if (line.includes('USERNAME:PASSWORD') || line.includes('root:<password>') || line.includes('randompassword@localhost')) {
                continue;
              }
              violations.push({
                file,
                line: idx + 1,
                reason: `Potential ${sp.name} detected on line ${idx + 1}`
              });
            }
          }
        });
      } catch (e) {
        // Non-UTF8 or inaccessible file
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n\x1b[31m[GIT PRE-COMMIT HOOK ERROR] Commit rejected due to security policy violations:\x1b[0m');
    violations.forEach(v => {
      console.error(` - ${v.file}${v.line ? `:${v.line}` : ''} -> ${v.reason}`);
    });
    console.error('\n\x1b[33mPlease remove sensitive credentials or add the file to .gitignore before committing.\x1b[0m\n');
    process.exit(1);
  }

  process.exit(0);
}

run();
