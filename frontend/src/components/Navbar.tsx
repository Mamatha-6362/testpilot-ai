import React from 'react';
import { Project, AppSettings } from '../types';
import { Sparkles, Terminal, Activity, Layers, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onLoadDemo: () => void;
  settings: AppSettings | null;
  isLoadingDemo: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onLoadDemo,
  settings,
  isLoadingDemo,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-950/40 bg-slate-950/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Terminal className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
              TestPilot AI
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
              v1.0 MVP
            </span>
          </div>
          <p className="text-xs text-slate-400">RAG Test Generation & Code Correction</p>
        </div>
      </div>

      {/* Middle: Active Project Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-400">Project:</span>
          {projects.length > 0 ? (
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name} ({p.language})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-500">No project loaded</span>
          )}
        </div>

        {/* Load Demo Project Action */}
        <button
          onClick={onLoadDemo}
          disabled={isLoadingDemo}
          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          title="Load pre-configured demo with intentional bug ready to test"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isLoadingDemo ? 'Loading Demo...' : 'Load Demo Project'}
        </button>
      </div>

      {/* Right: Engine Indicator & Health */}
      <div className="flex items-center gap-3">
        {/* Engine status badge */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono border bg-slate-900/90 border-slate-800 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {settings?.has_gemini
              ? 'Gemini 2.5 Live'
              : settings?.has_openai
              ? 'OpenAI GPT'
              : 'Deterministic AST Engine'}
          </span>
        </div>

        {/* API connection indicator */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Backend Healthy</span>
        </div>
      </div>
    </header>
  );
};
