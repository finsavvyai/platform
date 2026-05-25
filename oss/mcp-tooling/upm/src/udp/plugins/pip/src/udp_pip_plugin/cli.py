#!/usr/bin/env python3
"""
UDP CLI tool for Python projects
"""

import argparse
import sys

from .manager import UdpManager
from .utils.logger import Logger


def create_parser() -> argparse.ArgumentParser:
    """Create and configure the argument parser."""
    parser = argparse.ArgumentParser(
        prog="udp",
        description="Universal Dependency Platform CLI for Python projects",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  udp analyze                 # Analyze udp.yml configuration
  udp download                # Download cross-ecosystem dependencies
  udp generate-bridges        # Generate bridge code for interop
  udp setup                   # Complete UDP setup (analyze + download + bridges)
  udp install                 # Install UDP integration in current project
        """,
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    parser.add_argument(
        "-c", "--config",
        type=str,
        default="udp.yml",
        help="Path to UDP configuration file (default: udp.yml)"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Analyze command
    analyze_parser = subparsers.add_parser(
        "analyze",
        help="Analyze udp.yml and validate cross-language dependencies"
    )
    analyze_parser.add_argument(
        "-c", "--config",
        type=str,
        default="udp.yml",
        help="UDP configuration file path"
    )

    # Download command
    download_parser = subparsers.add_parser(
        "download",
        help="Download cross-ecosystem dependencies from UDP service"
    )
    download_parser.add_argument(
        "-c", "--config",
        type=str,
        default="udp.yml",
        help="UDP configuration file path"
    )
    download_parser.add_argument(
        "-o", "--output",
        type=str,
        default="lib/udp",
        help="Output directory for dependencies"
    )

    # Generate bridges command
    bridges_parser = subparsers.add_parser(
        "generate-bridges",
        help="Generate bridge code for cross-language interoperability"
    )
    bridges_parser.add_argument(
        "-c", "--config",
        type=str,
        default="udp.yml",
        help="UDP configuration file path"
    )
    bridges_parser.add_argument(
        "-o", "--output",
        type=str,
        default="src/udp_bridges",
        help="Output directory for bridge code"
    )

    # Setup command
    setup_parser = subparsers.add_parser(
        "setup",
        help="Complete UDP setup: analyze, download, and generate bridges"
    )
    setup_parser.add_argument(
        "-c", "--config",
        type=str,
        default="udp.yml",
        help="UDP configuration file path"
    )

    # Install command
    install_parser = subparsers.add_parser(
        "install",
        help="Install UDP integration in current Python project"
    )

    return parser


async def run_analyze(args: argparse.Namespace, logger: Logger) -> int:
    """Run the analyze command."""
    try:
        manager = UdpManager(logger)
        await manager.analyze(args.config)
        logger.success("Analysis completed successfully")
        return 0
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return 1


async def run_download(args: argparse.Namespace, logger: Logger) -> int:
    """Run the download command."""
    try:
        manager = UdpManager(logger)
        await manager.download(args.config, args.output)
        logger.success("Dependencies downloaded successfully")
        return 0
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return 1


async def run_generate_bridges(args: argparse.Namespace, logger: Logger) -> int:
    """Run the generate-bridges command."""
    try:
        manager = UdpManager(logger)
        await manager.generate_bridges(args.config, args.output)
        logger.success("Bridge code generated successfully")
        return 0
    except Exception as e:
        logger.error(f"Bridge generation failed: {e}")
        return 1


async def run_setup(args: argparse.Namespace, logger: Logger) -> int:
    """Run the setup command."""
    try:
        manager = UdpManager(logger)
        await manager.setup(args.config)
        logger.success("UDP setup completed successfully")
        return 0
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        return 1


async def run_install(args: argparse.Namespace, logger: Logger) -> int:
    """Run the install command."""
    try:
        manager = UdpManager(logger)
        await manager.install()
        logger.success("UDP integration installed successfully")
        return 0
    except Exception as e:
        logger.error(f"Installation failed: {e}")
        return 1


async def main_async() -> int:
    """Main async entry point."""
    parser = create_parser()
    args = parser.parse_args()

    logger = Logger(verbose=args.verbose)

    if not args.command:
        parser.print_help()
        return 1

    command_handlers = {
        "analyze": run_analyze,
        "download": run_download,
        "generate-bridges": run_generate_bridges,
        "setup": run_setup,
        "install": run_install,
    }

    handler = command_handlers.get(args.command)
    if not handler:
        logger.error(f"Unknown command: {args.command}")
        return 1

    return await handler(args, logger)


def main() -> None:
    """Main entry point."""
    import asyncio

    try:
        exit_code = asyncio.run(main_async())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(130)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
