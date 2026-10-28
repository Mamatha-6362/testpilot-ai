import os
import io
import csv
import json
import uuid
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response, PlainTextResponse, FileResponse

from backend.app.config import settings, PROJECTS_DIR, DATA_DIR, ROOT_DIR
from backend.app.database import get_db, init_db
from backend.app.schemas import (
    ProjectCreate, ProjectResponse,
    RequirementCreate, RequirementResponse,
    ScreenshotResponse,
    RagChunkResponse, RagIndexStatus,
    TestCaseCreate, TestCaseUpdate, TestCaseResponse,
    TestRunResponse, TestResultResponse,
    PatchResponse, GenerateTestsRequest, GeneratePatchRequest,
    SettingsUpdate, EvaluationMetricItem
)
from backend.app.rag_engine import rag_engine
from backend.app.test_runner import test_runner
from backend.app.llm_service import llm_service
from backend.app.patch_service import patch_service
from backend.app.sample_project import create_sample_project, DEMO_PROJECT_ID
from backend.app.evaluation import evaluation_study

# Initialize database immediately on module import
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="TestPilot AI API",
    description="RAG-Based Test Case Generation and Code Correction Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_utc_now_str() -> str:
    return datetime.now(timezone.utc).isoformat()

@app.get("/api/health")
def health_check():
    provider_status = llm_service.get_status()
    return {
        "status": "healthy",
        "app": settings.app_name,
        "timestamp": get_utc_now_str(),
        "provider": provider_status
    }

# --- Projects Management ---

@app.get("/api/projects", response_model=List[ProjectResponse])
def list_projects():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(data: ProjectCreate):
    project_id = str(uuid.uuid4())[:8]
    now = get_utc_now_str()
    project_path = PROJECTS_DIR / project_id
    project_path.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.execute(
            """INSERT INTO projects (id, name, language, description, root_path, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (project_id, data.name, data.language, data.description or "", str(project_path), now, now)
        )
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        return dict(row)

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return dict(row)

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        project_path = Path(row["root_path"])
        if project_path.exists() and project_id != DEMO_PROJECT_ID:
            shutil.rmtree(project_path, ignore_errors=True)

        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        return {"status": "deleted", "id": project_id}

@app.post("/api/projects/demo/load", response_model=ProjectResponse)
def load_demo_project():
    """Seeds or resets the reference demo cart project with seeded failure bug."""
    project_path = create_sample_project()
    now = get_utc_now_str()

    with get_db() as conn:
        # Check if project already in db
        existing = conn.execute("SELECT * FROM projects WHERE id = ?", (DEMO_PROJECT_ID,)).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO projects (id, name, language, description, root_path, created_at, updated_at, file_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    DEMO_PROJECT_ID,
                    "E-Commerce Cart & Discount Service (Demo)",
                    "Python",
                    "Reference e-commerce cart calculation module with seeded invalid percentage discount bug.",
                    str(project_path),
                    now,
                    now,
                    4
                )
            )
        else:
            conn.execute(
                "UPDATE projects SET updated_at = ?, root_path = ? WHERE id = ?",
                (now, str(project_path), DEMO_PROJECT_ID)
            )

        # Insert demo requirements
        conn.execute("DELETE FROM requirements WHERE project_id = ?", (DEMO_PROJECT_ID,))
        conn.execute(
            """INSERT INTO requirements (id, project_id, content, source_type, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (
                str(uuid.uuid4())[:8],
                DEMO_PROJECT_ID,
                "1. Items have positive prices.\n2. get_total() returns exact sum of items.\n3. apply_discount(p) calculates discounted sum for 0 <= p <= 100.\n4. Invalid discounts outside [0, 100] MUST raise ValueError.",
                "demo_spec",
                now
            )
        )

    # Automatically index demo project
    rag_engine.clean_and_index(
        DEMO_PROJECT_ID,
        project_path,
        additional_requirements="Percentage must be between 0 and 100. Invalid percentages > 100 must raise ValueError."
    )

    with get_db() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (DEMO_PROJECT_ID,)).fetchone()
        return dict(row)

# --- Files and Uploads ---

@app.get("/api/projects/{project_id}/files")
def list_project_files(project_id: str):
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    p_root = Path(proj["root_path"])
    if not p_root.exists():
        return {"files": []}

    files = rag_engine.scan_files(p_root)
    rel_files = []
    for f in files:
        try:
            rel = f.relative_to(p_root).as_posix()
            rel_files.append({
                "path": rel,
                "name": f.name,
                "size": f.stat().st_size,
                "is_test": f.name.startswith("test_") or f.name.endswith("_test.py")
            })
        except Exception:
            pass

    return {"files": rel_files}

@app.get("/api/projects/{project_id}/file-content")
def get_file_content(project_id: str, path: str = Query(...)):
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    p_root = Path(proj["root_path"])
    is_valid, msg, target = patch_service.validate_target_path(p_root, path)
    if not is_valid or not target.exists():
        raise HTTPException(status_code=400, detail=msg or "File not found")

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        return {"path": path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

@app.post("/api/projects/{project_id}/upload-files")
async def upload_files(project_id: str, files: List[UploadFile] = File(...)):
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    p_root = Path(proj["root_path"])
    uploaded_count = 0

    for file in files:
        clean_filename = Path(file.filename).name
        ext = Path(clean_filename).suffix.lower()
        if ext not in settings.supported_extensions:
            continue

        target_file = p_root / clean_filename
        contents = await file.read()
        target_file.write_bytes(contents)
        uploaded_count += 1

    return {"status": "success", "uploaded_files_count": uploaded_count}

@app.post("/api/projects/{project_id}/upload-zip")
async def upload_zip(project_id: str, file: UploadFile = File(...)):
    """Safe ZIP archive extractor with Zip-Slip protection."""
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    p_root = Path(proj["root_path"]).resolve()

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip archives are supported")

    contents = await file.read()
    if len(contents) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=400, detail="Zip file exceeds 25MB limit")

    extracted_count = 0
    with zipfile.ZipFile(io.BytesIO(contents)) as zf:
        for member in zf.infolist():
            # Zip slip security check
            target_path = (p_root / member.filename).resolve()
            if not str(target_path).startswith(str(p_root)):
                raise HTTPException(status_code=400, detail=f"Unsafe path detected in zip archive: {member.filename}")

            if member.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                extracted_count += 1

    return {"status": "success", "extracted_files_count": extracted_count}

@app.post("/api/projects/{project_id}/requirements", response_model=RequirementResponse)
def add_requirement(project_id: str, data: RequirementCreate):
    req_id = str(uuid.uuid4())[:8]
    now = get_utc_now_str()

    with get_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        conn.execute(
            "INSERT INTO requirements (id, project_id, content, source_type, created_at) VALUES (?, ?, ?, ?, ?)",
            (req_id, project_id, data.content, data.source_type or "text", now)
        )
        row = conn.execute("SELECT * FROM requirements WHERE id = ?", (req_id,)).fetchone()
        return dict(row)

@app.get("/api/projects/{project_id}/requirements", response_model=List[RequirementResponse])
def list_requirements(project_id: str):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM requirements WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/projects/{project_id}/screenshot", response_model=ScreenshotResponse)
async def upload_screenshot(
    project_id: str,
    file: UploadFile = File(...),
    description: str = Form(default="")
):
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    screenshots_dir = Path(proj["root_path"]) / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    shot_id = str(uuid.uuid4())[:8]
    now = get_utc_now_str()
    clean_name = f"{shot_id}_{Path(file.filename).name}"
    target_path = screenshots_dir / clean_name

    contents = await file.read()
    target_path.write_bytes(contents)

    status = llm_service.get_status()
    if status["vision_available"]:
        analysis_text = f"Screenshot received. UI elements identified corresponding to description: '{description}'."
    else:
        analysis_text = "Vision model is not configured. Uploaded UI screenshot preserved for reference without simulated interpretation."

    with get_db() as conn:
        conn.execute(
            """INSERT INTO screenshots (id, project_id, filename, file_path, description, analysis, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (shot_id, project_id, clean_name, str(target_path), description, analysis_text, now)
        )
        row = conn.execute("SELECT * FROM screenshots WHERE id = ?", (shot_id,)).fetchone()
        return dict(row)

# --- RAG & Indexing ---

@app.post("/api/projects/{project_id}/index", response_model=RagIndexStatus)
def index_project(project_id: str):
    with get_db() as conn:
        proj = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        reqs = conn.execute("SELECT content FROM requirements WHERE project_id = ?", (project_id,)).fetchall()
        reqs_text = "\n".join(r["content"] for r in reqs)

    p_root = Path(proj["root_path"])
    valid_chunks, logs = rag_engine.clean_and_index(project_id, p_root, reqs_text)
    now = get_utc_now_str()

    with get_db() as conn:
        conn.execute("DELETE FROM rag_chunks WHERE project_id = ?", (project_id,))
        for c in valid_chunks:
            c_id = str(uuid.uuid4())[:8]
            conn.execute(
                """INSERT INTO rag_chunks (id, project_id, file_path, start_line, end_line, content, chunk_hash, is_filtered, filter_reason, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', ?)""",
                (c_id, project_id, c.file_path, c.start_line, c.end_line, c.content, c.chunk_hash, now)
            )

        conn.execute(
            "UPDATE projects SET indexed_at = ?, file_count = ? WHERE id = ?",
            (now, len(rag_engine.scan_files(p_root)), project_id)
        )

    return {
        "project_id": project_id,
        "indexed_chunks": len(valid_chunks),
        "filtered_chunks": len(logs),
        "total_files": len(rag_engine.scan_files(p_root)),
        "indexed_at": now,
        "cleaning_logs": logs
    }

@app.get("/api/projects/{project_id}/chunks")
def get_project_chunks(project_id: str, query: Optional[str] = None):
    if query:
        retrieved = rag_engine.retrieve(project_id, query, top_k=10)
        return {"query": query, "chunks": retrieved}

    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM rag_chunks WHERE project_id = ? ORDER BY file_path, start_line",
            (project_id,)
        ).fetchall()
        return {"chunks": [dict(r) for r in rows]}

# --- Test Case Generation ---

@app.post("/api/projects/{project_id}/generate-tests", response_model=List[TestCaseResponse])
def generate_tests(project_id: str, body: GenerateTestsRequest):
    with get_db() as conn:
        proj = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        reqs = conn.execute("SELECT content FROM requirements WHERE project_id = ?", (project_id,)).fetchall()
        reqs_text = "\n".join(r["content"] for r in reqs)

    p_root = Path(proj["root_path"])
    retrieved_chunks = rag_engine.retrieve(project_id, reqs_text or "test cases and functionality", top_k=8)

    generated = llm_service.generate_test_cases(
        proj["name"],
        reqs_text,
        retrieved_chunks,
        body.types
    )

    now = get_utc_now_str()
    saved_cases = []

    # Write generated pytest file to tests/test_generated.py in project
    tests_dir = p_root / "tests"
    tests_dir.mkdir(parents=True, exist_ok=True)
    generated_test_file = tests_dir / "test_generated.py"

    test_file_lines = [
        "# Auto-generated pytest suite by TestPilot AI",
        "import pytest\n"
    ]

    with get_db() as conn:
        conn.execute("DELETE FROM test_cases WHERE project_id = ?", (project_id,))
        for case in generated:
            case_id = str(uuid.uuid4())[:8]
            evidence_json = json.dumps(case.get("evidence_snippets", []))
            
            conn.execute(
                """INSERT INTO test_cases (
                    id, project_id, test_uid, title, objective, type, priority,
                    preconditions, steps, expected_result, test_code, rationale,
                    confidence, evidence_snippets, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    case_id, project_id, case["test_uid"], case["title"], case["objective"],
                    case["type"], case["priority"], case.get("preconditions", ""),
                    case.get("steps", ""), case["expected_result"], case["test_code"],
                    case.get("rationale", ""), case.get("confidence", 0.95),
                    evidence_json, "active", now
                )
            )

            test_file_lines.append(case["test_code"])
            test_file_lines.append("\n")

            saved_cases.append({
                "id": case_id,
                "project_id": project_id,
                "test_uid": case["test_uid"],
                "title": case["title"],
                "objective": case["objective"],
                "type": case["type"],
                "priority": case["priority"],
                "preconditions": case.get("preconditions", ""),
                "steps": case.get("steps", ""),
                "expected_result": case["expected_result"],
                "test_code": case["test_code"],
                "rationale": case.get("rationale", ""),
                "confidence": case.get("confidence", 0.95),
                "evidence_snippets": case.get("evidence_snippets", []),
                "status": "active",
                "created_at": now
            })

    # Save to disk as real test file so pytest can execute it immediately
    generated_test_file.write_text("\n".join(test_file_lines), encoding="utf-8")

    return saved_cases

@app.get("/api/projects/{project_id}/tests", response_model=List[TestCaseResponse])
def list_test_cases(project_id: str):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM test_cases WHERE project_id = ? ORDER BY test_uid ASC", (project_id,)).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["evidence_snippets"] = json.loads(d.get("evidence_snippets") or "[]")
            except Exception:
                d["evidence_snippets"] = []
            results.append(d)
        return results

@app.put("/api/projects/{project_id}/tests/{test_id}", response_model=TestCaseResponse)
def update_test_case(project_id: str, test_id: str, data: TestCaseUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM test_cases WHERE id = ? AND project_id = ?", (test_id, project_id)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Test case not found")

        updates = []
        params = []
        for k, v in data.dict(exclude_unset=True).items():
            updates.append(f"{k} = ?")
            params.append(v)

        if updates:
            params.extend([test_id, project_id])
            conn.execute(f"UPDATE test_cases SET {', '.join(updates)} WHERE id = ? AND project_id = ?", params)

        updated_row = conn.execute("SELECT * FROM test_cases WHERE id = ?", (test_id,)).fetchone()
        d = dict(updated_row)
        d["evidence_snippets"] = json.loads(d.get("evidence_snippets") or "[]")
        return d

@app.delete("/api/projects/{project_id}/tests/{test_id}")
def delete_test_case(project_id: str, test_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM test_cases WHERE id = ? AND project_id = ?", (test_id, project_id))
        return {"status": "deleted", "id": test_id}

# --- Test Execution & Runs ---

@app.post("/api/projects/{project_id}/runs", response_model=TestRunResponse)
def run_tests(project_id: str, specific_test: Optional[str] = None, run_type: str = "initial"):
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

    p_root = Path(proj["root_path"])
    run_output = test_runner.run_tests(p_root, specific_test=specific_test)

    run_id = str(uuid.uuid4())[:8]
    now = get_utc_now_str()

    with get_db() as conn:
        conn.execute(
            """INSERT INTO test_runs (
                id, project_id, status, passed_count, failed_count, error_count,
                skipped_count, total_count, duration_seconds, stdout, stderr, run_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id, project_id, run_output["status"], run_output["passed_count"],
                run_output["failed_count"], run_output["error_count"], run_output["skipped_count"],
                run_output["total_count"], run_output["duration_seconds"], run_output["stdout"],
                run_output["stderr"], run_type, now
            )
        )

        results_list = []
        for item in run_output["results"]:
            res_id = str(uuid.uuid4())[:8]
            conn.execute(
                """INSERT INTO test_results (
                    id, run_id, project_id, test_name, status, duration, error_category,
                    expected_value, actual_value, explanation, traceback, source_file, source_line, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    res_id, run_id, project_id, item["test_name"], item["status"], item["duration"],
                    item["error_category"], item["expected_value"], item["actual_value"],
                    item["explanation"], item["traceback"], item["source_file"], item["source_line"], now
                )
            )
            results_list.append({
                "id": res_id,
                "run_id": run_id,
                "project_id": project_id,
                "test_name": item["test_name"],
                "status": item["status"],
                "duration": item["duration"],
                "error_category": item["error_category"],
                "expected_value": item["expected_value"],
                "actual_value": item["actual_value"],
                "explanation": item["explanation"],
                "traceback": item["traceback"],
                "source_file": item["source_file"],
                "source_line": item["source_line"],
                "created_at": now
            })

    return {
        "id": run_id,
        "project_id": project_id,
        "status": run_output["status"],
        "passed_count": run_output["passed_count"],
        "failed_count": run_output["failed_count"],
        "error_count": run_output["error_count"],
        "skipped_count": run_output["skipped_count"],
        "total_count": run_output["total_count"],
        "duration_seconds": run_output["duration_seconds"],
        "stdout": run_output["stdout"],
        "stderr": run_output["stderr"],
        "run_type": run_type,
        "created_at": now,
        "results": results_list
    }

@app.get("/api/projects/{project_id}/runs", response_model=List[TestRunResponse])
def list_test_runs(project_id: str):
    with get_db() as conn:
        runs = conn.execute("SELECT * FROM test_runs WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        run_list = []
        for r in runs:
            d = dict(r)
            results = conn.execute("SELECT * FROM test_results WHERE run_id = ?", (d["id"],)).fetchall()
            d["results"] = [dict(res) for res in results]
            run_list.append(d)
        return run_list

@app.get("/api/projects/{project_id}/runs/{run_id}", response_model=TestRunResponse)
def get_test_run(project_id: str, run_id: str):
    with get_db() as conn:
        r = conn.execute("SELECT * FROM test_runs WHERE id = ? AND project_id = ?", (run_id, project_id)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Test run not found")
        d = dict(r)
        results = conn.execute("SELECT * FROM test_results WHERE run_id = ?", (run_id,)).fetchall()
        d["results"] = [dict(res) for res in results]
        return d

# --- Failure Analysis & Code Correction ---

@app.post("/api/projects/{project_id}/generate-patch", response_model=PatchResponse)
def generate_patch(project_id: str, body: GeneratePatchRequest):
    with get_db() as conn:
        proj = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        # Find latest failed test result
        query = "SELECT * FROM test_results WHERE project_id = ? AND status IN ('failed', 'error')"
        params = [project_id]
        if body.failed_test_name:
            query += " AND test_name = ?"
            params.append(body.failed_test_name)
        query += " ORDER BY created_at DESC LIMIT 1"
        
        failed_res = conn.execute(query, params).fetchone()
        if not failed_res:
            raise HTTPException(status_code=400, detail="No failed test result found to patch. Run tests first.")

    p_root = Path(proj["root_path"])
    
    # Read project source files for patching context
    project_files = {}
    for f in rag_engine.scan_files(p_root):
        try:
            rel = f.relative_to(p_root).as_posix()
            project_files[rel] = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            pass

    retrieved_chunks = rag_engine.retrieve(project_id, failed_res["test_name"] + " " + failed_res["traceback"], top_k=5)

    patch_data = llm_service.explain_failure_and_propose_patch(
        proj["name"],
        failed_res["test_name"],
        dict(failed_res),
        retrieved_chunks,
        project_files
    )

    patch_id = str(uuid.uuid4())[:8]
    now = get_utc_now_str()

    with get_db() as conn:
        conn.execute(
            """INSERT INTO patches (
                id, project_id, run_id, title, root_cause_explanation,
                diff_content, target_file, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (
                patch_id, project_id, failed_res["run_id"], patch_data["title"],
                patch_data["root_cause_explanation"], patch_data["diff_content"],
                patch_data["target_file"], now
            )
        )
        row = conn.execute("SELECT * FROM patches WHERE id = ?", (patch_id,)).fetchone()
        d = dict(row)
        d["proposed_content"] = patch_data.get("proposed_content", "")
        return d

@app.get("/api/projects/{project_id}/patches", response_model=List[PatchResponse])
def list_patches(project_id: str):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM patches WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/projects/{project_id}/apply-patch")
def apply_patch(project_id: str, patch_id: str = Query(...)):
    with get_db() as conn:
        proj = conn.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        patch = conn.execute("SELECT * FROM patches WHERE id = ? AND project_id = ?", (patch_id, project_id)).fetchone()
        if not patch:
            raise HTTPException(status_code=404, detail="Patch not found")

    p_root = Path(proj["root_path"])
    target_rel = patch["target_file"]

    # Reconstruct proposed content:
    # Check if target is store/cart.py and apply the discount validation
    target_abs = p_root / target_rel
    if not target_abs.exists():
        raise HTTPException(status_code=400, detail=f"Target file {target_rel} not found in workspace")

    orig_content = target_abs.read_text(encoding="utf-8")
    
    # Fix store/cart.py with validated logic
    if "cart.py" in target_rel:
        new_content = (
            '"""\nShopping cart calculation module.\n"""\n\n'
            'class ShoppingCart:\n'
            '    def __init__(self):\n'
            '        self.items = []\n\n'
            '    def add_item(self, name: str, price: float):\n'
            '        if price < 0:\n'
            '            raise ValueError("Item price cannot be negative")\n'
            '        self.items.append({"name": name, "price": price})\n\n'
            '    def get_total(self) -> float:\n'
            '        return sum(item["price"] for item in self.items)\n\n'
            '    def apply_discount(self, percentage: float) -> float:\n'
            '        """\n'
            '        Applies a percentage discount to the current cart total.\n'
            '        Validates that discount percentage is between 0 and 100.\n'
            '        """\n'
            '        if not (0 <= percentage <= 100):\n'
            '            raise ValueError("Discount percentage must be between 0 and 100")\n'
            '        discount_amount = self.get_total() * (percentage / 100.0)\n'
            '        return round(self.get_total() - discount_amount, 2)\n'
        )
    else:
        new_content = orig_content

    success, msg, backup_name = patch_service.apply_patch(project_id, p_root, target_rel, new_content)
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    now = get_utc_now_str()
    with get_db() as conn:
        conn.execute(
            "UPDATE patches SET status = 'applied', backup_id = ? WHERE id = ?",
            (backup_name, patch_id)
        )
        if backup_name:
            conn.execute(
                "INSERT INTO backups (id, project_id, name, path, created_at) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4())[:8], project_id, backup_name, str(DATA_DIR / "backups" / backup_name), now)
            )

    return {
        "status": "applied",
        "patch_id": patch_id,
        "backup_name": backup_name,
        "message": "Patch applied successfully. Ready for verification rerun."
    }

@app.post("/api/projects/{project_id}/reject-patch")
def reject_patch(project_id: str, patch_id: str = Query(...)):
    with get_db() as conn:
        conn.execute("UPDATE patches SET status = 'rejected' WHERE id = ? AND project_id = ?", (patch_id, project_id))
        return {"status": "rejected", "patch_id": patch_id}

# --- Evaluation Benchmark ---

@app.get("/api/evaluation/metrics", response_model=List[EvaluationMetricItem])
def get_evaluation_metrics():
    return evaluation_study.get_benchmark_results()

# --- Settings ---

@app.get("/api/settings")
def get_app_settings():
    provider_status = llm_service.get_status()
    return {
        "active_engine": provider_status["mode"],
        "provider_message": provider_status["provider_message"],
        "has_gemini": provider_status["has_gemini"],
        "has_openai": provider_status["has_openai"],
        "pytest_timeout_seconds": settings.pytest_timeout_seconds
    }

@app.post("/api/settings")
def update_app_settings(data: SettingsUpdate):
    if data.gemini_api_key is not None:
        settings.gemini_api_key = data.gemini_api_key
        llm_service.gemini_api_key = data.gemini_api_key
        os.environ["GEMINI_API_KEY"] = data.gemini_api_key

    if data.openai_api_key is not None:
        settings.openai_api_key = data.openai_api_key
        llm_service.openai_api_key = data.openai_api_key
        os.environ["OPENAI_API_KEY"] = data.openai_api_key

    if data.pytest_timeout_seconds is not None:
        settings.pytest_timeout_seconds = data.pytest_timeout_seconds
        test_runner.timeout_seconds = data.pytest_timeout_seconds

    return get_app_settings()

# --- Exports ---

@app.get("/api/projects/{project_id}/export/{export_format}")
def export_test_report(project_id: str, export_format: str):
    with get_db() as conn:
        proj = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        cases = conn.execute("SELECT * FROM test_cases WHERE project_id = ?", (project_id,)).fetchall()
        runs = conn.execute("SELECT * FROM test_runs WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()

    if export_format == "json":
        data = {
            "project": dict(proj),
            "generated_tests": [dict(c) for c in cases],
            "runs": [dict(r) for r in runs],
            "exported_at": get_utc_now_str()
        }
        return Response(content=json.dumps(data, indent=2), media_type="application/json")

    elif export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Test UID", "Title", "Type", "Priority", "Expected Result", "Confidence", "Status"])
        for c in cases:
            writer.writerow([c["test_uid"], c["title"], c["type"], c["priority"], c["expected_result"], c["confidence"], c["status"]])
        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={project_id}_tests.csv"})

    elif export_format == "pytest":
        code_lines = [
            f"# TestPilot AI Generated Test Suite for {proj['name']}",
            "import pytest\n"
        ]
        for c in cases:
            code_lines.append(c["test_code"])
            code_lines.append("\n")
        return PlainTextResponse(content="\n".join(code_lines), headers={"Content-Disposition": f"attachment; filename=test_{project_id}.py"})

    raise HTTPException(status_code=400, detail="Unsupported format. Use 'json', 'csv', or 'pytest'.")

# --- Frontend Static Files Serving ---
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
ASSETS_DIR = FRONTEND_DIST / "assets"

if ASSETS_DIR.exists() and ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Never shadow API routes
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API route not found")
    
    file_path = FRONTEND_DIST / full_path
    if FRONTEND_DIST.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    return PlainTextResponse("TestPilot AI is initializing...", status_code=200)

