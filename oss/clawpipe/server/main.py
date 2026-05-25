#!/usr/bin/env python3
"""
FinSavvyAI Main Entry Point
Professional distributed AI cluster system
"""

import argparse
import os
import sys

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from src.cli.finsavvyai_cli import FinSavvyAICLI


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        prog="finsavvyai",
        description="FinSavvyAI - Professional AWS-Style Distributed AI Cluster",
        add_help=False,
    )

    parser.add_argument("--version", action="version", version="FinSavvyAI 1.0.0")

    # Forward to CLI
    cli = FinSavvyAICLI()
    return cli.main()


if __name__ == "__main__":
    sys.exit(main())
