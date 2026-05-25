"""Notebook management for organizing conversations and sources."""

import logging
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

from src.notebooks.models import Message, Section, Notebook
from src.notebooks.storage import load_notebooks, save_notebook

logger = logging.getLogger("finsavvyai.notebook")


class NotebookManager:
    """Manage notebooks for organized conversations."""

    def __init__(self, storage_path: str = "notebooks"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(exist_ok=True)
        self.notebooks: Dict[str, Notebook] = {}
        self._load_notebooks()

    def _load_notebooks(self):
        """Load notebooks from disk."""
        load_notebooks(self.storage_path, self.notebooks)

    def _save_notebook(self, notebook: Notebook):
        """Save notebook to disk."""
        save_notebook(self.storage_path, notebook)

    def create_notebook(self, name: str) -> Notebook:
        """Create a new notebook."""
        notebook = Notebook(
            id=f"nb_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            name=name
        )

        section = Section(
            id=f"section_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            title="Section 1"
        )
        notebook.sections.append(section)

        self.notebooks[notebook.id] = notebook
        self._save_notebook(notebook)

        logger.info(f"Created notebook: {notebook.name}")
        return notebook

    def get_notebook(self, notebook_id: str) -> Optional[Notebook]:
        """Get a notebook by ID."""
        return self.notebooks.get(notebook_id)

    def list_notebooks(self) -> List[Notebook]:
        """List all notebooks."""
        return list(self.notebooks.values())

    def delete_notebook(self, notebook_id: str) -> bool:
        """Delete a notebook."""
        if notebook_id in self.notebooks:
            notebook = self.notebooks[notebook_id]

            notebook_file = self.storage_path / f"{notebook_id}.json"
            if notebook_file.exists():
                notebook_file.unlink()

            del self.notebooks[notebook_id]
            logger.info(f"Deleted notebook: {notebook.name}")
            return True

        return False

    def create_section(
        self,
        notebook_id: str,
        title: str
    ) -> Optional[Section]:
        """Create a new section in a notebook."""
        notebook = self.get_notebook(notebook_id)
        if not notebook:
            return None

        section = Section(
            id=f"section_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            title=title
        )

        notebook.sections.append(section)
        self._save_notebook(notebook)

        logger.info(f"Created section: {title} in {notebook.name}")
        return section

    def add_message(
        self,
        notebook_id: str,
        section_id: str,
        role: str,
        content: str,
        citations: Optional[List[Dict]] = None
    ) -> Optional[Message]:
        """Add a message to a section."""
        notebook = self.get_notebook(notebook_id)
        if not notebook:
            return None

        section = next(
            (s for s in notebook.sections if s.id == section_id), None
        )
        if not section:
            return None

        message = Message(
            id=f"msg_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}",
            role=role,
            content=content,
            citations=citations or []
        )

        section.messages.append(message)
        self._save_notebook(notebook)

        logger.debug(f"Added message to {notebook.name}/{section.title}")
        return message

    def attach_sources(
        self,
        notebook_id: str,
        section_id: str,
        source_ids: List[str]
    ) -> bool:
        """Attach sources to a section."""
        notebook = self.get_notebook(notebook_id)
        if not notebook:
            return False

        section = next(
            (s for s in notebook.sections if s.id == section_id), None
        )
        if not section:
            return False

        section.sources = source_ids
        self._save_notebook(notebook)

        logger.info(
            f"Attached {len(source_ids)} sources to "
            f"{notebook.name}/{section.title}"
        )
        return True


# Global instance
_notebook_manager: Optional[NotebookManager] = None


def get_notebook_manager() -> NotebookManager:
    """Get the global notebook manager instance."""
    global _notebook_manager
    if _notebook_manager is None:
        _notebook_manager = NotebookManager()
    return _notebook_manager
