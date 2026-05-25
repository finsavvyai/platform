#!/usr/bin/env python3

from setuptools import find_packages, setup

with open("README.md", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="udp-pip-plugin",
    version="1.0.0",
    author="UDP Team",
    author_email="team@universaldependency.com",
    description="Pip plugin for Universal Dependency Platform (UDP) integration",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/universal-dependency-platform/udp-pip-plugin",
    project_urls={
        "Bug Tracker": "https://github.com/universal-dependency-platform/udp-pip-plugin/issues",
        "Documentation": "https://docs.universaldependency.com/plugins/pip",
        "Source Code": "https://github.com/universal-dependency-platform/udp-pip-plugin",
    },
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Build Tools",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "mypy>=1.0.0",
            "pre-commit>=3.0.0",
        ],
        "bridge-java": ["jpype1>=1.4.0"],
        "bridge-nodejs": ["nodejs>=18.0.0"],
        "bridge-rust": ["cffi>=1.15.0"],
    },
    entry_points={
        "console_scripts": [
            "udp=udp_pip_plugin.cli:main",
        ],
        "pip_tools": [
            "udp=udp_pip_plugin.pip_integration:UdpPipTool",
        ],
    },
    include_package_data=True,
    package_data={
        "udp_pip_plugin": [
            "templates/*.py",
            "templates/*.jinja2",
            "bridges/*.py",
        ],
    },
    keywords=[
        "udp",
        "dependency-management",
        "cross-language",
        "pip",
        "python",
        "package-manager",
    ],
    zip_safe=False,
)
