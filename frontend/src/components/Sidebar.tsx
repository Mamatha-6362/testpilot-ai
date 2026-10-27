import React from 'react';
import {
  LayoutDashboard,
  FolderCode,
  FileCode2,
  PlaySquare,
  AlertTriangle,
  BrainCircuit,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'projects'
  | 'generate'
  | 'runs'
  | 'failures'
  | 'rag'
  | 'evaluation'
  | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  failedCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, failedCount = 0 }) => {
  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects & Files', icon: <FolderCode className="w-4 h-4" /> },
    { id: 'generate', label: 'Generate Tests', icon: <FileCode2 className="w-4 h-4" /> },
    { id: 'runs', label: 'Test Execution', icon: <PlaySquare className="w-4 h-4" /> },
    {
      id: 'failures',
      label: 'Failure Analysis & Fix',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: failedCount,
    },
    { id: 'rag', label: 'RAG Context Explorer', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'evaluation', label: 'Evaluation & Benchmark', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/60 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3 py-2">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-cyan-400' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/70 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-between text-slate-300 font-semibold">
          <span>Python + Pytest MVP</span>
          <span className="text-emerald-400">Ready</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Strict sandbox &middot; No fake runs &middot; Checkpoint backups
        </p>
      </div>
    </aside>
  );
};
