"""Storage operations for notebook persistence."""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict

from src.notebooks.models import Notebook

logger = logging.getLogger("finsavvyai.notebook")


def load_notebooks(
    storage_path: Path,
    notebooks: Dict[str, Notebook]
) -> None:
    """Load notebooks from disk into the notebooks dict.

    Args:
        storage_path: Directory containing notebook JSON files.
        notebooks: Dict to populate with loaded notebooks.
    """
    if not storage_path.exists():
        return

    for notebook_file in storage_path.glob("*.json"):
        try:
            with open(notebook_file, 'r') as f:
                data = json.load(f)
                notebook = Notebook(**data)
                notebooks[notebook.id] = notebook
                logger.info(f"Loaded notebook: {notebook.name}")
        except Exception as e:
            logger.error(
                f"Failed to load notebook {notebook_file}: {e}"
            )


def save_notebook(
    storage_path: Path,
    notebook: Notebook
) -> None:
    """Save notebook to disk.

    Args:
        storage_path: Directory to save notebook JSON file.
        notebook: Notebook instance to persist.
    """
    notebook.updated_at = datetime.now().isoformat()

    notebook_file = storage_path / f"{notebook.id}.json"
    with open(notebook_file, 'w') as f:
        notebook_dict = {
            'id': notebook.id,
            'name': notebook.name,
            'sections': [
                {
                    'id': s.id,
                    'title': s.title,
                    'messages': [
                        {
                            'id': m.id,
                            'role': m.role,
                            'content': m.content,
                            'citations': m.citations,
                            'timestamp': m.timestamp
                        }
                        for m in s.messages
                    ],
                    'sources': s.sources,
                    'created_at': s.created_at
                }
                for s in notebook.sections
            ],
            'created_at': notebook.created_at,
            'updated_at': notebook.updated_at
        }
        json.dump(notebook_dict, f, indent=2)

    logger.debug(f"Saved notebook: {notebook.name}")
