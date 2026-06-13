# a2a_server/tasks/discovery_register.py
"""
Aggregation and registration of discovered task handlers.

These functions deliberately call back into the ``a2a_server.tasks.discovery``
module namespace (rather than importing the names directly) so that tests which
patch ``a2a_server.tasks.discovery.discover_handlers_in_package`` /
``load_handlers_from_entry_points`` / ``discover_all_handlers`` continue to work.
"""
import logging
from typing import Optional, Type, List

from a2a_server.tasks.task_handler import TaskHandler

logger = logging.getLogger(__name__)


def discover_all_handlers(packages: Optional[List[str]] = None) -> List[Type[TaskHandler]]:
    """
    Discover all available task handlers from packages and entry points.

    Args:
        packages: Optional list of package names to search in
                 If None, will search in 'a2a_server.tasks.handlers'

    Returns:
        List of discovered TaskHandler classes
    """
    from a2a_server.tasks import discovery

    if packages is None:
        packages = ['a2a_server.tasks.handlers']

    logger.debug(f"Discovering handlers in packages: {packages}")
    handlers = []

    # Discover from packages
    for package in packages:
        pkg_handlers = list(discovery.discover_handlers_in_package(package))
        handlers.extend(pkg_handlers)
        logger.debug(f"Found {len(pkg_handlers)} handlers in package {package}")

    # Discover from entry points
    ep_handlers = list(discovery.load_handlers_from_entry_points())
    handlers.extend(ep_handlers)
    logger.debug(f"Found {len(ep_handlers)} handlers from entry points")

    logger.debug(f"Discovered {len(handlers)} handlers in total")
    return handlers


def register_discovered_handlers(
    task_manager,
    packages: Optional[List[str]] = None,
    default_handler_class: Optional[Type[TaskHandler]] = None
):
    """
    Discover and register all available handlers with a TaskManager.

    Args:
        task_manager: The TaskManager instance to register handlers with
        packages: Optional list of packages to search in
        default_handler_class: Optional class to use as the default handler
                             If None, the first handler is used as default
    """
    from a2a_server.tasks import discovery

    logger.debug("Starting handler discovery")
    handlers = discovery.discover_all_handlers(packages)

    if not handlers:
        logger.warning("No task handlers discovered")
        return

    # Instantiate and register each handler
    default_registered = False
    registered_count = 0
    default_handler_name = None
    non_default_handlers = []

    for handler_class in handlers:
        try:
            handler = handler_class()

            # If this is the specified default handler class, or no default has been
            # registered yet and no specific default was requested
            is_default = (
                (default_handler_class and handler_class is default_handler_class) or
                (not default_registered and default_handler_class is None)
            )

            task_manager.register_handler(handler, default=is_default)
            registered_count += 1

            if is_default:
                default_registered = True
                default_handler_name = handler.name
                logger.debug(f"Registered {handler.name} as default handler")
            else:
                non_default_handlers.append(handler.name)
                logger.debug(f"Registered handler: {handler.name}")

        except Exception as e:
            logger.error(f"Failed to instantiate handler {handler_class.__name__}: {e}")

    # Log a single summary message at INFO level
    if registered_count > 0:
        if default_handler_name:
            others = f", others: {', '.join(non_default_handlers)}" if non_default_handlers else ""
            logger.info(f"Registered {registered_count} task handlers (default: {default_handler_name}{others})")
        else:
            logger.info(f"Registered {registered_count} task handlers: {', '.join(non_default_handlers)}")
