---
name: ll-codemap
displayName: Luna Code Map Builder
description: Build a visual code structure map with file tree, exports, imports, and dependency graph
version: 1.0.0
category: documentation
agent: luna-code-mapper
parameters:
  - name: scope
    type: string
    description: Directory or module scope for code mapping
    required: true
    prompt: true
workflow:
  - scan_directory_structure
  - extract_exports_and_imports
  - build_dependency_graph
  - detect_circular_dependencies
  - generate_codemap_document
output:
  - .luna/{current-project}/codemap.md
prerequisites:
  - source_code
---

# Luna Code Map Builder

Builds a comprehensive code structure map showing file tree, module boundaries, exports, imports, dependency relationships, and layer architecture.

## What This Command Does

This command analyses your project's source files and generates a visual code map with annotated directory trees, dependency graphs (Mermaid), and module relationship documentation.

## Prerequisites

Requires in your current project:
- Source code

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full-project code map
- Type **src/lib** or a path for scoped mapping

## Execution Steps

1. **Directory Scan**: Builds annotated file tree with purpose labels
2. **Export Extraction**: Maps each module's public API
3. **Dependency Graph**: Creates import relationship Mermaid diagram
4. **Circular Detection**: Flags and suggests fixes for dependency cycles
5. **Map Generation**: Produces `codemap.md` with all visualisations

## Output Files

Creates in your current project:
- `.luna/{current-project}/codemap.md`

Includes:
- Annotated file tree
- Module map with exports and consumers
- Mermaid dependency graph
- Entry points documentation
- Shared utilities index
- Layer diagram (presentation → business → data)

## Next Steps in Workflow

After code mapping:
```
/luna-routemap    # Map routes and navigation
/luna-hld         # Generate high-level design from the code
```

## Tips

- Re-run after major refactors to keep the map current
- Use scoped mapping for large monorepos
- The dependency graph helps identify tightly-coupled modules
