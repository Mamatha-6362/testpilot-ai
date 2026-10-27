import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
DATA_DIR = ROOT_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
BACKUPS_DIR = DATA_DIR / "backups"
DATABASE_PATH = DATA_DIR / "testpilot.db"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    app_name: str = "TestPilot AI"
    host: str = "127.0.0.1"
    port: int = 8000
    database_url: str = f"sqlite:///{DATABASE_PATH.as_posix()}"
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    pytest_timeout_seconds: int = int(os.getenv("PYTEST_TIMEOUT_SECONDS", "30"))
    max_upload_size_bytes: int = 25 * 1024 * 1024  # 25 MB
    
    # Supported source code extensions
    supported_extensions: list[str] = [
        ".py", ".txt", ".md", ".json", ".yaml", ".yml", 
        ".toml", ".ini", ".cfg", ".rst", ".csv"
    ]
    
    # Ignored directories when indexing or parsing
    ignored_directories: list[str] = [
        ".git", ".svn", ".hg", "node_modules", "venv", ".venv", 
        "__pycache__", "build", "dist", ".pytest_cache", ".ruff_cache",
        ".mypy_cache", ".idea", ".vscode", ".tox"
    ]

settings = Settings()
