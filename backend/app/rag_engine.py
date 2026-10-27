import os
import re
import ast
import math
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Tuple
from backend.app.config import settings

class RAGChunk:
    def __init__(self, file_path: str, start_line: int, end_line: int, content: str, is_filtered: bool = False, filter_reason: str = ""):
        self.file_path = file_path
        self.start_line = start_line
        self.end_line = end_line
        self.content = content
        self.chunk_hash = hashlib.md5(content.strip().encode('utf-8')).hexdigest()
        self.is_filtered = is_filtered
        self.filter_reason = filter_reason

class RAGEngine:
    def __init__(self):
        # Index storage per project: {project_id: List[RAGChunk]}
        self.project_indices: Dict[str, List[RAGChunk]] = {}
        self.idf_vocab: Dict[str, Dict[str, float]] = {}

    def is_safe_path(self, base_dir: Path, target_path: Path) -> bool:
        """Prevent path traversal vulnerabilities."""
        try:
            resolved_target = target_path.resolve()
            resolved_base = base_dir.resolve()
            return str(resolved_target).startswith(str(resolved_base))
        except Exception:
            return False

    def scan_files(self, project_root: Path) -> List[Path]:
        """Scan project files while strictly ignoring non-source/generated folders."""
        valid_files = []
        for root, dirs, files in os.walk(project_root):
            # Modify dirs in-place to avoid descending into ignored directories
            dirs[:] = [d for d in dirs if d not in settings.ignored_directories and not d.startswith('.')]
            
            for f in files:
                ext = Path(f).suffix.lower()
                if ext in settings.supported_extensions:
                    full_path = Path(root) / f
                    if self.is_safe_path(project_root, full_path):
                        valid_files.append(full_path)
        return valid_files

    def chunk_python_file(self, file_path: Path, rel_path: str, content: str) -> List[RAGChunk]:
        """AST-assisted chunking for Python files preserving exact line ranges."""
        chunks = []
        lines = content.splitlines()
        total_lines = len(lines)
        if total_lines == 0:
            return chunks

        try:
            tree = ast.parse(content, filename=str(file_path))
            # Extract functions and classes
            top_level_nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
            
            if top_level_nodes:
                for node in top_level_nodes:
                    start_line = node.lineno
                    end_line = getattr(node, 'end_lineno', start_line)
                    node_lines = lines[start_line - 1:end_line]
                    chunk_text = "\n".join(node_lines)
                    chunks.append(RAGChunk(rel_path, start_line, end_line, chunk_text))
            else:
                # Fallback to chunking by logical blocks of 25 lines
                chunks.extend(self._generic_chunk(lines, rel_path))
        except Exception:
            # Fallback if syntax error in candidate file
            chunks.extend(self._generic_chunk(lines, rel_path))
            
        return chunks

    def _generic_chunk(self, lines: List[str], rel_path: str, chunk_size: int = 30, overlap: int = 5) -> List[RAGChunk]:
        chunks = []
        total_lines = len(lines)
        if total_lines == 0:
            return chunks

        i = 0
        while i < total_lines:
            end = min(i + chunk_size, total_lines)
            chunk_text = "\n".join(lines[i:end])
            chunks.append(RAGChunk(rel_path, i + 1, end, chunk_text))
            if end >= total_lines:
                break
            i += max(1, chunk_size - overlap)
        return chunks

    def clean_and_index(self, project_id: str, project_root: Path, additional_requirements: str = "") -> Tuple[List[RAGChunk], List[str]]:
        """
        Parses all supported files, chunks with metadata, applies noisy-data filtering,
        and constructs an index for retrieval.
        """
        raw_chunks: List[RAGChunk] = []
        cleaning_logs: List[str] = []
        files = self.scan_files(project_root)

        for file_path in files:
            try:
                rel_path = file_path.relative_to(project_root).as_posix()
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                if file_path.suffix.lower() == ".py":
                    chunks = self.chunk_python_file(file_path, rel_path, content)
                else:
                    lines = content.splitlines()
                    chunks = self._generic_chunk(lines, rel_path)

                raw_chunks.extend(chunks)
            except Exception as e:
                cleaning_logs.append(f"Failed to read/chunk {file_path}: {str(e)}")

        # Add additional requirements as indexed chunk if present
        if additional_requirements.strip():
            req_lines = additional_requirements.strip().splitlines()
            raw_chunks.extend(self._generic_chunk(req_lines, "requirements.txt", chunk_size=20, overlap=3))

        # --- Noisy Data Filtering ---
        seen_hashes = set()
        valid_chunks: List[RAGChunk] = []

        for chunk in raw_chunks:
            stripped = chunk.content.strip()
            
            # Rule 1: Empty or whitespace only
            if not stripped:
                chunk.is_filtered = True
                chunk.filter_reason = "Empty or whitespace-only chunk"
                cleaning_logs.append(f"Filtered chunk in {chunk.file_path}:{chunk.start_line}-{chunk.end_line} ({chunk.filter_reason})")
                continue

            # Rule 2: Trivial boilerplate / comments (< 15 chars)
            if len(stripped) < 15 and not stripped.startswith("def ") and not stripped.startswith("class "):
                chunk.is_filtered = True
                chunk.filter_reason = "Trivial or boilerplate line (< 15 chars)"
                cleaning_logs.append(f"Filtered chunk in {chunk.file_path}:{chunk.start_line}-{chunk.end_line} ({chunk.filter_reason})")
                continue

            # Rule 3: Exact duplicates
            if chunk.chunk_hash in seen_hashes:
                chunk.is_filtered = True
                chunk.filter_reason = "Duplicate content chunk"
                cleaning_logs.append(f"Filtered duplicate chunk in {chunk.file_path}:{chunk.start_line}-{chunk.end_line}")
                continue

            # Rule 4: Binary/junk content check
            if '\x00' in chunk.content:
                chunk.is_filtered = True
                chunk.filter_reason = "Binary or non-text content"
                cleaning_logs.append(f"Filtered binary chunk in {chunk.file_path}")
                continue

            seen_hashes.add(chunk.chunk_hash)
            valid_chunks.append(chunk)

        # Store in project index
        self.project_indices[project_id] = valid_chunks
        self._build_tfidf(project_id, valid_chunks)

        return valid_chunks, cleaning_logs

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r'[a-zA-Z0-9_]+', text) if len(w) > 1]

    def _build_tfidf(self, project_id: str, chunks: List[RAGChunk]):
        doc_count = len(chunks)
        if doc_count == 0:
            self.idf_vocab[project_id] = {}
            return

        df = {}
        for chunk in chunks:
            words = set(self._tokenize(chunk.content))
            for w in words:
                df[w] = df.get(w, 0) + 1

        idf = {}
        for w, count in df.items():
            idf[w] = math.log((1 + doc_count) / (1 + count)) + 1.0
        self.idf_vocab[project_id] = idf

    def retrieve(self, project_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve top-k relevant chunks for a given query using TF-IDF cosine similarity."""
        chunks = self.project_indices.get(project_id, [])
        if not chunks:
            return []

        idf = self.idf_vocab.get(project_id, {})
        q_tokens = self._tokenize(query)
        if not q_tokens:
            # Return first top_k
            return [
                {
                    "file_path": c.file_path,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "content": c.content,
                    "score": 0.5
                } for c in chunks[:top_k]
            ]

        # Calculate query vector
        q_vec = {}
        for t in q_tokens:
            q_vec[t] = q_vec.get(t, 0) + 1
        for t in q_vec:
            q_vec[t] = q_vec[t] * idf.get(t, 1.0)
        q_norm = math.sqrt(sum(v*v for v in q_vec.values())) or 1.0

        scores = []
        for chunk in chunks:
            c_tokens = self._tokenize(chunk.content)
            c_tf = {}
            for t in c_tokens:
                c_tf[t] = c_tf.get(t, 0) + 1

            dot = 0.0
            for t, val in q_vec.items():
                if t in c_tf:
                    doc_weight = c_tf[t] * idf.get(t, 1.0)
                    dot += val * doc_weight

            c_norm = math.sqrt(sum((c_tf[t] * idf.get(t, 1.0))**2 for t in c_tf)) or 1.0
            sim = dot / (q_norm * c_norm)
            
            # Boost matches where file name appears in query
            if Path(chunk.file_path).name.lower() in query.lower():
                sim += 0.2

            scores.append((sim, chunk))

        scores.sort(key=lambda x: x[0], reverse=True)
        top = scores[:top_k]

        return [
            {
                "file_path": item[1].file_path,
                "start_line": item[1].start_line,
                "end_line": item[1].end_line,
                "content": item[1].content,
                "score": round(float(item[0]), 4)
            }
            for item in top if item[0] > 0.0 or len(scores) <= top_k
        ]

rag_engine = RAGEngine()
