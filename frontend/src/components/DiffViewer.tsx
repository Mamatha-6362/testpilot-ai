import React from 'react';
import { FileCode, Check, AlertCircle } from 'lucide-react';

interface DiffViewerProps {
  diffContent: string;
  targetFile: string;
  title?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffContent, targetFile, title }) => {
  if (!diffContent) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm font-mono glass-panel">
        No diff content available.
      </div>
    );
  }

  const lines = diffContent.split('\n');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
      {/* Diff Header */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300 font-semibold">{targetFile}</span>
          {title && <span className="text-slate-500">&mdash; {title}</span>}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Addition
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Deletion
          </span>
        </div>
      </div>

      {/* Code diff lines */}
      <div className="p-2 font-mono text-xs overflow-x-auto leading-relaxed max-h-[460px] overflow-y-auto">
        {lines.map((line, idx) => {
          let lineClass = 'text-slate-400 hover:bg-slate-900/50';
          let prefix = ' ';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineClass = 'diff-line-add';
            prefix = '+';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineClass = 'diff-line-del';
            prefix = '-';
          } else if (line.startsWith('@@')) {
            lineClass = 'diff-line-info';
          } else if (line.startsWith('---') || line.startsWith('+++')) {
            lineClass = 'text-slate-500 font-semibold';
          }

          return (
            <div key={idx} className={`px-3 py-0.5 rounded flex items-center gap-3 ${lineClass}`}>
              <span className="select-none text-slate-600 w-8 text-right text-[10px]">
                {idx + 1}
              </span>
              <pre className="whitespace-pre-wrap flex-1">{line}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};
