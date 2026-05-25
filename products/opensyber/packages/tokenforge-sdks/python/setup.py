"""TokenForge SDK — Device-bound ECDSA P-256 session security for Python."""

from setuptools import setup, find_packages

setup(
    name="tokenforge",
    version="1.0.0",
    description="Device-bound ECDSA P-256 session security SDK",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="OpenSyber",
    author_email="sdk@opensyber.cloud",
    url="https://github.com/opensyber/tokenforge-python",
    py_modules=["tokenforge"],
    python_requires=">=3.10",
    install_requires=[
        "cryptography>=41.0",
        "requests>=2.31",
    ],
    extras_require={
        "httpx": ["httpx>=0.25"],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Topic :: Security :: Cryptography",
    ],
)
