import React, { useState, useEffect } from 'react';
import { Project, RagChunk } from '../types';
import { api } from '../services/api';
import {
  BrainCircuit,
  Search,
  Filter,
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';

interface RagExplorerProps {
  activeProject: Project | null;
}

export const RagExplorer: React.FC<RagExplorerProps> = ({ activeProject }) => {
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RagChunk[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeProject) {
      loadChunks(activeProject.id);
    }
  }, [activeProject]);

  const loadChunks = async (projectId: string) => {
    try {
      setIsLoading(true);
      const res = await api.getChunks(projectId);
      setChunks(res.chunks || []);
    } catch (err) {
      console.error('Failed to load chunks', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !searchQuery.trim()) return;
    try {
      setIsSearching(true);
      const res = await api.getChunks(activeProject.id, searchQuery.trim());
      setSearchResults(res.chunks || []);
    } catch (err: any) {
      alert(`Query failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-panel p-6 space-y-2">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-cyan-400" />
          RAG Context &amp; Data Cleaning Explorer
        </h1>
        <p className="text-xs text-slate-400">
          Inspect indexed code chunks, line-level traceability metadata, and query the vector retrieval engine in real time.
        </p>
      </div>

      {/* Semantic Query Sandbox */}
      <div className="glass-panel p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" />
          Test Retrieval Query
        </h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a query or requirement (e.g. 'discount percentage boundary validation' or 'cart sum')..."
            className="flex-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={isSearching || !activeProject}
            className="btn-primary text-xs py-2 px-5 shrink-0"
          >
            {isSearching ? 'Retrieving...' : 'Run Query'}
          </button>
        </form>

        {/* Query Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="text-xs font-mono text-cyan-400 font-bold">
              Top Retrieved Context Chunks ({searchResults.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950 border border-cyan-800/40 text-xs font-mono space-y-1.5"
                >
                  <div className="flex items-center justify-between text-cyan-300">
                    <span className="font-bold">{item.file_path}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      Score: {item.score ?? '0.90'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Lines {item.start_line} &ndash; {item.end_line}
                  </div>
                  <pre className="text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap bg-slate-900/60 p-2 rounded">
                    {item.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indexed Chunks Inspector */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              Indexed Code Chunks ({chunks.length})
            </h2>
            <div className="text-xs text-slate-400">
              Preserving exact line metadata &amp; hash traceability.
            </div>
          </div>
        </div>

        {chunks.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            {isLoading ? 'Loading chunks...' : 'No chunks indexed. Click "Index with RAG" in Projects view.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chunks.map((chunk) => (
              <div
                key={chunk.id || `${chunk.file_path}-${chunk.start_line}`}
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-cyan-400 font-semibold mb-1">
                    <span className="truncate">{chunk.file_path}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mb-2">
                    Lines {chunk.start_line} to {chunk.end_line}
                  </div>
                  <pre className="text-slate-300 text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    {chunk.content}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
