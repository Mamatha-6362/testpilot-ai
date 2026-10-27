import {
  Project,
  ProjectFile,
  Requirement,
  RagChunk,
  RagIndexStatus,
  TestCase,
  TestRun,
  Patch,
  EvaluationMetric,
  AppSettings
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(errorDetail || `HTTP Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; app: string; timestamp: string; provider: any }>('/health'),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (data: { name: string; language?: string; description?: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<{ status: string; id: string }>(`/projects/${id}`, { method: 'DELETE' }),
  loadDemoProject: () => request<Project>('/projects/demo/load', { method: 'POST' }),

  // Files & Uploads
  getFiles: (projectId: string) => request<{ files: ProjectFile[] }>(`/projects/${projectId}/files`),
  getFileContent: (projectId: string, path: string) =>
    request<{ path: string; content: string }>(`/projects/${projectId}/file-content?path=${encodeURIComponent(path)}`),
  uploadFiles: async (projectId: string, files: FileList | File[]) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    const res = await fetch(`${API_BASE}/projects/${projectId}/upload-files`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('File upload failed');
    return res.json();
  },
  uploadZip: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/projects/${projectId}/upload-zip`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('ZIP upload failed');
    return res.json();
  },

  // Requirements
  getRequirements: (projectId: string) => request<Requirement[]>(`/projects/${projectId}/requirements`),
  addRequirement: (projectId: string, content: string, sourceType = 'text') =>
    request<Requirement>(`/projects/${projectId}/requirements`, {
      method: 'POST',
      body: JSON.stringify({ content, source_type: sourceType }),
    }),

  // Screenshots
  uploadScreenshot: async (projectId: string, file: File, description = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    const res = await fetch(`${API_BASE}/projects/${projectId}/screenshot`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Screenshot upload failed');
    return res.json();
  },

  // RAG & Indexing
  indexProject: (projectId: string) =>
    request<RagIndexStatus>(`/projects/${projectId}/index`, { method: 'POST' }),
  getChunks: (projectId: string, query?: string) => {
    const url = query
      ? `/projects/${projectId}/chunks?query=${encodeURIComponent(query)}`
      : `/projects/${projectId}/chunks`;
    return request<{ chunks: RagChunk[]; query?: string }>(url);
  },

  // Test Cases
  generateTests: (projectId: string, types: string[] = ['positive', 'boundary', 'negative', 'exception', 'regression']) =>
    request<TestCase[]>(`/projects/${projectId}/generate-tests`, {
      method: 'POST',
      body: JSON.stringify({ types }),
    }),
  getTests: (projectId: string) => request<TestCase[]>(`/projects/${projectId}/tests`),
  updateTest: (projectId: string, testId: string, data: Partial<TestCase>) =>
    request<TestCase>(`/projects/${projectId}/tests/${testId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTest: (projectId: string, testId: string) =>
    request<{ status: string; id: string }>(`/projects/${projectId}/tests/${testId}`, {
      method: 'DELETE',
    }),

  // Test Runs
  runTests: (projectId: string, specificTest?: string, runType = 'initial') =>
    request<TestRun>(
      `/projects/${projectId}/runs?run_type=${runType}${specificTest ? `&specific_test=${encodeURIComponent(specificTest)}` : ''}`,
      { method: 'POST' }
    ),
  getRuns: (projectId: string) => request<TestRun[]>(`/projects/${projectId}/runs`),
  getRun: (projectId: string, runId: string) => request<TestRun>(`/projects/${projectId}/runs/${runId}`),

  // Patches
  generatePatch: (projectId: string, failedTestName?: string) =>
    request<Patch>(`/projects/${projectId}/generate-patch`, {
      method: 'POST',
      body: JSON.stringify({ failed_test_name: failedTestName }),
    }),
  getPatches: (projectId: string) => request<Patch[]>(`/projects/${projectId}/patches`),
  applyPatch: (projectId: string, patchId: string) =>
    request<{ status: string; patch_id: string; backup_name: string; message: string }>(
      `/projects/${projectId}/apply-patch?patch_id=${patchId}`,
      { method: 'POST' }
    ),
  rejectPatch: (projectId: string, patchId: string) =>
    request<{ status: string; patch_id: string }>(
      `/projects/${projectId}/reject-patch?patch_id=${patchId}`,
      { method: 'POST' }
    ),

  // Evaluation
  getEvaluationMetrics: () => request<EvaluationMetric[]>('/evaluation/metrics'),

  // Settings
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (data: Partial<AppSettings & { gemini_api_key?: string; openai_api_key?: string }>) =>
    request<AppSettings>('/settings', { method: 'POST', body: JSON.stringify(data) }),

  // Exports
  exportUrl: (projectId: string, format: 'json' | 'csv' | 'pytest') =>
    `${API_BASE}/projects/${projectId}/export/${format}`,
};
