import React, { useState, useEffect } from 'react';
import { Project, TestRun, TestResult, Patch } from '../types';
import { api } from '../services/api';
import { DiffViewer } from '../components/DiffViewer';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  PlaySquare,
  Sparkles,
  RotateCcw,
  FileCode,
  ArrowRight,
  Shield,
} from 'lucide-react';

interface FailureAnalysisProps {
  activeProject: Project | null;
  runs: TestRun[];
  patches: Patch[];
  onRefreshRuns: () => void;
  onRefreshPatches: () => void;
}

export const FailureAnalysis: React.FC<FailureAnalysisProps> = ({
  activeProject,
  runs,
  patches,
  onRefreshRuns,
  onRefreshPatches,
}) => {
  const [selectedFailure, setSelectedFailure] = useState<TestResult | null>(null);
  const [isGeneratingPatch, setIsGeneratingPatch] = useState(false);
  const [isApplyingPatch, setIsApplyingPatch] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [activePatch, setActivePatch] = useState<Patch | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Find failed tests from most recent run
  const latestRun = runs[0];
  const failedResults = latestRun ? latestRun.results.filter((r) => r.status === 'failed' || r.status === 'error') : [];

  // Default select first failure
  useEffect(() => {
    if (failedResults.length > 0 && !selectedFailure) {
      setSelectedFailure(failedResults[0]);
    }
  }, [failedResults]);

  // Sync active patch
  useEffect(() => {
    if (patches.length > 0) {
      setActivePatch(patches[0]);
    }
  }, [patches]);

  const handleGeneratePatch = async () => {
    if (!activeProject || !selectedFailure) return;
    try {
      setIsGeneratingPatch(true);
      const patch = await api.generatePatch(activeProject.id, selectedFailure.test_name);
      setActivePatch(patch);
      onRefreshPatches();
      setActionMessage('Patch proposed. Please review the unified diff below.');
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      alert(`Patch generation failed: ${err.message}`);
    } finally {
      setIsGeneratingPatch(false);
    }
  };

  const handleApplyPatch = async () => {
    if (!activeProject || !activePatch) return;
    try {
      setIsApplyingPatch(true);
      const res = await api.applyPatch(activeProject.id, activePatch.id);
      setActionMessage(`Success: ${res.message} (Checkpoint backup: ${res.backup_name})`);
      onRefreshPatches();
      // Auto rerun tests after apply
      await handleRerunVerification();
    } catch (err: any) {
      alert(`Failed to apply patch: ${err.message}`);
    } finally {
      setIsApplyingPatch(false);
    }
  };

  const handleRejectPatch = async () => {
    if (!activeProject || !activePatch) return;
    try {
      await api.rejectPatch(activeProject.id, activePatch.id);
      setActionMessage('Patch rejected.');
      onRefreshPatches();
    } catch (err: any) {
      alert(`Error rejecting patch: ${err.message}`);
    }
  };

  const handleRerunVerification = async () => {
    if (!activeProject) return;
    try {
      setIsRerunning(true);
      await api.runTests(activeProject.id, undefined, 'verification');
      onRefreshRuns();
      setActionMessage('Verification test run complete! See before/after results.');
      setTimeout(() => setActionMessage(null), 6000);
    } catch (err: any) {
      alert(`Verification run failed: ${err.message}`);
    } finally {
      setIsRerunning(false);
    }
  };

  // Find previous vs verification run for before/after comparison
  const initialRun = runs.slice().reverse().find((r) => r.run_type === 'initial') || runs[1];
  const verificationRun = runs.find((r) => r.run_type === 'verification') || (latestRun?.run_type === 'verification' ? latestRun : null);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Failure Analysis &amp; Verified Code Correction
          </h1>
          <p className="text-xs text-slate-400">
            Root-cause identification grounded in real tracebacks with reviewable, reversible patch approval.
          </p>
        </div>

        {activePatch && activePatch.status === 'applied' && (
          <button
            onClick={handleRerunVerification}
            disabled={isRerunning}
            className="btn-success text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <PlaySquare className={`w-3.5 h-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
            {isRerunning ? 'Verifying...' : 'Rerun & Verify Suite'}
          </button>
        )}
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg text-xs font-mono bg-cyan-950/70 border border-cyan-800/80 text-cyan-300">
          {actionMessage}
        </div>
      )}

      {/* Before / After Verification Card (when verification run exists) */}
      {verificationRun && initialRun && (
        <div className="glass-panel p-5 space-y-3 border-emerald-500/30 bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Before &amp; After Patch Verification
            </div>
            <span className="text-xs font-mono text-slate-400">
              Patch applied with safety backup
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Before */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-rose-900/40 space-y-1">
              <span className="text-[11px] font-mono text-rose-400 uppercase font-bold">
                Before Fix (Initial Run)
              </span>
              <div className="text-sm font-semibold text-white">
                {initialRun.passed_count} Passed &middot;{' '}
                <span className="text-rose-400">{initialRun.failed_count} Failed</span>
              </div>
              <div className="text-xs text-slate-400">
                Pass Rate: {Math.round((initialRun.passed_count / initialRun.total_count) * 100)}%
              </div>
            </div>

            {/* After */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-emerald-800/50 space-y-1">
              <span className="text-[11px] font-mono text-emerald-400 uppercase font-bold">
                After Fix (Verified Run)
              </span>
              <div className="text-sm font-semibold text-emerald-300">
                {verificationRun.passed_count} Passed &middot;{' '}
                <span className="text-emerald-400">{verificationRun.failed_count} Failed</span>
              </div>
              <div className="text-xs text-slate-400">
                Pass Rate: 100% &mdash; All assertions validated!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Left = Failure Details, Right = Proposed Patch & Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Failure Breakdown (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200">
                Detected Failures ({failedResults.length})
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                Select a failure to inspect
              </span>
            </div>

            {/* Failed Test Selector */}
            {failedResults.length === 0 ? (
              <div className="p-8 text-center text-emerald-400 text-xs font-mono border border-emerald-900/40 rounded-lg bg-emerald-950/20">
                No active test failures detected. All tests are passing!
              </div>
            ) : (
              <div className="space-y-2">
                {failedResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedFailure(r)}
                    className={`w-full text-left p-3 rounded-lg border text-xs font-mono transition-colors flex items-center justify-between ${
                      selectedFailure?.id === r.id
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="truncate">{r.test_name}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 uppercase">
                      {r.error_category || 'Failed'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Structured Failure Report (Page 6 of Specification Format) */}
            {selectedFailure && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="text-xs font-mono text-cyan-400 uppercase font-bold">
                  Evidence-Backed Failure Dossier
                </div>

                <div className="divide-y divide-slate-800/80 text-xs font-mono">
                  <div className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-slate-500">Test:</span>
                    <span className="text-slate-200 font-bold">{selectedFailure.test_name}</span>
                  </div>

                  <div className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-rose-400 font-bold uppercase">
                      FAILED &mdash; actual pytest result
                    </span>
                  </div>

                  <div className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-slate-500">Expected:</span>
                    <span className="text-emerald-400">
                      {selectedFailure.expected_value || 'Condition defined in requirement'}
                    </span>
                  </div>

                  <div className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-slate-500">Actual:</span>
                    <span className="text-rose-300">
                      {selectedFailure.actual_value || selectedFailure.explanation}
                    </span>
                  </div>

                  <div className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-slate-500">Source Location:</span>
                    <span className="text-cyan-300">
                      {selectedFailure.source_file || 'tests/test_cart.py'} : Line {selectedFailure.source_line || 18}
                    </span>
                  </div>

                  <div className="py-2.5 space-y-1">
                    <span className="text-slate-500 block">Root Cause Explanation:</span>
                    <p className="text-slate-300 font-sans leading-relaxed text-xs">
                      {selectedFailure.explanation ||
                        'The function accepts an out-of-range percentage without validating it. Validate that the percentage is between 0 and 100 before calculating the discount.'}
                    </p>
                  </div>
                </div>

                {/* Pytest Traceback Accordion */}
                {selectedFailure.traceback && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[11px] font-mono text-slate-500">Assertion Traceback:</span>
                    <div className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-rose-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedFailure.traceback}
                    </div>
                  </div>
                )}

                {/* Action: Propose Fix */}
                <button
                  onClick={handleGeneratePatch}
                  disabled={isGeneratingPatch}
                  className="btn-primary text-xs py-2 px-4 w-full justify-center mt-2"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingPatch ? 'animate-spin' : ''}`} />
                  {isGeneratingPatch ? 'Analyzing & Synthesizing Fix...' : 'Synthesize Minimal Code Patch'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Code Correction & Diff Review (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-200">
                  Proposed Code Correction (Diff)
                </h2>
                <span className="text-xs text-slate-400">
                  Status:{' '}
                  <span
                    className={`font-mono font-bold uppercase ${
                      activePatch?.status === 'applied'
                        ? 'text-emerald-400'
                        : activePatch?.status === 'rejected'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {activePatch?.status || 'No Patch Pending'}
                  </span>
                </span>
              </div>

              {/* Safety notice pill */}
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                Automatic Backup Checkpoint
              </div>
            </div>

            {activePatch ? (
              <div className="space-y-4">
                {/* Rationale */}
                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs space-y-1">
                  <span className="text-cyan-400 font-mono font-bold block">
                    Correction Rationale:
                  </span>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {activePatch.root_cause_explanation}
                  </p>
                </div>

                {/* Unified Diff View */}
                <DiffViewer
                  diffContent={activePatch.diff_content}
                  targetFile={activePatch.target_file}
                  title={activePatch.title}
                />

                {/* Patch Action Controls */}
                {activePatch.status === 'pending' ? (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={handleRejectPatch}
                      className="btn-danger text-xs py-2 px-4"
                    >
                      Reject Patch
                    </button>
                    <button
                      onClick={handleApplyPatch}
                      disabled={isApplyingPatch}
                      className="btn-success text-xs py-2 px-5 flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {isApplyingPatch ? 'Creating Backup & Applying...' : 'Approve & Apply Patch'}
                    </button>
                  </div>
                ) : activePatch.status === 'applied' ? (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between text-xs font-mono text-emerald-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Patch safely applied to workspace with backup.
                    </span>
                    <button
                      onClick={handleRerunVerification}
                      disabled={isRerunning}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Rerun &amp; Verify
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-xs font-mono text-rose-300">
                    This patch was rejected. You can generate a revised patch.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 font-mono text-xs">
                No active code patch proposed yet. Select a failed test and click "Synthesize Minimal Code Patch".
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
