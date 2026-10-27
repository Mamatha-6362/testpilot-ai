from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    language: str = Field(default="Python")
    description: Optional[str] = Field(default="")

class ProjectResponse(BaseModel):
    id: str
    name: str
    language: str
    description: str
    root_path: str
    indexed_at: Optional[str] = None
    file_count: int = 0
    created_at: str
    updated_at: str

class RequirementCreate(BaseModel):
    content: str = Field(..., min_length=1)
    source_type: Optional[str] = "text"

class RequirementResponse(BaseModel):
    id: str
    project_id: str
    content: str
    source_type: str
    created_at: str

class ScreenshotResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    file_path: str
    description: str
    analysis: str
    created_at: str

class RagChunkResponse(BaseModel):
    id: str
    project_id: str
    file_path: str
    start_line: int
    end_line: int
    content: str
    is_filtered: bool
    filter_reason: str
    created_at: str

class RagIndexStatus(BaseModel):
    project_id: str
    indexed_chunks: int
    filtered_chunks: int
    total_files: int
    indexed_at: str
    cleaning_logs: List[str] = []

class TestCaseBase(BaseModel):
    test_uid: str
    title: str
    objective: str
    type: str # positive, boundary, negative, exception, regression
    priority: str # high, medium, low
    preconditions: str = ""
    steps: str = ""
    expected_result: str
    test_code: str
    rationale: str = ""
    confidence: float = 0.95
    evidence_snippets: List[Dict[str, Any]] = []

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    objective: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    preconditions: Optional[str] = None
    steps: Optional[str] = None
    expected_result: Optional[str] = None
    test_code: Optional[str] = None
    status: Optional[str] = None

class TestCaseResponse(TestCaseBase):
    id: str
    project_id: str
    status: str
    created_at: str

class TestResultResponse(BaseModel):
    id: str
    run_id: str
    project_id: str
    test_name: str
    status: str # passed, failed, error, skipped
    duration: float
    error_category: str
    expected_value: str
    actual_value: str
    explanation: str
    traceback: str
    source_file: str
    source_line: int
    created_at: str

class TestRunResponse(BaseModel):
    id: str
    project_id: str
    status: str # queued, running, passed, failed, error, timed_out
    passed_count: int
    failed_count: int
    error_count: int
    skipped_count: int
    total_count: int
    duration_seconds: float
    stdout: str
    stderr: str
    run_type: str # initial, verification
    created_at: str
    results: List[TestResultResponse] = []

class PatchResponse(BaseModel):
    id: str
    project_id: str
    run_id: Optional[str]
    title: str
    root_cause_explanation: str
    diff_content: str
    target_file: str
    status: str # pending, applied, rejected
    backup_id: Optional[str]
    created_at: str

class GenerateTestsRequest(BaseModel):
    types: List[str] = ["positive", "boundary", "negative", "exception", "regression"]
    custom_instruction: Optional[str] = ""

class GeneratePatchRequest(BaseModel):
    failed_test_name: Optional[str] = None
    additional_guidance: Optional[str] = ""

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    pytest_timeout_seconds: Optional[int] = None
    active_engine: Optional[str] = None # "deterministic" or "gemini" or "openai"

class EvaluationMetricItem(BaseModel):
    fraction: str
    method: str
    requirement_coverage_pct: float
    valid_test_rate_pct: float
    failure_localization_pct: float
    patch_acceptance_pct: float
    runs_count: int
    notes: str
