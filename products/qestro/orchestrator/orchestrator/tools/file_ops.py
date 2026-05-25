"""
File Operations Tools
=====================

Tools for reading, writing, and searching files in the Qestro codebase.
These replace the need for Cursor's file operations.
"""

import os
from pathlib import Path
from typing import List, Optional
from crewai.tools import BaseTool
from pydantic import Field
import subprocess


class FileReadTool(BaseTool):
    """Tool for reading file contents."""
    
    name: str = "Read File"
    description: str = """
    Read the contents of a file.
    
    Input: Absolute or relative path to the file
    Output: File contents as string
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, file_path: str) -> str:
        """Read a file."""
        try:
            path = Path(file_path)
            if not path.is_absolute():
                path = self.project_root / path
            
            if not path.exists():
                return f"File not found: {path}"
            
            return path.read_text(encoding="utf-8")
        except Exception as e:
            return f"Error reading file: {str(e)}"


class FileWriteTool(BaseTool):
    """Tool for writing file contents."""
    
    name: str = "Write File"
    description: str = """
    Write content to a file. Creates parent directories if needed.
    
    Input: {"path": "file/path.ts", "content": "file content"}
    Output: Success or error message
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, path: str, content: str) -> str:
        """Write to a file."""
        try:
            file_path = Path(path)
            if not file_path.is_absolute():
                file_path = self.project_root / file_path
            
            # Create parent directories
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write content
            file_path.write_text(content, encoding="utf-8")
            
            return f"Successfully wrote {len(content)} characters to {file_path}"
        except Exception as e:
            return f"Error writing file: {str(e)}"


class FileSearchTool(BaseTool):
    """Tool for searching files and content."""
    
    name: str = "Search Files"
    description: str = """
    Search for files or content in the codebase.
    
    For filename search: {"pattern": "*.ts", "directory": "src/services"}
    For content search: {"query": "class UserService", "directory": "backend"}
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, pattern: str = None, query: str = None, 
             directory: str = ".") -> str:
        """Search for files or content."""
        try:
            search_dir = self.project_root / directory
            
            if query:
                # Content search using ripgrep if available, else grep
                try:
                    result = subprocess.run(
                        ["rg", "--line-number", "--no-heading", query, str(search_dir)],
                        capture_output=True, text=True, timeout=30
                    )
                    return result.stdout if result.stdout else "No matches found"
                except FileNotFoundError:
                    result = subprocess.run(
                        ["grep", "-rn", query, str(search_dir)],
                        capture_output=True, text=True, timeout=30
                    )
                    return result.stdout if result.stdout else "No matches found"
            
            elif pattern:
                # File pattern search using fd if available, else find
                try:
                    result = subprocess.run(
                        ["fd", pattern, str(search_dir)],
                        capture_output=True, text=True, timeout=30
                    )
                    return result.stdout if result.stdout else "No files found"
                except FileNotFoundError:
                    result = subprocess.run(
                        ["find", str(search_dir), "-name", pattern],
                        capture_output=True, text=True, timeout=30
                    )
                    return result.stdout if result.stdout else "No files found"
            
            return "Please provide either 'pattern' for filename search or 'query' for content search"
            
        except Exception as e:
            return f"Search error: {str(e)}"


class DirectoryListTool(BaseTool):
    """Tool for listing directory contents."""
    
    name: str = "List Directory"
    description: str = """
    List files and directories in a path.
    
    Input: Directory path (relative to project root)
    Output: List of files and directories
    """
    
    project_root: Path = Field(default_factory=Path.cwd)
    
    def _run(self, directory: str = ".") -> str:
        """List directory contents."""
        try:
            dir_path = self.project_root / directory
            
            if not dir_path.exists():
                return f"Directory not found: {dir_path}"
            
            items = []
            for item in sorted(dir_path.iterdir()):
                prefix = "📁" if item.is_dir() else "📄"
                items.append(f"{prefix} {item.name}")
            
            return "\n".join(items) if items else "Empty directory"
            
        except Exception as e:
            return f"Error listing directory: {str(e)}"
