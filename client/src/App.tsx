import React, { useState, useEffect, useRef } from 'react';
import { api } from './api/client';
import type { Project, OverviewData, OllamaStatus, SystemSettings } from './types';
import type { NavItem } from './components/layout/Sidebar';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Overview } from './pages/Overview';
import { MyProjects } from './pages/MyProjects';
import { ProjectDetail } from './pages/ProjectDetail';
import { AiPlanner } from './pages/AiPlanner';
import { ProgressIntelligence } from './pages/ProgressIntelligence';
import { TasksPage } from './pages/TasksPage';
import { TimelinePage } from './pages/TimelinePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AiAssistant } from './pages/AiAssistant';
import { ArchitectureHld } from './pages/ArchitectureHld';
import { SettingsPage } from './pages/Settings';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { OllamaModal } from './components/ollama/OllamaModal';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavItem>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);
  const [selectedProjectDetailId, setSelectedProjectDetailId] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOllamaModalOpen, setIsOllamaModalOpen] = useState(false);

  // Initial data loading
  const loadRequestId = useRef(0);
  const loadData = async () => {
    const requestId = ++loadRequestId.current;
    try {
      setLoading(true);
      const [projList, overview, ollama, sysSettings] = await Promise.allSettled([
        api.getProjects(),
        api.getOverview(),
        api.getOllamaStatus(),
        api.getSettings(),
      ]);

      // A slower, older refresh must not overwrite a newer project update.
      if (requestId !== loadRequestId.current) return;

      if (projList.status === 'fulfilled') {
        setProjects(projList.value);
        if (projList.value.length > 0 && !activeProjectId) {
          setActiveProjectId(projList.value[0].id);
        }
      }

      if (overview.status === 'fulfilled') {
        setOverviewData(overview.value);
      }

      if (ollama.status === 'fulfilled') {
        setOllamaStatus(ollama.value);
      }

      if (sysSettings.status === 'fulfilled') {
        setSettings(sysSettings.value);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshOllama = async () => {
    try {
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
    } catch (err) {
      console.error('Error refreshing Ollama status:', err);
    }
  };

  const handleSaveOllamaSettings = async (endpoint: string, activeModel: string) => {
    const updated = await api.updateOllamaSettings({ endpoint, activeModel });
    setOllamaStatus(updated);
  };

  const handleSaveSystemSettings = async (newSettings: Partial<SystemSettings>) => {
    const updated = await api.updateSettings(newSettings);
    setSettings(updated);
  };

  const handleCreateProject = async (data: Partial<Project>) => {
    const created = await api.createProject(data);
    // The create response contains the raw project row (techStack is stored as
    // JSON text), while list/detail views use parsed values. Normalise it and
    // insert it immediately so the dashboard never waits for a refresh to show
    // the project and its linked folder.
    const optimistic: Project = {
      ...created,
      techStack: Array.isArray(created.techStack) ? created.techStack : [],
      completedTasksCount: 0,
      pendingTasksCount: 0,
      phases: created.phases || [],
    };
    setProjects((prev) => [optimistic, ...prev.filter((project) => project.id !== created.id)]);
    setActiveProjectId(created.id);
    await loadData();
    setActiveProjectId(created.id);
    return created;
  };

  const handleUpdateProject = async (id: string, data: Partial<Project>) => {
    const updated = await api.updateProject(id, data);
    // Reflect the saved project immediately, then reconcile with server-derived
    // counts and stats. This keeps dashboard cards in sync without a reload.
    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, ...updated } : project)));
    await loadData();
    return updated;
  };

  const handleDeleteProject = async (id: string) => {
    await api.deleteProject(id);
    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setActiveProjectId(remaining.length > 0 ? remaining[0].id : undefined);
    }
    if (selectedProjectDetailId === id) {
      setSelectedProjectDetailId(null);
    }
    await loadData();
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const projectForDetail = selectedProjectDetailId
    ? projects.find((p) => p.id === selectedProjectDetailId) || null
    : null;

  return (
    <div className="flex min-h-screen bg-transparent text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setSelectedProjectDetailId(null);
          setCurrentTab(tab);
          setMobileNavOpen(false);
        }}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        activeProjectName={activeProject?.name}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={(id) => {
            setActiveProjectId(id);
            if (selectedProjectDetailId) {
              setSelectedProjectDetailId(id);
            }
          }}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          ollamaStatus={ollamaStatus}
          onRefreshOllama={handleRefreshOllama}
          onOpenOllamaModal={() => setIsOllamaModalOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {projectForDetail ? (
            <ProjectDetail
              project={projectForDetail}
              onBack={() => setSelectedProjectDetailId(null)}
              onUpdate={handleUpdateProject}
              onDelete={handleDeleteProject}
              onNavigateToTab={(tab) => {
                setSelectedProjectDetailId(null);
                setCurrentTab(tab);
              }}
            />
          ) : (
            <>
              {currentTab === 'overview' && (
                <Overview
                  overviewData={overviewData}
                  projects={projects}
                  loading={loading}
                  onSelectProject={(id) => setSelectedProjectDetailId(id)}
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  onNavigateToTab={(tab) => setCurrentTab(tab)}
                />
              )}

              {currentTab === 'projects' && (
                <MyProjects
                  projects={projects}
                  loading={loading}
                  onSelectProject={(id) => setSelectedProjectDetailId(id)}
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  onOpenAiPlannerModal={() => setCurrentTab('planner')}
                />
              )}

              {currentTab === 'planner' && (
                <AiPlanner
                  activeProject={activeProject}
                  ollamaStatus={ollamaStatus}
                  onRefreshProject={loadData}
                />
              )}

              {currentTab === 'progress' && (
                <ProgressIntelligence
                  activeProject={activeProject}
                  onRefreshProject={loadData}
                  onUpdateProject={handleUpdateProject}
                />
              )}

              {currentTab === 'tasks' && (
                <TasksPage activeProject={activeProject} projects={projects} />
              )}

              {currentTab === 'timeline' && (
                <TimelinePage activeProject={activeProject} />
              )}

              {currentTab === 'analytics' && <AnalyticsPage projects={projects} />}

              {currentTab === 'assistant' && (
                <AiAssistant activeProject={activeProject} ollamaStatus={ollamaStatus} />
              )}

              {currentTab === 'architecture' && (
                <ArchitectureHld
                  activeProject={activeProject}
                  ollamaStatus={ollamaStatus}
                  onRefreshProject={loadData}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsPage
                  ollamaStatus={ollamaStatus}
                  settings={settings}
                  onRefreshOllama={handleRefreshOllama}
                  onSaveOllamaSettings={handleSaveOllamaSettings}
                  onSaveSystemSettings={handleSaveSystemSettings}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateProject}
        onCreated={(p) => {
          // A newly created project must land on the dashboard where its
          // linked folder, progress and stats are immediately visible.
          setActiveProjectId(p.id);
          setSelectedProjectDetailId(null);
          setCurrentTab('overview');
        }}
      />

      <OllamaModal
        isOpen={isOllamaModalOpen}
        onClose={() => setIsOllamaModalOpen(false)}
        ollamaStatus={ollamaStatus}
        onRefresh={handleRefreshOllama}
        onSave={handleSaveOllamaSettings}
      />
    </div>
  );
};

export default App;
