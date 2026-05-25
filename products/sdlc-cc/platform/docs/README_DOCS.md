# SDLC.ai Documentation

This directory contains the complete documentation for the SDLC.ai platform.

## Documentation Structure

```
docs/
├── index.html              # Documentation portal homepage
├── _config.yml            # GitHub Pages configuration
├── .nojekyll              # Disable Jekyll processing
├── CNAME                  # Custom domain configuration
│
├── guides/                # User guides and tutorials
│   ├── QUICK_START.md
│   ├── PRODUCTION_READINESS_REPORT.md
│   └── STAGING_GUIDE.md
│
├── architecture/          # System architecture
│   ├── system-overview.md
│   └── system-design.md
│
├── api/                   # API documentation
│   └── openapi.yaml
│
├── deployment/            # Deployment guides
│   └── production-deployment.md
│
├── production/            # Production operations
│   ├── DEPLOYMENT_SETUP.md
│   ├── DISASTER_RECOVERY.md
│   └── DATABASE_BACKUP_STRATEGY.md
│
├── support/               # Support resources
│   └── support-processes.md
│
└── knowledge-base/        # FAQ and knowledge base
    └── faq.md
```

## Viewing Documentation

### Locally

Serve the documentation locally:

```bash
# Option 1: Python HTTP server
cd docs
python -m http.server 8080
# Open http://localhost:8080

# Option 2: Node.js http-server
npm install -g http-server
cd docs
http-server -p 8080
```

### GitHub Pages

The documentation is automatically published to GitHub Pages at:
- **Production**: https://docs.sdlc.cc
- **GitHub Pages**: https://sdlc-ai.github.io/platform/docs/

## Contributing to Docs

### Adding New Documentation

1. Create markdown file in appropriate directory
2. Add link to `index.html` in relevant section
3. Follow the existing structure and formatting
4. Include code examples where applicable

### Documentation Standards

- **Format**: Markdown (GitHub Flavored Markdown)
- **Line length**: 100 characters max (for readability)
- **Code blocks**: Always specify language for syntax highlighting
- **Links**: Use relative links within documentation
- **Images**: Store in `assets/images/` directory

### Example Markdown File

```markdown
# Title

Brief description of what this document covers.

## Section 1

Content here...

### Code Example

\`\`\`bash
# Example command
npm install
\`\`\`

## See Also

- [Related Doc 1](../path/to/doc1.md)
- [Related Doc 2](../path/to/doc2.md)
```

## Building Documentation

The documentation is static HTML and Markdown. No build process required.

For GitHub Pages deployment:

```bash
# Enable GitHub Pages in repository settings
# Settings > Pages > Source: Deploy from branch
# Branch: main, Folder: /docs
```

## Documentation Sections

### Getting Started
Quick start guides for new users and developers.

### Architecture
System design, component diagrams, and technical architecture.

### API Reference
Complete API documentation with examples.

### Deployment
Production deployment guides and best practices.

### Security & Compliance
Security implementation and compliance guidelines.

### Support
FAQ, troubleshooting, and support processes.

## Contact

For documentation issues or suggestions:
- **Email**: docs@sdlc.cc
- **GitHub Issues**: [Report documentation issues](https://github.com/finsavvyai/sdlc-platform/issues)

## License

Documentation licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
