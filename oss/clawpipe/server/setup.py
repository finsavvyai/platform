#!/usr/bin/env python3
"""
Setup script for FinSavvyAI CLI installation
"""

import os

from setuptools import find_packages, setup


# Read version from __init__.py
def get_version():
    version_file = os.path.join(os.path.dirname(__file__), "__init__.py")
    with open(version_file, "r") as f:
        for line in f:
            if line.startswith("__version__"):
                return line.split("=")[1].strip().strip('"').strip("'")
    return "1.0.0"


if __name__ == "__main__":
    setup(
        name="finsavvyai",
        version=get_version(),
        description="Professional AWS-Style Distributed AI Cluster",
        long_description=open("docs/README.md").read(),
        long_description_content_type="text/markdown",
        author="FinSavvyAI Team",
        author_email="support@finsavvyai.com",
        url="https://github.com/finsavvyai/finsavvyai-cluster",
        packages=find_packages(include=["src*", "config*"]),
        install_requires=[
            "aiohttp>=3.9.0",
            "psutil>=5.9.0",
            "requests>=2.31.0",
            "colorama>=0.4.6",
            "tabulate>=0.9.0",
            "pyyaml>=6.0.1",
            "transformers>=4.35.0",
            "torch>=2.1.0",
            "huggingface-hub>=0.19.0",
            "accelerate>=0.24.0",
        ],
        extras_require={
            "vision": ["opencv-python>=4.8.0", "pillow>=10.0.0"],
            "dev": ["pytest>=7.4.0", "black>=23.0.0", "flake8>=6.0.0"],
        },
        entry_points={
            "console_scripts": [
                "finsavvyai=main:main",
                "fs=main:main",
            ],
        },
        python_requires=">=3.8",
        classifiers=[
            "Development Status :: 5 - Production/Stable",
            "Intended Audience :: Developers",
            "License :: OSI Approved :: MIT License",
            "Programming Language :: Python :: 3",
        ],
    )
