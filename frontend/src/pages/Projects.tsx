import React, { useState, useEffect } from 'react';
import { Project, ProjectFile, Requirement } from '../types';
import { api } from '../services/api';
import {
  FolderPlus,
  Upload,
  FileCode,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Eye,
  X,
  FileArchive,
  Layers,
} from 'lucide-react';

interface ProjectsProps {
  activeProject: Project | null;
  projects: Project[];
  onSelectProject: (p: Project) => void;
  onRefreshProjects: () => void;
  onIndexProject: () => void;
  isIndexing: boolean;
}

export const Projects: React.FC<ProjectsProps> = ({
  activeProject,
  projects,
  onSelectProject,
  onRefreshProjects,
  onIndexProject,
  isIndexing,
}) => {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [newReqText, setNewReqText] = useState('');
  const [selectedFileContent, setSelectedFileContent] = useState<{ path: string; content: string } | null>(null);
  const [isViewingFile, setIsViewingFile] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [screenshotDesc, setScreenshotDesc] = useState('');
  const [screenshotMsg, setScreenshotMsg] = useState<string | null>(null);

  // Load project files and requirements when active project changes
  useEffect(() => {
    if (activeProject) {
      loadProjectData(activeProject.id);
    }
  }, [activeProject]);

  const loadProjectData = async (projectId: string) => {
    try {
      const filesRes = await api.getFiles(projectId);
      setFiles(filesRes.files || []);
      const reqsRes = await api.getRequirements(projectId);
      setRequirements(reqsRes || []);
    } catch (err) {
      console.error('Failed to load project details', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const created = await api.createProject({
        name: newProjectName,
        language: 'Python',
        description: newProjectDesc,
      });
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      onRefreshProjects();
      onSelectProject(created);
    } catch (err: any) {
      alert(`Error creating project: ${err.message}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.deleteProject(projectId);
      onRefreshProjects();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleUploadZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    try {
      setUploadMessage('Extracting archive safely...');
      const res = await api.uploadZip(activeProject.id, file);
      setUploadMessage(`Successfully extracted ${res.extracted_files_count} files into workspace!`);
      loadProjectData(activeProject.id);
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      setUploadMessage(`Upload failed: ${err.message}`);
    }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !e.target.files || e.target.files.length === 0) return;
    try {
      setUploadMessage('Uploading files...');
      const res = await api.uploadFiles(activeProject.id, e.target.files);
      setUploadMessage(`Uploaded ${res.uploaded_files_count} files.`);
      loadProjectData(activeProject.id);
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      setUploadMessage(`Upload failed: ${err.message}`);
    }
  };

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newReqText.trim()) return;
    try {
      await api.addRequirement(activeProject.id, newReqText.trim());
      setNewReqText('');
      const reqsRes = await api.getRequirements(activeProject.id);
      setRequirements(reqsRes || []);
    } catch (err: any) {
      alert(`Failed to save requirement: ${err.message}`);
    }
  };

  const handleUploadScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    try {
      setScreenshotMsg('Uploading and processing screenshot...');
      const res = await api.uploadScreenshot(activeProject.id, file, screenshotDesc);
      setScreenshotMsg(`Screenshot uploaded: ${res.analysis}`);
      setScreenshotDesc('');
      setTimeout(() => setScreenshotMsg(null), 6000);
    } catch (err: any) {
      setScreenshotMsg(`Screenshot upload failed: ${err.message}`);
    }
  };

  const handleViewFile = async (path: string) => {
    if (!activeProject) return;
    try {
      const data = await api.getFileContent(activeProject.id, path);
      setSelectedFileContent(data);
      setIsViewingFile(true);
    } catch (err: any) {
      alert(`Cannot open file: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Projects & Workspace Management
          </h1>
          <p className="text-xs text-slate-400">
            Manage project repositories, specifications, and uploaded files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4 text-cyan-400" />
            New Project
          </button>

          {activeProject && (
            <button
              onClick={onIndexProject}
              disabled={isIndexing}
              className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin' : ''}`} />
              {isIndexing ? 'Indexing...' : 'Index with RAG'}
            </button>
          )}
        </div>
      </div>

      {uploadMessage && (
        <div className="p-3 rounded-lg text-xs font-mono bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
          {uploadMessage}
        </div>
      )}

      {/* Main Grid: Left = Workspace & Files, Right = Requirements & Screenshots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Workspace Files (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-200">
                  Workspace Files ({files.length})
                </h2>
                <div className="text-xs text-slate-400">
                  Path: <span className="font-mono text-cyan-400">{activeProject?.root_path}</span>
                </div>
              </div>

              {/* Upload Dropdown / Buttons */}
              <div className="flex items-center gap-2">
                <label className="btn-secondary text-xs py-1.5 px-2.5 cursor-pointer flex items-center gap-1">
                  <FileArchive className="w-3.5 h-3.5 text-sky-400" />
                  Upload ZIP
                  <input type="file" accept=".zip" onChange={handleUploadZip} className="hidden" />
                </label>
                <label className="btn-secondary text-xs py-1.5 px-2.5 cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  Upload Files
                  <input
                    type="file"
                    multiple
                    accept=".py,.txt,.md,.json"
                    onChange={handleUploadFiles}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* File List */}
            {files.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
                No files in workspace yet. Click "Load Demo Project" or upload a ZIP file above.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 max-h-[380px] overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.path}
                    className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-900/40 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileCode
                        className={`w-4 h-4 shrink-0 ${
                          file.is_test ? 'text-amber-400' : 'text-cyan-400'
                        }`}
                      />
                      <span className="text-xs font-mono text-slate-200 truncate">
                        {file.path}
                      </span>
                      {file.is_test && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          test suite
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-slate-500">
                        {Math.round(file.size / 1024 * 10) / 10} KB
                      </span>
                      <button
                        onClick={() => handleViewFile(file.path)}
                        className="text-xs text-slate-400 hover:text-cyan-400 p-1"
                        title="View file content"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Requirements & Multimodal (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Requirements Box */}
          <div className="glass-panel p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Project Requirements & Spec
            </h2>

            <form onSubmit={handleAddRequirement} className="space-y-2">
              <textarea
                value={newReqText}
                onChange={(e) => setNewReqText(e.target.value)}
                placeholder="Enter requirements or constraints (e.g. 'Discounts must be between 0% and 100%. Greater values must raise ValueError')..."
                className="w-full h-24 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none font-mono"
              />
              <button type="submit" className="btn-primary text-xs py-1.5 px-3 w-full justify-center">
                Save Requirement
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto pt-2">
              {requirements.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap"
                >
                  {r.content}
                </div>
              ))}
            </div>
          </div>

          {/* Screenshot Upload Box */}
          <div className="glass-panel p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-400" />
              Multimodal Input (Optional UI Screenshot)
            </h2>
            <p className="text-[11px] text-slate-400">
              Upload UI screenshots to guide UI test-case generation. Vision model status is respected.
            </p>

            <input
              type="text"
              value={screenshotDesc}
              onChange={(e) => setScreenshotDesc(e.target.value)}
              placeholder="Description of UI view (e.g. Checkout page with discount code input)"
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
            />

            <label className="btn-secondary text-xs py-2 px-3 cursor-pointer w-full justify-center flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" />
              Select Screenshot Image
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadScreenshot}
                className="hidden"
              />
            </label>

            {screenshotMsg && (
              <div className="p-2 rounded text-[11px] font-mono bg-purple-950/40 border border-purple-800/40 text-purple-300">
                {screenshotMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Viewer Modal */}
      {isViewingFile && selectedFileContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-semibold">
                <FileCode className="w-4 h-4" />
                {selectedFileContent.path}
              </div>
              <button
                onClick={() => setIsViewingFile(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 font-mono text-xs text-slate-300 bg-slate-950">
              <pre>{selectedFileContent.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Create New Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Payment Gateway Service"
                  className="w-full p-2.5 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input
                  type="text"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Optional brief description"
                  className="w-full p-2.5 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-1.5 px-4">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
