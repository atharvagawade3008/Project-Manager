# 🚀 Project OS
### Personal AI Project Planner & Autonomous Progress Intelligence System

**Plan. Build. Analyse. Evolve.**

Project OS is a locally hosted, AI-powered developer command centre that brings project planning, software architecture, AI assistance, codebase analysis, and autonomous progress tracking into one unified workspace.

Instead of relying entirely on manually updated task statuses, Project OS can connect to your local project directory, inspect actual implementation files, and evaluate development progress against planned requirements.

It combines two major intelligence layers: **AI-powered project planning** and **evidence-based implementation intelligence**.

---

## ✨ Features

### 🧠 1. AI Project Planner
Transform an idea into a structured and actionable development roadmap.

- AI-assisted project planning using locally hosted Ollama models.
- Hierarchical project decomposition:
  - Projects
  - Phases
  - Modules
  - Milestones
  - Tasks
  - Subtasks
- Difficulty and time estimation.
- Task dependencies and progress management.
- Risk identification and mitigation planning.

### 🏗️ 2. AI High-Level Design (HLD)
Plan and understand the architecture of your software projects.

- AI-powered High-Level Design generation.
- Architecture-oriented project intelligence.
- Helps structure system components and understand their relationships.
- Integrated into the overall project development workflow.

### 💬 3. AI Intelligence Chatbot
An integrated AI assistant powered by Ollama.

- Interact with locally hosted AI models.
- Get AI assistance directly inside Project OS.
- Use local LLM capabilities without depending on paid cloud AI APIs.

### 🔍 4. Autonomous Progress Intelligence

One of the core capabilities of Project OS.

Connect any local project directory and let the system analyse its actual implementation.

**How it works:**
1. Connect a local project directory.
2. Project OS recursively inspects the project files.
3. Analyses source code, Abstract Syntax Trees (AST), and configuration files.
4. Compares actual implementation against planned project requirements.
5. Computes weighted progress scores using deterministic logic.
6. Provides file-level evidence citations supporting its assessments.

The objective is to measure actual implementation rather than simply trusting manually updated task statuses.

### 📊 5. Project Management & Analytics

- Centralised project dashboard.
- Task and milestone management.
- Project timelines.
- Progress analytics.
- Upcoming deadlines and attention tasks.
- Project-level development overview.

### 🔒 6. Local-First & Privacy-Focused

Project OS is designed to operate locally on your machine.

- Uses Ollama for local AI inference.
- No dependency on paid cloud AI APIs.
- SQLite database for local data persistence.
- Read-only filesystem inspection.
- Canonical path validation.
- Exclusion filters for sensitive files such as `.env`, `.pem`, tokens, binaries, and heavy assets.
- Graceful handling of unavailable Ollama connections.

**Your development environment remains under your control.**

---

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| UI Icons | Lucide Icons |
| Charts | Recharts |
| Backend | Node.js, Express |
| Backend Language | TypeScript |
| Database | SQLite |
| ORM | Prisma |
| AI Runtime | Ollama |
| AI Models | Qwen2.5-Coder, DeepSeek-Coder and other compatible local models |

---

## 🖥️ System Requirements

Before installing Project OS, ensure your machine has the following:

| Requirement | Minimum / Recommended |
|---|---|
| Operating System | Windows 10/11 |
| Node.js | v18 or newer |
| npm | Included with Node.js |
| Git | Installed and available in PATH |
| RAM | 8 GB recommended; model-dependent |
| Storage | Sufficient space for dependencies and local AI models |
| Ollama | Required for AI features |

**Note:** Project OS can be started without Ollama, but AI-powered functionality requires a running Ollama instance and a compatible downloaded model.

---

# ⚙️ Installation & Setup

Follow these steps to run Project OS on your own computer.

### Step 1: Install Prerequisites

Install the following:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/downloads)
- [Ollama](https://ollama.com/download)

Verify Node.js and npm installation:

```powershell
node -v
npm -v
git --version
```

### Step 2: Clone the Repository

Open PowerShell or Command Prompt and execute:

```powershell
git clone YOUR_REPOSITORY_URL
```

Navigate into the project directory:

```powershell
cd "Project Manager"
```

Replace `YOUR_REPOSITORY_URL` with the actual GitHub repository URL.

### Step 3: Install Dependencies

Install the root dependencies:

```powershell
npm install
```

Install backend dependencies and initialise the database:

```powershell
cd server
npm install
npx prisma db push
cd ..
```

Install frontend dependencies:

```powershell
cd client
npm install
cd ..
```

### Step 4: Configure Local AI Using Ollama

Start Ollama and download a compatible coding model.

For example:

```powershell
ollama pull qwen2.5-coder
```

Alternatively, you can use:

```powershell
ollama pull deepseek-coder
```

Verify that your model is available:

```powershell
ollama list
```

Ollama normally exposes its local API at:

```text
http://127.0.0.1:11434
```

Make sure Ollama is running before using AI-powered features.

**Important:** Model availability and performance depend on your system's RAM, hardware, and the particular model variant. You can use other compatible Ollama models supported by your application.

### Step 5: Seed the Database (Optional)

To populate the application with sample developer data, execute:

```powershell
cd server
npx tsx src/seed.ts
cd ..
```

This step is optional.

### Step 6: Start Project OS

Navigate to the project root and execute:

```powershell
npm run dev
```

This starts the frontend and backend development servers concurrently.

If you prefer running them separately:

**Backend:**

```powershell
cd server
npm run dev
```

**Frontend:**

Open another terminal:

```powershell
cd client
npm run dev
```

### Step 7: Open Project OS

Once both servers are running, open your browser:

**Application:**

http://localhost:5173

**Backend Health Check:**

http://localhost:3001/api/health

**Database Management (Optional):**

```powershell
cd server
npm run prisma:studio
```

---

## 📁 Project Structure

```text
Project Manager/
│
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── projects/
│   │   │   ├── ollama/
│   │   │   └── ui/
│   │   │
│   │   ├── pages/
│   │   │   ├── Overview
│   │   │   ├── MyProjects
│   │   │   ├── ProjectDetail
│   │   │   ├── AiPlanner
│   │   │   ├── ProgressIntelligence
│   │   │   ├── Tasks
│   │   │   ├── Timeline
│   │   │   ├── Analytics
│   │   │   ├── AiAssistant
│   │   │   ├── ArchitectureHld
│   │   │   └── Settings
│   │   │
│   │   └── types/
│   │
│   └── vite.config.ts
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── dev.db
│   │
│   └── src/
│       ├── modules/
│       │   ├── projects/
│       │   ├── overview/
│       │   ├── ollama/
│       │   └── settings/
│       │
│       ├── middleware/
│       ├── types/
│       ├── db.ts
│       ├── app.ts
│       ├── index.ts
│       └── seed.ts
│
└── package.json
```

---

## 🔧 Troubleshooting

### 1. Ollama Connection Failed

- Ensure Ollama is installed and running.
- Verify the local API is accessible at `http://127.0.0.1:11434`.
- Check whether at least one model is downloaded using `ollama list`.
- Verify that the selected model is available.

### 2. Database Errors

Run the following commands from the server directory:

```powershell
npx prisma generate
npx prisma db push
```

Restart the backend afterward.

### 3. Port Already in Use

Project OS uses:

- Frontend: `5173`
- Backend: `3001`
- Ollama: `11434`

Ensure these ports are available before starting the application.

### 4. Dependency Installation Problems

Try reinstalling dependencies from the relevant project directory:

```powershell
npm install
```

If problems persist, check your Node.js version and review the terminal error messages.

---

## 🔐 Security & Privacy

Project OS follows a local-first approach.

Its filesystem analysis functionality is designed to be read-only. It uses path validation and exclusion rules to avoid inspecting sensitive files and unnecessary assets.

However, local execution does not automatically guarantee complete security. Review the code and your local configuration before connecting directories containing confidential information.

Do not commit API credentials, tokens, private keys, `.env` files, or personal project data to GitHub.

---

## 🚀 Project Vision

Project OS explores a different approach to software project management.

Traditional project management systems track what developers report.

Project OS aims to understand what developers actually build.

By combining AI-powered planning, architectural intelligence, local LLMs, codebase analysis, and deterministic progress computation, it moves towards a more intelligent and evidence-driven development environment.

The long-term vision is to make Project OS a unified command centre throughout the software development lifecycle.

---

## 🤝 Contributing

Contributions, suggestions, bug reports, and feature ideas are welcome!

If you find this project interesting, consider:

- ⭐ Starring the repository.
- 🐛 Reporting issues.
- 💡 Suggesting new features.
- 🔧 Contributing improvements.

---

## 👨‍💻 Author

**Atharva Gawade**

Computer Science Student | Developer | AI & Software Engineering Enthusiast

- GitHub: [@atharvagawade3008](https://github.com/atharvagawade3008)
- Portfolio: [atharvagawade.netlify.app](https://atharvagawade.netlify.app)
- LinkedIn: [Atharva Gawade](https://www.linkedin.com/in/atharva-gawade-126984289/)

---

**PROJECT OS — Plan. Build. Analyse. Evolve.**

*Built with curiosity, local AI, and a vision for smarter software development.*
