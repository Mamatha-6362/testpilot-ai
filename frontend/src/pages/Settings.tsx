import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { api } from '../services/api';
import { Settings as SettingsIcon, Key, Clock, ShieldCheck, CheckCircle2, Cpu } from 'lucide-react';

interface SettingsProps {
  settings: AppSettings | null;
  onRefreshSettings: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onRefreshSettings }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTimeoutSeconds(settings.pytest_timeout_seconds || 30);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await api.updateSettings({
        gemini_api_key: geminiKey.trim() || undefined,
        openai_api_key: openaiKey.trim() || undefined,
        pytest_timeout_seconds: timeoutSeconds,
      });
      setSaveMessage('Settings updated successfully.');
      onRefreshSettings();
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="glass-panel p-6 space-y-2">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          System &amp; Engine Configuration
        </h1>
        <p className="text-xs text-slate-400">
          Configure LLM provider keys, execution timeouts, and execution sandbox parameters.
        </p>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-lg text-xs font-mono bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {saveMessage}
        </div>
      )}

      {/* Engine Status Card */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-200">Active AI Reasoning Engine</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 uppercase">
            {settings?.active_engine || 'Deterministic'}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {settings?.provider_message}
        </p>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* LLM Providers */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            LLM Provider Credentials (Optional)
          </h2>
          <p className="text-[11px] text-slate-400">
            If left blank, the application automatically uses the built-in Deterministic AST Engine which performs full offline test synthesis and patch generation without external API dependencies.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1">
                Google Gemini API Key (GEMINI_API_KEY)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={settings?.has_gemini ? '•••••••••••••••• (Configured)' : 'Enter Gemini API key...'}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1">
                OpenAI API Key (OPENAI_API_KEY)
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={settings?.has_openai ? '•••••••••••••••• (Configured)' : 'Enter OpenAI API key...'}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Sandbox & Security Settings */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Execution Sandbox Policy
          </h2>

          <div>
            <label className="text-xs font-mono text-slate-300 block mb-1">
              Pytest Process Timeout (Seconds)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(parseInt(e.target.value) || 30)}
              className="w-36 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
            />
            <span className="text-[11px] text-slate-500 block mt-1">
              Strict execution ceiling to terminate runaway or hanging test subprocesses.
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="btn-primary text-xs py-2 px-6">
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
