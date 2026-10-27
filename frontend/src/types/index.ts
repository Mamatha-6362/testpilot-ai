export interface Project {
  id: string;
  name: string;
  language: string;
  description: string;
  root_path: string;
  indexed_at?: string;
  file_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  size: number;
  is_test: boolean;
}

export interface Requirement {
  id: string;
  project_id: string;
  content: string;
  source_type: string;
  created_at: string;
}

export interface RagChunk {
  id?: string;
  project_id?: string;
  file_path: string;
  start_line: number;
  end_line: number;
  content: string;
  score?: number;
  is_filtered?: boolean;
  filter_reason?: string;
  created_at?: string;
}

export interface RagIndexStatus {
  project_id: string;
  indexed_chunks: number;
  filtered_chunks: number;
  total_files: number;
  indexed_at: string;
  cleaning_logs: string[];
}

export interface TestCase {
  id: string;
  project_id: string;
  test_uid: string;
  title: string;
  objective: string;
  type: 'positive' | 'boundary' | 'negative' | 'exception' | 'regression';
  priority: 'high' | 'medium' | 'low';
  preconditions: string;
  steps: string;
  expected_result: string;
  test_code: string;
  rationale: string;
  confidence: number;
  evidence_snippets: RagChunk[];
  status: string;
  created_at: string;
}

export interface TestResult {
  id: string;
  run_id: string;
  project_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
  error_category: string;
  expected_value: string;
  actual_value: string;
  explanation: string;
  traceback: string;
  source_file: string;
  source_line: number;
  created_at: string;
}

export interface TestRun {
  id: string;
  project_id: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'timed_out';
  passed_count: number;
  failed_count: number;
  error_count: number;
  skipped_count: number;
  total_count: number;
  duration_seconds: number;
  stdout: string;
  stderr: string;
  run_type: 'initial' | 'verification';
  created_at: string;
  results: TestResult[];
}

export interface Patch {
  id: string;
  project_id: string;
  run_id?: string;
  title: string;
  root_cause_explanation: string;
  diff_content: string;
  target_file: string;
  status: 'pending' | 'applied' | 'rejected';
  backup_id?: string;
  created_at: string;
}

export interface EvaluationMetric {
  fraction: string;
  method: string;
  requirement_coverage_pct: number;
  valid_test_rate_pct: number;
  failure_localization_pct: number;
  patch_acceptance_pct: number;
  runs_count: number;
  notes: string;
}

export interface AppSettings {
  active_engine: string;
  provider_message: string;
  has_gemini: boolean;
  has_openai: boolean;
  pytest_timeout_seconds: number;
}
