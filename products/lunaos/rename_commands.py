import os
import re

repo_dir = "/Users/shaharsolomon/dev/projects/02_AI_AGENTS/lunaos-repos"

# Files to rename
moves = [
    ("luna-agents/commands/luna-design.md", "luna-agents/commands/ln-kick.md"),
    ("luna-agents/commands/luna-execute.md", "luna-agents/commands/ln-mash.md"),
    ("luna-agents/tests/commands/luna-design.md", "luna-agents/tests/commands/ln-kick.md"),
    ("luna-agents/tests/commands/luna-execute.md", "luna-agents/tests/commands/ln-mash.md"),
    ("luna-agents/agents/json/design-architect.json", "luna-agents/agents/json/ln-kick-architect.json")
]

for src, dst in moves:
    src_path = os.path.join(repo_dir, src)
    dst_path = os.path.join(repo_dir, dst)
    if os.path.exists(src_path) and not os.path.exists(dst_path):
        os.rename(src_path, dst_path)
        print(f"Renamed {src} to {dst}")
    else:
        print(f"File {src} not found or {dst} already exists, skipping.")

# Search and replace in all files
def replace_in_files(directory):
    for root, dirs, files in os.walk(directory):
        # modify dirs in place to skip hidden folders and large folders
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'dist', 'build', '.next', 'out')]
        for file in files:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception:
                continue

            new_content = content.replace("luna-design", "ln-kick").replace("luna-execute", "ln-mash")
            
            if new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {file_path}")

replace_in_files(repo_dir)
print("Done")
