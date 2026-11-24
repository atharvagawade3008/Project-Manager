# Project OS — Security Architecture & Guidelines

## 1. Security Overview

Project OS is designed to run locally and inspect user project directories. To protect sensitive credentials, environments, and local data, all developers and contributors must adhere to strict security hygiene.

---

## 2. Environment Variables & Secret Management

- **Zero Hardcoded Secrets Policy**: Never commit database connection strings, passwords, API keys, or private tokens in source code, configuration files, or documentation.
- **Environment Files**:
  - `.env`, `.env.local`, `.env.production` are strictly ignored by `.gitignore`.
  - Use `.env.example` as a template containing **placeholders only** (e.g., `USERNAME:PASSWORD`).
  - Database URLs must be loaded via `env("DATABASE_URL")` through `dotenv`.

### Database Configuration
- In `server/prisma/schema.prisma`:
  ```prisma
  datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
  }
  ```
- Local SQLite connection: `DATABASE_URL="file:./dev.db"`
- MongoDB Atlas connection (if configured): `DATABASE_URL="mongodb+srv://USERNAME:PASSWORD@cluster0.example.mongodb.net/database?retryWrites=true&w=majority"`

---

## 3. Dependency & Artifact Hygiene

- **Vendor directories (`node_modules/`, `server/node_modules/`, `client/node_modules/`) must NEVER be tracked in Git.**
- Build artifacts (`dist/`, `server/dist/`, `client/dist/`) and local database files (`*.db`, `*.db-journal`) are ignored.

---

## 4. GitHub Secret Scanning & Push Protection

1. **GitHub Secret Scanning**: Ensure Secret Scanning is enabled under **Repository Settings -> Code security and analysis -> Secret scanning**.
2. **GitHub Push Protection**: Enable **Push protection** to block commits containing detected secrets before they reach the remote repository.

---

## 5. Automated Pre-commit Checks

A lightweight pre-commit hook is provided in `scripts/pre-commit-check.js`.
To enable the pre-commit hook locally:
```bash
node scripts/install-hooks.js
```
This hook automatically scans staged files before each commit to ensure:
- No `.env` files are staged.
- No `node_modules` files are staged.
- No database connection URIs with embedded passwords are staged.

---

## 6. Incident Response & Credential Rotation Checklist

If a credential or database URI is accidentally exposed:
1. **Rotate Immediately**: In MongoDB Atlas / database provider, generate a new password or delete the compromised user immediately.
2. **Update Local Environment**: Update the local `.env` file with the new connection string.
3. **Audit History**: Check git history for exposure points.
4. **Clean Git History**: If committed, rewrite git history using tools like `git-filter-repo` (with approval and backup) and force-push.
