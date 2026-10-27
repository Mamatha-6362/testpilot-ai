import os
import sys
import shutil
import tempfile
import subprocess
import time
import re
from pathlib import Path
from typing import Dict, Any, List
from backend.app.config import settings

class TestResult:
    def __init__(
        self,
        test_name: str,
        status: str,
        duration: float = 0.0,
        error_category: str = "",
        expected_value: str = "",
        actual_value: str = "",
        explanation: str = "",
        traceback: str = "",
        source_file: str = "",
        source_line: int = 0
    ):
        self.test_name = test_name
        self.status = status # passed, failed, error, skipped
        self.duration = duration
        self.error_category = error_category
        self.expected_value = expected_value
        self.actual_value = actual_value
        self.explanation = explanation
        self.traceback = traceback
        self.source_file = source_file
        self.source_line = source_line

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "status": self.status,
            "duration": self.duration,
            "error_category": self.error_category,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "explanation": self.explanation,
            "traceback": self.traceback,
            "source_file": self.source_file,
            "source_line": self.source_line
        }

class PytestRunner:
    def __init__(self, timeout_seconds: int = 30):
        self.timeout_seconds = timeout_seconds

    def run_tests(self, project_path: Path, specific_test: str = None) -> Dict[str, Any]:
        """
        Executes pytest in an isolated temporary directory copy.
        Returns execution summary and parsed test results.
        """
        if not project_path.exists():
            return {
                "status": "error",
                "passed_count": 0,
                "failed_count": 0,
                "error_count": 1,
                "skipped_count": 0,
                "total_count": 1,
                "duration_seconds": 0.0,
                "stdout": "",
                "stderr": f"Project directory {project_path} does not exist.",
                "results": []
            }

        # Check if tests directory or any test_*.py files exist
        has_tests = False
        for root, _, files in os.walk(project_path):
            if any(f.startswith("test_") and f.endswith(".py") or f.endswith("_test.py") for f in files):
                has_tests = True
                break

        if not has_tests:
            return {
                "status": "error",
                "passed_count": 0,
                "failed_count": 0,
                "error_count": 1,
                "skipped_count": 0,
                "total_count": 1,
                "duration_seconds": 0.0,
                "stdout": "",
                "stderr": "No test files (test_*.py) found in project. Please generate or upload tests first.",
                "results": []
            }

        start_time = time.time()
        
        # Run pytest in an isolated temporary workspace
        with tempfile.TemporaryDirectory(prefix="testpilot_run_") as tmp_dir:
            temp_project_path = Path(tmp_dir) / "project"
            shutil.copytree(
                project_path,
                temp_project_path,
                ignore=shutil.ignore_patterns(".git", "venv", "__pycache__", ".pytest_cache")
            )

            # Determine python executable
            python_executable = sys.executable or "python"

            cmd = [python_executable, "-m", "pytest", "-v", "--tb=short", "-rA"]
            if specific_test:
                cmd.append("-k")
                cmd.append(specific_test)

            env = os.environ.copy()
            # Set PYTHONPATH so project modules can be imported directly
            env["PYTHONPATH"] = str(temp_project_path)
            # Remove sensitive credentials from execution sandbox
            env.pop("GEMINI_API_KEY", None)
            env.pop("OPENAI_API_KEY", None)

            try:
                proc = subprocess.run(
                    cmd,
                    cwd=str(temp_project_path),
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    env=env
                )
                stdout = proc.stdout
                stderr = proc.stderr
                exit_code = proc.returncode
                duration = round(time.time() - start_time, 2)
                
                # Check for execution failure vs test failures
                # Pytest exit codes: 0 = all passed, 1 = tests failed, 2 = interrupted, 3 = internal error, 4 = usage error, 5 = no tests collected
                is_timeout = False
            except subprocess.TimeoutExpired as te:
                stdout = te.stdout or ""
                stderr = f"Execution timed out after {self.timeout_seconds} seconds."
                exit_code = 124
                duration = round(time.time() - start_time, 2)
                is_timeout = True
            except Exception as e:
                stdout = ""
                stderr = f"Failed to invoke test runner: {str(e)}"
                exit_code = 1
                duration = round(time.time() - start_time, 2)
                is_timeout = False

        # Parse test results from stdout
        results = self._parse_pytest_output(stdout, stderr)

        passed_count = sum(1 for r in results if r.status == "passed")
        failed_count = sum(1 for r in results if r.status == "failed")
        error_count = sum(1 for r in results if r.status == "error")
        skipped_count = sum(1 for r in results if r.status == "skipped")
        total_count = len(results)

        if is_timeout:
            status = "timed_out"
        elif total_count == 0 and exit_code != 0:
            status = "error"
        elif failed_count > 0 or error_count > 0:
            status = "failed"
        else:
            status = "passed"

        return {
            "status": status,
            "passed_count": passed_count,
            "failed_count": failed_count,
            "error_count": error_count,
            "skipped_count": skipped_count,
            "total_count": total_count,
            "duration_seconds": duration,
            "stdout": stdout,
            "stderr": stderr,
            "results": [r.to_dict() for r in results]
        }

    def _parse_pytest_output(self, stdout: str, stderr: str) -> List[TestResult]:
        results: List[TestResult] = []
        if not stdout:
            if stderr:
                results.append(TestResult(
                    test_name="runner_environment",
                    status="error",
                    error_category="Runner Error",
                    explanation=stderr.splitlines()[-1] if stderr.splitlines() else "Test runner failed to execute.",
                    traceback=stderr
                ))
            return results

        # 1. Match individual test outcome lines:
        # e.g.: tests/test_cart.py::test_discount_for_invalid_percentage FAILED
        # e.g.: tests/test_cart.py::test_normal_discount PASSED
        outcome_pattern = re.compile(
            r'^(.*?::([a-zA-Z0-9_]+(?:\[.*?\])?))\s+(PASSED|FAILED|ERROR|SKIPPED)',
            re.MULTILINE
        )

        test_outcomes = outcome_pattern.findall(stdout)
        
        # 2. Extract failure traceback sections
        # Pytest sections usually look like:
        # ____________________ test_discount_for_invalid_percentage ____________________
        failure_sections = {}
        section_pattern = re.compile(
            r'={3,}\s*(?:FAILURES|ERRORS)\s*={3,}(.*?)(?:={3,}\s*(?:short test summary|warnings summary)|\Z)',
            re.DOTALL
        )
        failures_block_match = section_pattern.search(stdout)
        if failures_block_match:
            failures_block = failures_block_match.group(1)
            # Split by ___________________ test_name ___________________
            sub_sections = re.split(r'_{3,}\s*([a-zA-Z0-9_]+(?:\[.*?\])?)\s*_{3,}', failures_block)
            if len(sub_sections) > 1:
                for i in range(1, len(sub_sections), 2):
                    t_name = sub_sections[i].strip()
                    t_body = sub_sections[i+1].strip() if i+1 < len(sub_sections) else ""
                    failure_sections[t_name] = t_body

        for full_id, test_name, status_str in test_outcomes:
            status = status_str.lower()
            
            traceback_text = ""
            error_cat = ""
            exp_val = ""
            act_val = ""
            explanation = ""
            source_file = ""
            source_line = 0

            if status in ["failed", "error"]:
                tb = failure_sections.get(test_name, "")
                if not tb:
                    # Try partial match
                    for k, v in failure_sections.items():
                        if test_name in k or k in test_name:
                            tb = v
                            break

                traceback_text = tb
                
                # Extract file and line: e.g. tests/test_cart.py:18: in test_discount_for_invalid_percentage
                file_line_match = re.search(r'([a-zA-Z0-9_\-\./\\]+\.py):(\d+):', tb)
                if file_line_match:
                    source_file = file_line_match.group(1).replace("\\", "/")
                    source_line = int(file_line_match.group(2))

                # Extract exception line: e.g. E   AssertionError: ... or E   ValueError: ...
                e_lines = [line[4:].strip() for line in tb.splitlines() if line.startswith("E   ") or line.startswith("E ")]
                e_summary = " ".join(e_lines) if e_lines else "Test failed assertion or raised unexpected exception"

                if "AssertionError" in e_summary:
                    error_cat = "Assertion Failure"
                elif "ValueError" in e_summary:
                    error_cat = "ValueError"
                elif "TypeError" in e_summary:
                    error_cat = "TypeError"
                elif "KeyError" in e_summary:
                    error_cat = "KeyError"
                elif "IndexError" in e_summary:
                    error_cat = "IndexError"
                elif "ZeroDivisionError" in e_summary:
                    error_cat = "ZeroDivisionError"
                else:
                    error_cat = "Application Exception"

                # Extract expected vs actual
                # e.g.: assert -50 > 0  or expected X but got Y or assert 120 == 80
                val_match = re.search(r'assert\s+(.*?)\s*(?:==|!=|>|<|>=|<=|in)\s*(.*)', e_summary)
                if val_match:
                    act_val = val_match.group(1).strip()
                    exp_val = val_match.group(2).strip()
                elif "DID NOT RAISE" in e_summary:
                    exp_val = "Expected exception to be raised"
                    act_val = "Function executed without raising required exception"
                else:
                    act_val = e_summary
                    exp_val = "Condition defined in requirement"

                explanation = f"{error_cat}: {e_summary}"

            results.append(TestResult(
                test_name=test_name,
                status=status,
                duration=0.01,
                error_category=error_cat,
                expected_value=exp_val,
                actual_value=act_val,
                explanation=explanation,
                traceback=traceback_text,
                source_file=source_file,
                source_line=source_line
            ))

        return results

test_runner = PytestRunner()
