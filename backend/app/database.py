import sqlite3
import json
from contextlib import contextmanager
from typing import Generator, Any
from backend.app.config import DATABASE_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'Python',
            description TEXT DEFAULT '',
            root_path TEXT NOT NULL,
            indexed_at TEXT,
            file_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requirements (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            content TEXT NOT NULL,
            source_type TEXT DEFAULT 'text',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS screenshots (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            description TEXT DEFAULT '',
            analysis TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS rag_chunks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            content TEXT NOT NULL,
            chunk_hash TEXT NOT NULL,
            is_filtered INTEGER DEFAULT 0,
            filter_reason TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            test_uid TEXT NOT NULL,
            title TEXT NOT NULL,
            objective TEXT NOT NULL,
            type TEXT NOT NULL,
            priority TEXT NOT NULL,
            preconditions TEXT DEFAULT '',
            steps TEXT DEFAULT '',
            expected_result TEXT NOT NULL,
            test_code TEXT NOT NULL,
            rationale TEXT DEFAULT '',
            confidence REAL DEFAULT 0.9,
            evidence_snippets TEXT DEFAULT '[]',
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS test_runs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            status TEXT NOT NULL,
            passed_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            skipped_count INTEGER DEFAULT 0,
            total_count INTEGER DEFAULT 0,
            duration_seconds REAL DEFAULT 0.0,
            stdout TEXT DEFAULT '',
            stderr TEXT DEFAULT '',
            run_type TEXT DEFAULT 'initial',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS test_results (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            test_name TEXT NOT NULL,
            status TEXT NOT NULL,
            duration REAL DEFAULT 0.0,
            error_category TEXT DEFAULT '',
            expected_value TEXT DEFAULT '',
            actual_value TEXT DEFAULT '',
            explanation TEXT DEFAULT '',
            traceback TEXT DEFAULT '',
            source_file TEXT DEFAULT '',
            source_line INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS patches (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            run_id TEXT,
            title TEXT NOT NULL,
            root_cause_explanation TEXT NOT NULL,
            diff_content TEXT NOT NULL,
            target_file TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            backup_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS backups (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
