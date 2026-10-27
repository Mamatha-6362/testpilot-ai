import os
import shutil
import tempfile
import zipfile
import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.config import settings, PROJECTS_DIR
from backend.app.rag_engine import rag_engine, RAGChunk
from backend.app.patch_service import patch_service
from backend.app.test_runner import test_runner
from backend.app.main import app
from backend.app.sample_project import create_sample_project, DEMO_PROJECT_ID

client = TestClient(app)

def test_rag_chunk_metadata_and_cleaning():
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        code_file = root / "calculator.py"
        code_file.write_text(
            "def add(a, b):\n    return a + b\n\ndef subtract(a, b):\n    return a - b\n",
            encoding="utf-8"
        )
        
        # Test scanning
        files = rag_engine.scan_files(root)
        assert len(files) == 1
        assert files[0].name == "calculator.py"
        
        # Test clean & index
        chunks, logs = rag_engine.clean_and_index("test_proj_1", root)
        assert len(chunks) >= 2
        for c in chunks:
            assert c.file_path == "calculator.py"
            assert c.start_line > 0
            assert c.end_line >= c.start_line
            assert len(c.content.strip()) > 0
            assert not c.is_filtered

        # Test duplicate filtering
        duplicate_chunk = RAGChunk("calculator.py", 1, 2, "def add(a, b):\n    return a + b")
        # Same hash
        retrieved = rag_engine.retrieve("test_proj_1", "add numbers", top_k=2)
        assert len(retrieved) > 0
        assert "add" in retrieved[0]["content"]

def test_zip_path_safety_and_file_validation():
    # 1. Path safety check
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        safe_path = root / "store" / "cart.py"
        unsafe_path = root / ".." / "escaped.py"
        
        assert rag_engine.is_safe_path(root, safe_path) is True
        assert rag_engine.is_safe_path(root, unsafe_path) is False

    # 2. File extension validation
    assert ".py" in settings.supported_extensions
    assert ".exe" not in settings.supported_extensions
    assert ".dll" not in settings.supported_extensions

def test_patch_path_safety_and_unified_diff():
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        test_file = root / "module.py"
        test_file.write_text("x = 10\n", encoding="utf-8")

        # Test traversal rejection
        is_valid, msg, _ = patch_service.validate_target_path(root, "../outside.py")
        assert is_valid is False
        assert "forbidden" in msg or "outside" in msg

        # Test absolute path rejection
        is_valid, msg, _ = patch_service.validate_target_path(root, "/etc/passwd")
        assert is_valid is False

        # Test valid path
        is_valid, msg, target = patch_service.validate_target_path(root, "module.py")
        assert is_valid is True
        assert target == test_file

        # Test unified diff generation
        diff = patch_service.generate_unified_diff("module.py", "x = 10\n", "x = 20\n")
        assert "-x = 10" in diff
        assert "+x = 20" in diff

def test_pytest_output_parser():
    mock_stdout = """
============================= test session starts =============================
tests/test_sample.py::test_passed_case PASSED                            [ 50%]
tests/test_sample.py::test_discount_for_invalid_percentage FAILED        [100%]

=================================== FAILURES ===================================
___________________ test_discount_for_invalid_percentage ___________________
tests/test_sample.py:18: in test_discount_for_invalid_percentage
    with pytest.raises(ValueError):
E   Failed: DID NOT RAISE <class 'ValueError'>
=========================== short test summary info ============================
FAILED tests/test_sample.py::test_discount_for_invalid_percentage
========================= 1 failed, 1 passed in 0.05s ==========================
"""
    results = test_runner._parse_pytest_output(mock_stdout, "")
    assert len(results) == 2
    
    passed_r = next(r for r in results if r.test_name == "test_passed_case")
    assert passed_r.status == "passed"

    failed_r = next(r for r in results if r.test_name == "test_discount_for_invalid_percentage")
    assert failed_r.status == "failed"
    assert "DID NOT RAISE" in failed_r.explanation
    assert failed_r.source_file == "tests/test_sample.py"
    assert failed_r.source_line == 18

def test_api_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "provider" in data

def test_full_demo_workflow_end_to_end():
    """
    Validates the full loop from spec:
    Load demo -> Index -> Generate Tests -> Run (fails) -> Propose Patch -> Apply -> Rerun (passes)
    """
    # 1. Load demo project
    res = client.post("/api/projects/demo/load")
    assert res.status_code == 200
    proj_data = res.json()
    assert proj_data["id"] == DEMO_PROJECT_ID

    # 2. Re-index
    res_index = client.post(f"/api/projects/{DEMO_PROJECT_ID}/index")
    assert res_index.status_code == 200
    index_data = res_index.json()
    assert index_data["indexed_chunks"] > 0

    # 3. Generate test cases
    res_gen = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/generate-tests",
        json={"types": ["positive", "boundary", "exception", "negative", "regression"]}
    )
    assert res_gen.status_code == 200
    cases = res_gen.json()
    assert len(cases) >= 4

    # 4. Run tests BEFORE fix - must fail on invalid percentage test
    res_run1 = client.post(f"/api/projects/{DEMO_PROJECT_ID}/runs")
    assert res_run1.status_code == 200
    run1 = res_run1.json()
    assert run1["total_count"] > 0
    # Must have failed tests because cart has the intentional bug!
    assert run1["failed_count"] >= 1
    assert run1["status"] == "failed"

    # 5. Generate patch
    res_patch = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/generate-patch",
        json={"failed_test_name": "test_discount_for_invalid_percentage"}
    )
    assert res_patch.status_code == 200
    patch = res_patch.json()
    assert "store/cart.py" in patch["target_file"]
    assert "diff_content" in patch
    assert patch["status"] == "pending"

    # 6. Apply patch
    res_apply = client.post(f"/api/projects/{DEMO_PROJECT_ID}/apply-patch?patch_id={patch['id']}")
    assert res_apply.status_code == 200
    apply_data = res_apply.json()
    assert apply_data["status"] == "applied"

    # 7. Rerun tests AFTER fix - must now pass 100%!
    res_run2 = client.post(f"/api/projects/{DEMO_PROJECT_ID}/runs?run_type=verification")
    assert res_run2.status_code == 200
    run2 = res_run2.json()
    assert run2["failed_count"] == 0
    assert run2["passed_count"] > 0
    assert run2["status"] == "passed"
