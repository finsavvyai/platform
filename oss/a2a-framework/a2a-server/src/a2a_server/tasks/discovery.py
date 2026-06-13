# a2a_server/tasks/discovery.py
"""
Module for automatic discovery and registration of task handlers.
"""
import importlib
import inspect
import pkgutil
import logging
from typing import Iterator, Optional, Type, List

from a2a_server.tasks.task_handler import TaskHandler
from a2a_server.tasks.discovery_register import (
    discover_all_handlers,
    register_discovered_handlers,
)

logger = logging.getLogger(__name__)

__all__ = [
    "discover_handlers_in_package",
    "load_handlers_from_entry_points",
    "discover_all_handlers",
    "register_discovered_handlers",
]


def _accept_handler_class(handler_class, ep_name: str) -> bool:
    """
    Validate a class loaded from an entry point as a concrete TaskHandler.

    Returns True if the class should be yielded, False if it must be skipped.
    """
    if not inspect.isclass(handler_class):
        logger.warning(f"Entry point {ep_name} did not load a class, got {type(handler_class)}")
        return False

    if not issubclass(handler_class, TaskHandler):
        logger.warning(
            f"Entry point {ep_name} loaded {handler_class.__name__} "
            f"which is not a TaskHandler subclass"
        )
        return False

    if handler_class is TaskHandler:
        return False

    # Check if it's marked as abstract
    if hasattr(handler_class, 'abstract') and getattr(handler_class, 'abstract'):
        logger.debug(f"Skipping abstract handler: {handler_class.__name__}")
        return False

    # Check if it's abstract using inspect.isabstract
    if inspect.isabstract(handler_class):
        logger.debug(f"Skipping abstract handler: {handler_class.__name__}")
        return False

    return True


def discover_handlers_in_package(package_name: str) -> Iterator[Type[TaskHandler]]:
    """
    Discover all TaskHandler subclasses in a package and its subpackages.

    Args:
        package_name: Fully qualified package name to search in

    Yields:
        TaskHandler subclasses found in the package
    """
    try:
        package = importlib.import_module(package_name)
        logger.debug(f"Scanning package {package_name} for handlers")
    except ImportError:
        logger.warning(f"Could not import package {package_name} for handler discovery")
        return

    # Find and import all modules recursively in the package
    prefix = package.__name__ + '.'
    modules_scanned = 0

    for _, name, is_pkg in pkgutil.walk_packages(package.__path__, prefix):
        modules_scanned += 1
        try:
            module = importlib.import_module(name)

            # Inspect all module members
            for attr_name, obj in inspect.getmembers(module, inspect.isclass):
                # Check if it's a TaskHandler subclass
                if issubclass(obj, TaskHandler) and obj is not TaskHandler:
                    # Check if it's marked as abstract
                    if hasattr(obj, 'abstract') and getattr(obj, 'abstract'):
                        logger.debug(f"Skipping abstract handler: {obj.__name__}")
                        continue

                    # Check if it's abstract using inspect.isabstract
                    if inspect.isabstract(obj):
                        logger.debug(f"Skipping abstract handler: {obj.__name__}")
                        continue

                    logger.debug(f"Discovered handler: {obj.__name__} in {name}")
                    yield obj
        except (ImportError, AttributeError) as e:
            logger.warning(f"Error inspecting module {name}: {e}")

    logger.debug(f"Scanned {modules_scanned} modules in package {package_name}")


def load_handlers_from_entry_points() -> Iterator[Type[TaskHandler]]:
    """
    Discover TaskHandler implementations registered via entry_points.

    Looks for entry points in the group 'a2a.task_handlers'.

    Yields:
        TaskHandler subclasses found in entry points
    """
    logger.debug("Scanning entry points for handlers")

    try:
        from importlib.metadata import entry_points
        eps = entry_points(group='a2a.task_handlers')
        yield from _iter_entry_point_handlers(eps)
    except ImportError:
        # Fallback for Python < 3.10
        try:
            import pkg_resources
            logger.debug("Using pkg_resources for entry point discovery")
            eps = pkg_resources.iter_entry_points(group='a2a.task_handlers')
            yield from _iter_entry_point_handlers(eps)
        except ImportError:
            logger.warning("Neither importlib.metadata nor pkg_resources available")


def _iter_entry_point_handlers(eps) -> Iterator[Type[TaskHandler]]:
    """Load, validate, and yield concrete handler classes from entry points."""
    entry_points_count = 0
    handlers_found = 0

    for ep in eps:
        entry_points_count += 1
        try:
            handler_class = ep.load()
            if not _accept_handler_class(handler_class, ep.name):
                continue
            logger.debug(f"Loaded handler {handler_class.__name__} from entry point {ep.name}")
            handlers_found += 1
            yield handler_class
        except Exception as e:
            logger.warning(f"Failed to load handler from entry point {ep.name}: {e}")

    logger.debug(f"Found {handlers_found} handlers from {entry_points_count} entry points")
