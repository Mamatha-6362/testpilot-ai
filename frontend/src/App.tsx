import React, { useState, useEffect } from 'react';
import { Project, TestCase, TestRun, Patch, AppSettings } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { TestGeneration } from './pages/TestGeneration';
import { TestExecution } from './pages/TestExecution';
import { FailureAnalysis } from './pages/FailureAnalysis';
import { RagExplorer } from './pages/RagExplorer';
import { Evaluation } from './pages/Evaluation';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  // When active project changes, fetch its tests, runs, and patches
  useEffect(() => {
    if (activeProject) {
      refreshProjectData(activeProject.id);
    }
  }, [activeProject]);

  const initApp = async () => {
    try {
      const sett = await api.getSettings();
      setSettings(sett);

      const projs = await api.getProjects();
      setProjects(projs);

      if (projs.length > 0) {
        setActiveProject(projs[0]);
      } else {
        // Automatically load demo cart project if fresh install
        await handleLoadDemo();
      }
    } catch (err) {
      console.error('Initialization error', err);
    }
  };

  const refreshProjectData = async (projectId: string) => {
    try {
      const [testsRes, runsRes, patchesRes] = await Promise.all([
        api.getTests(projectId),
        api.getRuns(projectId),
        api.getPatches(projectId),
      ]);
      setTests(testsRes || []);
      setRuns(runsRes || []);
      setPatches(patchesRes || []);
    } catch (err) {
      console.error('Failed to refresh project data', err);
    }
  };

  const handleRefreshProjects = async () => {
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      if (projs.length > 0 && !activeProject) {
        setActiveProject(projs[0]);
      }
    } catch (err) {
      console.error('Failed to refresh projects', err);
    }
  };

  const handleLoadDemo = async () => {
    try {
      setIsLoadingDemo(true);
      const demo = await api.loadDemoProject();
      setActiveProject(demo);
      await handleRefreshProjects();
      await refreshProjectData(demo.id);
    } catch (err: any) {
      alert(`Failed to load demo: ${err.message}`);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleIndexProject = async () => {
    if (!activeProject) return;
    try {
      setIsIndexing(true);
      await api.indexProject(activeProject.id);
      await handleRefreshProjects();
      alert('RAG indexing complete! Context parsed and duplicate noise filtered.');
    } catch (err: any) {
      alert(`Indexing failed: ${err.message}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const latestRun = runs[0];
  const activeFailuresCount = latestRun ? latestRun.failed_count : 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => setActiveProject(p)}
        onLoadDemo={handleLoadDemo}
        settings={settings}
        isLoadingDemo={isLoadingDemo}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          failedCount={activeFailuresCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-br from-slate-950 via-slate-900/40 to-slate-950">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <Dashboard
                activeProject={activeProject}
                tests={tests}
                runs={runs}
                patches={patches}
                onSelectTab={(tab) => setCurrentTab(tab)}
                onLoadDemo={handleLoadDemo}
              />
            )}

            {currentTab === 'projects' && (
              <Projects
                activeProject={activeProject}
                projects={projects}
                onSelectProject={(p) => setActiveProject(p)}
                onRefreshProjects={handleRefreshProjects}
                onIndexProject={handleIndexProject}
                isIndexing={isIndexing}
              />
            )}

            {currentTab === 'generate' && (
              <TestGeneration
                activeProject={activeProject}
                tests={tests}
                onRefreshTests={() => activeProject && refreshProjectData(activeProject.id)}
              />
            )}

            {currentTab === 'runs' && (
              <TestExecution
                activeProject={activeProject}
                runs={runs}
                onRefreshRuns={() => activeProject && refreshProjectData(activeProject.id)}
                onSelectTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'failures' && (
              <FailureAnalysis
                activeProject={activeProject}
                runs={runs}
                patches={patches}
                onRefreshRuns={() => activeProject && refreshProjectData(activeProject.id)}
                onRefreshPatches={() => activeProject && refreshProjectData(activeProject.id)}
              />
            )}

            {currentTab === 'rag' && <RagExplorer activeProject={activeProject} />}

            {currentTab === 'evaluation' && <Evaluation />}

            {currentTab === 'settings' && (
              <Settings
                settings={settings}
                onRefreshSettings={async () => {
                  const sett = await api.getSettings();
                  setSettings(sett);
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
