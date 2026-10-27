import React, { useState } from 'react';
import { Project, TestCase } from '../types';
import { api } from '../services/api';
import {
  FileCode2,
  Sparkles,
  Download,
  Filter,
  CheckCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Search,
} from 'lucide-react';

interface TestGenerationProps {
  activeProject: Project | null;
  tests: TestCase[];
  onRefreshTests: () => void;
}

export const TestGeneration: React.FC<TestGenerationProps> = ({
  activeProject,
  tests,
  onRefreshTests,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    'positive',
    'boundary',
    'exception',
    'negative',
    'regression',
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleGenerate = async () => {
    if (!activeProject) {
      alert('Please select or load a project first');
      return;
    }
    try {
      setIsGenerating(true);
      await api.generateTests(activeProject.id, selectedTypes);
      onRefreshTests();
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTests = tests.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.objective.toLowerCase().includes(q) ||
        t.test_uid.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Generation Controller */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              RAG-Grounded Test Case Generation
            </h1>
            <p className="text-xs text-slate-400">
              Synthesize structured, traceable test cases grounded in indexed project AST & requirements.
            </p>
          </div>

          {/* Export Actions */}
          {activeProject && tests.length > 0 && (
            <div className="flex items-center gap-2">
              <a
                href={api.exportUrl(activeProject.id, 'json')}
                download
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> JSON
              </a>
              <a
                href={api.exportUrl(activeProject.id, 'csv')}
                download
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </a>
              <a
                href={api.exportUrl(activeProject.id, 'pytest')}
                download
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Pytest (.py)
              </a>
            </div>
          )}
        </div>

        {/* Test Type Selectors */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400 mr-2 font-mono">Include Categories:</span>
          {[
            { id: 'positive', label: 'Positive / Happy Path' },
            { id: 'boundary', label: 'Boundary / Limits' },
            { id: 'negative', label: 'Negative / Invalid' },
            { id: 'exception', label: 'Exception Handling' },
            { id: 'regression', label: 'Regression Invariants' },
          ].map((cat) => {
            const isChecked = selectedTypes.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleType(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  isChecked
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isChecked ? 'bg-cyan-400' : 'bg-slate-600'
                  }`}
                />
                {cat.label}
              </button>
            );
          })}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !activeProject}
            className="btn-primary text-xs py-2 px-5 ml-auto"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Synthesizing Tests...' : 'Generate Test Cases'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search generated tests..."
            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="positive">Positive</option>
              <option value="boundary">Boundary</option>
              <option value="negative">Negative</option>
              <option value="exception">Exception</option>
              <option value="regression">Regression</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Showing {filteredTests.length} of {tests.length}
          </span>
        </div>
      </div>

      {/* Test Cases Cards List */}
      {tests.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs glass-panel">
          No test cases generated yet. Click "Generate Test Cases" above to run RAG synthesis.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTests.map((test) => {
            const isExpanded = expandedTestId === test.id;
            return (
              <div
                key={test.id}
                className="glass-panel p-5 space-y-3 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                        {test.test_uid}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                          test.type === 'positive'
                            ? 'badge-glow-cyan'
                            : test.type === 'exception'
                            ? 'badge-glow-rose'
                            : test.type === 'boundary'
                            ? 'badge-glow-amber'
                            : 'badge-glow-emerald'
                        }`}
                      >
                        {test.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        Priority: <strong className="text-slate-300">{test.priority}</strong>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        Confidence: {Math.round(test.confidence * 100)}%
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white tracking-tight">{test.title}</h3>
                    <p className="text-xs text-slate-400">{test.objective}</p>
                  </div>

                  <button
                    onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    {isExpanded ? (
                      <>
                        Less <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        Details <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Expected Result & Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <div>
                    <span className="text-slate-500 font-mono block mb-1">Expected Outcome:</span>
                    <span className="text-slate-200 font-mono">{test.expected_result}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono block mb-1">Preconditions:</span>
                    <span className="text-slate-300">{test.preconditions || 'None required'}</span>
                  </div>
                </div>

                {/* Expanded Details: Test Code & Evidence */}
                {isExpanded && (
                  <div className="space-y-4 pt-3 border-t border-slate-800">
                    {/* Pytest Code Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                        <span>Pytest Executable Definition:</span>
                        <button
                          onClick={() => handleCopyCode(test.id, test.test_code)}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedId === test.id ? 'Copied!' : 'Copy Code'}
                        </button>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                        <pre>{test.test_code}</pre>
                      </div>
                    </div>

                    {/* Traceable Retrieved Context Evidence */}
                    {test.evidence_snippets && test.evidence_snippets.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                          Retrieved Source Evidence (Grounding Context):
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {test.evidence_snippets.map((ev, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono space-y-1"
                            >
                              <div className="flex items-center justify-between text-cyan-400">
                                <span>
                                  {ev.file_path} (Lines {ev.start_line}-{ev.end_line})
                                </span>
                              </div>
                              <pre className="text-slate-300 whitespace-pre-wrap">{ev.content}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
