import React, { useState } from 'react';
import { Project, TestRun, TestResult } from '../types';
import { api } from '../services/api';
import {
  PlaySquare,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  AlertOctagon,
  RefreshCw,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { TabType } from '../components/Sidebar';

interface TestExecutionProps {
  activeProject: Project | null;
  runs: TestRun[];
  onRefreshRuns: () => void;
  onSelectTab: (tab: TabType) => void;
}

export const TestExecution: React.FC<TestExecutionProps> = ({
  activeProject,
  runs,
  onRefreshRuns,
  onSelectTab,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'tests' | 'stdout' | 'stderr'>('tests');

  const latestRun = runs[0];

  const handleRunAll = async () => {
    if (!activeProject) {
      alert('Please select or load a project first');
      return;
    }
    try {
      setIsRunning(true);
      await api.runTests(activeProject.id);
      onRefreshRuns();
    } catch (err: any) {
      alert(`Test run failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Runner Control */}
      <div className="glass-panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <PlaySquare className="w-5 h-5 text-cyan-400" />
            Pytest Execution Sandbox
          </h1>
          <p className="text-xs text-slate-400">
            Executes real pytest in an isolated workspace with strict timeouts and zero secret leakage.
          </p>
        </div>

        <button
          onClick={handleRunAll}
          disabled={isRunning || !activeProject}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2"
        >
          <PlaySquare className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running Pytest...' : 'Execute Pytest Suite'}
        </button>
      </div>

      {/* Latest Run Results Summary */}
      {latestRun ? (
        <div className="space-y-6">
          <div className="glass-panel p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-slate-400 font-mono block mb-1">Execution Status</span>
              <span
                className={`inline-block px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${
                  latestRun.status === 'passed'
                    ? 'badge-glow-emerald'
                    : latestRun.status === 'failed'
                    ? 'badge-glow-rose'
                    : 'badge-glow-amber'
                }`}
              >
                {latestRun.status}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-mono block mb-1">Passing Tests</span>
              <span className="text-xl font-extrabold text-emerald-400">
                {latestRun.passed_count} / {latestRun.total_count}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-mono block mb-1">Failed Tests</span>
              <span className="text-xl font-extrabold text-rose-400">
                {latestRun.failed_count}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-mono block mb-1">Execution Time</span>
              <span className="text-xl font-extrabold text-cyan-400 font-mono">
                {latestRun.duration_seconds}s
              </span>
            </div>
          </div>

          {/* Detailed results tabs */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`text-xs font-mono py-1.5 px-3 rounded-lg transition-colors ${
                    activeTab === 'tests'
                      ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Individual Tests ({latestRun.results.length})
                </button>
                <button
                  onClick={() => setActiveTab('stdout')}
                  className={`text-xs font-mono py-1.5 px-3 rounded-lg transition-colors ${
                    activeTab === 'stdout'
                      ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Raw Pytest Output (stdout)
                </button>
                <button
                  onClick={() => setActiveTab('stderr')}
                  className={`text-xs font-mono py-1.5 px-3 rounded-lg transition-colors ${
                    activeTab === 'stderr'
                      ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Errors (stderr)
                </button>
              </div>

              {latestRun.failed_count > 0 && (
                <button
                  onClick={() => onSelectTab('failures')}
                  className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  Inspect Failures &amp; Fix <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tab 1: Individual Tests */}
            {activeTab === 'tests' && (
              <div className="space-y-2">
                {latestRun.results.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      {res.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-mono font-semibold text-slate-200">
                          {res.test_name}
                        </div>
                        {res.explanation && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xl">
                            {res.explanation}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          res.status === 'passed' ? 'badge-glow-emerald' : 'badge-glow-rose'
                        }`}
                      >
                        {res.status}
                      </span>
                      {res.status === 'failed' && (
                        <button
                          onClick={() => onSelectTab('failures')}
                          className="btn-secondary text-xs py-1 px-2.5"
                        >
                          Analyze
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Stdout */}
            {activeTab === 'stdout' && (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {latestRun.stdout || 'No stdout produced.'}
              </div>
            )}

            {/* Tab 3: Stderr */}
            {activeTab === 'stderr' && (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-rose-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {latestRun.stderr || 'No stderr errors.'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-500 font-mono text-xs glass-panel">
          No test runs yet. Click "Execute Pytest Suite" above to start.
        </div>
      )}
    </div>
  );
};
