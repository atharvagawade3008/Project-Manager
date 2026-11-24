# Project OS
## Personal AI Project Planner & Autonomous Progress Intelligence System

Project OS is a locally hosted, developer command-centre application combining intelligent project planning, task management, local filesystem analysis, AI-powered codebase understanding, and evidence-based project progress tracking.

---

## Key Capabilities

- **Dual Intelligence Architecture:**
  - **Layer A (Project Planning Intelligence):** Hierarchical decomposition of projects into Phases, Modules, Milestones, Tasks, and Subtasks with difficulty estimates, time tracking, dependencies, and risk mitigation.
  - **Layer B (Project Progress Intelligence):** Connects to any local filesystem directory, recursively inspects source code, AST, and configurations, compares real implementation against planned requirements, and deterministically computes weighted progress scores backed by file evidence citations.
- **Local Ollama AI Runtime Integration:** Direct HTTP communication with local Ollama (`http://127.0.0.1:11434`), model discovery (Qwen2.5-Coder, DeepSeek-Coder, etc.), and graceful fallback when disconnected.
- **Strict Local Privacy & Security:** No paid cloud APIs, no external telemetry. File access is strictly read-only, validated through canonical paths, with built-in exclusion filters for secret files (`.env`, `.pem`, tokens), heavy assets, and binaries.
- **Future-Ready HLD Architecture:** Designed with dedicated extension points for AI High-Level Design (HLD) generation and planned vs. actual architectural drift detection.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend:** Node.js, Express, TypeScript, REST API
- **Database:** SQLite with Prisma ORM
- **AI Runtime:** Ollama local HTTP API

---

## Windows Setup and Startup Instructions

### Prerequisites
1. **Node.js**: v18+ (tested on Node v24.14.0)
2. **Git**: Installed and available in PATH
3. **Ollama (Optional for planning & code scanning)**: [Download Ollama for Windows](https://ollama.ai)

### Step 1: Install Dependencies
Open PowerShell or Command Prompt in the project root:
```powershell
# Install root, backend, and frontend dependencies
npm install
cd server && npm install && npx prisma db push && cd ..
cd client && npm install && cd ..
```

### Step 2: Seed Developer Database (Optional)
```powershell
cd server
npx tsx src/seed.ts
cd ..
```

### Step 3: Run Project OS
You can start both backend and frontend concurrently:
```powershell
npm run dev
```

Or run them individually in separate terminals:
- **Backend Server (Port 3001):**
  ```powershell
  cd server
  npm run dev
  ```
- **Frontend App (Port 5173):**
  ```powershell
  cd client
  npm run dev
  ```

### Step 4: Access Application
Open your browser to:
```
http://localhost:5173
```
- Backend Health API: `http://localhost:3001/api/health`
- Prisma Studio: `npm run prisma:studio` (inside `server/`)

---

## Project Structure

```
Project Manager/
├── client/                     # React + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── api/                # API client with typed fetch handlers
│   │   ├── components/
│   │   │   ├── layout/         # Collapsible Sidebar & Command Header
│   │   │   ├── projects/       # ProjectCard, CreateProjectModal
│   │   │   ├── ollama/         # Local Ollama Status & Connection Modal
│   │   │   └── ui/             # Reusable UI (Button, Card, Badge, Modal, StatCard)
│   │   ├── pages/              # Overview, MyProjects, ProjectDetail, AiPlanner,
│   │   │                       # ProgressIntelligence, Tasks, Timeline, Analytics,
│   │   │                       # AiAssistant, ArchitectureHld, Settings
│   │   └── types/              # Frontend TypeScript Interfaces
│   ├── tailwind.config.js      # Custom dark command-centre palette
│   └── vite.config.ts          # Vite build configuration & API reverse proxy
│
├── server/                     # Express + TypeScript + Prisma Backend
│   ├── prisma/
│   │   ├── schema.prisma       # SQLite Schema (Projects, Tasks, Features, Evidence, Scans)
│   │   └── dev.db              # SQLite Database file
│   ├── src/
│   │   ├── modules/
│   │   │   ├── projects/       # Project CRUD, filtering, metadata
│   │   │   ├── overview/       # Aggregated stats, upcoming deadlines, attention tasks
│   │   │   ├── ollama/         # Local Ollama detection, model discovery & proxy
│   │   │   └── settings/       # System and security settings service
│   │   ├── middleware/         # Express error handling
│   │   ├── types/              # Backend DTOs & response contracts
│   │   ├── db.ts               # Prisma Client singleton
│   │   ├── app.ts              # Express application factory
│   │   ├── index.ts            # Server entrypoint (Port 3001)
│   │   └── seed.ts             # Developer sample database seeder
│
└── package.json                # Root orchestration scripts
```
