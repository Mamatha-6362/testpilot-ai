import React from 'react';
import { Project, TestCase, TestRun, Patch } from '../types';
import {
  FileCode2,
  PlaySquare,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
} from 'lucide-react';
import { TabType } from '../components/Sidebar';

interface DashboardProps {
  activeProject: Project | null;
  tests: TestCase[];
  runs: TestRun[];
  patches: Patch[];
  onSelectTab: (tab: TabType) => void;
  onLoadDemo: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeProject,
  tests,
  runs,
  patches,
  onSelectTab,
  onLoadDemo,
}) => {
  const latestRun = runs[0];
  const passRate =
    latestRun && latestRun.total_count > 0
      ? Math.round((latestRun.passed_count / latestRun.total_count) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="glass-panel p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            AI-Powered Test Case Generation & Code Correction Platform
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            Automated QA & Code Repair with Evidence Traceability
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            TestPilot AI indexes your codebase using RAG, generates grounded test suites, executes real pytest runs in an isolated sandbox, identifies root causes with exact traceback evidence, and lets you safely approve and verify code patches.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {!activeProject ? (
              <button onClick={onLoadDemo} className="btn-primary text-sm py-2 px-4">
                <Sparkles className="w-4 h-4" />
                Quickstart with Demo Cart Project
              </button>
            ) : (
              <>
                <button
                  onClick={() => onSelectTab('generate')}
                  className="btn-primary text-sm py-2 px-4"
                >
                  <FileCode2 className="w-4 h-4" />
                  Generate Test Cases
                </button>
                <button
                  onClick={() => onSelectTab('runs')}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  <PlaySquare className="w-4 h-4" />
                  Execute Pytest
                </button>
                {latestRun && latestRun.failed_count > 0 && (
                  <button
                    onClick={() => onSelectTab('failures')}
                    className="btn-danger text-sm py-2 px-4"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Inspect Failures ({latestRun.failed_count})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5-Step Workflow Interactive Guide */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Core Feedback Workflow
          </h2>
          <span className="text-xs text-slate-400 font-mono">5 Continuous Steps</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            {
              step: '01',
              title: 'Upload & Index',
              desc: 'Parse files, extract AST, filter noise, and index RAG embeddings.',
              tab: 'projects' as TabType,
            },
            {
              step: '02',
              title: 'Generate Tests',
              desc: 'Synthesize positive, boundary, negative, and exception cases.',
              tab: 'generate' as TabType,
            },
            {
              step: '03',
              title: 'Run Sandbox',
              desc: 'Run real pytest subprocess with strict timeout & isolation.',
              tab: 'runs' as TabType,
            },
            {
              step: '04',
              title: 'Failure Analysis',
              desc: 'Map errors to code lines, explain cause, propose minimal patch.',
              tab: 'failures' as TabType,
            },
            {
              step: '05',
              title: 'Verify Fix',
              desc: 'Backup workspace, apply reviewed patch, rerun tests to verify.',
              tab: 'failures' as TabType,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onSelectTab(item.tab)}
              className="glass-panel p-3.5 glass-panel-hover cursor-pointer border border-slate-800/80 hover:border-cyan-500/40 relative group"
            >
              <div className="text-[11px] font-mono font-bold text-cyan-400 mb-1">
                STEP {item.step}
              </div>
              <div className="text-sm font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                {item.title}
              </div>
              <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Project Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Project Files</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {activeProject ? activeProject.file_count || 4 : 0}
          </div>
          <div className="text-[11px] text-slate-500">
            {activeProject ? activeProject.name : 'No project active'}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Generated Tests</span>
            <FileCode2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{tests.length}</div>
          <div className="text-[11px] text-slate-500">Positive, boundary, exception, etc.</div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Test Pass Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {passRate !== null ? `${passRate}%` : 'Not Run'}
          </div>
          <div className="text-[11px] text-slate-500">
            {latestRun ? `${latestRun.passed_count}/${latestRun.total_count} tests passing` : 'Awaiting run'}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Code Patches</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{patches.length}</div>
          <div className="text-[11px] text-slate-500">
            {patches.filter((p) => p.status === 'applied').length} applied with backups
          </div>
        </div>
      </div>

      {/* Recent Test Runs Section */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Recent Test Runs
          </h2>
          <button
            onClick={() => onSelectTab('runs')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
          >
            All Runs <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm font-mono border border-dashed border-slate-800 rounded-xl">
            No test runs recorded yet. Generate tests and click "Run Tests" to execute in isolated sandbox.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {runs.slice(0, 4).map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                      r.status === 'passed'
                        ? 'badge-glow-emerald'
                        : r.status === 'failed'
                        ? 'badge-glow-rose'
                        : 'badge-glow-amber'
                    }`}
                  >
                    {r.status}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      Run ID: <span className="font-mono text-cyan-400">{r.id}</span>
                      <span className="text-xs text-slate-500 ml-2">({r.run_type})</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {r.passed_count} passed &middot; {r.failed_count} failed &middot; {r.duration_seconds}s
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSelectTab('runs')}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
