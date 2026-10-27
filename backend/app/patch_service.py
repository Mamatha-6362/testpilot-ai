import os
import difflib
import shutil
import time
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from backend.app.config import BACKUPS_DIR

class PatchService:
    def validate_target_path(self, project_root: Path, relative_file_path: str) -> Tuple[bool, str, Optional[Path]]:
        """
        Strictly validates that the target file path is safe and inside the project workspace.
        Rejects directory traversal (../), absolute paths, and unauthorized extensions.
        """
        # Reject absolute paths
        if os.path.isabs(relative_file_path):
            return False, "Target path must not be absolute", None

        # Clean path
        clean_rel = os.path.normpath(relative_file_path).replace("\\", "/")
        if clean_rel.startswith("..") or "/../" in clean_rel:
            return False, "Path traversal sequence (..) is forbidden", None

        resolved_root = project_root.resolve()
        target_path = (project_root / clean_rel).resolve()

        try:
            # Must start with project root
            if not str(target_path).startswith(str(resolved_root)):
                return False, "Target path resolves outside project workspace", None
        except Exception as e:
            return False, f"Invalid path resolution: {str(e)}", None

        # Check allowed file extensions
        if target_path.suffix.lower() not in [".py", ".txt", ".md", ".json", ".yaml", ".yml", ".toml", ".ini"]:
            return False, f"File extension {target_path.suffix} is not editable", None

        return True, "Valid", target_path

    def generate_unified_diff(self, file_path_rel: str, original_content: str, proposed_content: str) -> str:
        """Generates a standard unified diff between original and proposed code."""
        orig_lines = original_content.splitlines(keepends=True)
        prop_lines = proposed_content.splitlines(keepends=True)
        
        diff = difflib.unified_diff(
            orig_lines,
            prop_lines,
            fromfile=f"a/{file_path_rel}",
            tofile=f"b/{file_path_rel}",
            lineterm=""
        )
        return "".join(diff)

    def create_backup(self, project_id: str, project_root: Path) -> Tuple[str, Path]:
        """Creates an atomic timestamped backup directory checkpoint before applying any patch."""
        timestamp = int(time.time())
        backup_name = f"backup_{project_id}_{timestamp}"
        backup_path = BACKUPS_DIR / backup_name
        
        shutil.copytree(
            project_root,
            backup_path,
            ignore=shutil.ignore_patterns(".git", "venv", "__pycache__", ".pytest_cache")
        )
        return backup_name, backup_path

    def apply_patch(
        self,
        project_id: str,
        project_root: Path,
        relative_file_path: str,
        new_content: str
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Validates target, creates a checkpoint backup, and updates the target file.
        Returns (success, message, backup_id).
        """
        is_valid, err_msg, target_path = self.validate_target_path(project_root, relative_file_path)
        if not is_valid or target_path is None:
            return False, f"Patch rejected: {err_msg}", None

        # Create backup checkpoint
        backup_name, backup_path = self.create_backup(project_id, project_root)

        try:
            # Ensure parent directories exist safely
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True, f"Patch successfully applied to {relative_file_path}", backup_name
        except Exception as e:
            # Rollback if write failed
            if backup_path.exists():
                shutil.rmtree(project_root)
                shutil.copytree(backup_path, project_root)
            return False, f"Failed to write patched content: {str(e)}", None

    def restore_backup(self, project_root: Path, backup_name: str) -> Tuple[bool, str]:
        """Restores a project from a specified backup checkpoint."""
        backup_path = BACKUPS_DIR / backup_name
        if not backup_path.exists():
            return False, f"Backup {backup_name} not found"

        try:
            for item in project_root.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

            for item in backup_path.iterdir():
                dest = project_root / item.name
                if item.is_dir():
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)

            return True, f"Project restored from {backup_name}"
        except Exception as e:
            return False, f"Restore failed: {str(e)}"

patch_service = PatchService()
