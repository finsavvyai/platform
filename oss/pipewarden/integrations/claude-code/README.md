# PipeWarden × Claude Code

Three integration surfaces. Pick whichever matches your workflow.

## 1. Skill — slash commands inside Claude Code

```bash
cp -r integrations/claude-code/skill/pipewarden ~/.claude/skills/
# restart Claude Code
```

Then in any Claude Code session:

- `/pw-scan` — scan the current working tree
- `/pw-review` — review the diff for security
- `/pw-fix` — apply safe auto-fixes (shows diff first)

See `skill/pipewarden/SKILL.md` for the full prompt.

## 2. Hooks — block insecure code at write-time

The hooks intercept `Edit` / `Write` tool calls (postToolUse) and shell
commands (preToolUse). Insecure patterns are blocked **before** they hit
disk — Claude has to retry with a safe variant.

Wire them up in `~/.claude/settings.json`:

```jsonc
{
  "hooks": {
    "preToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "/absolute/path/to/integrations/claude-code/hooks/pre-bash.sh" }
        ]
      }
    ],
    "postToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "/absolute/path/to/integrations/claude-code/hooks/post-write.sh" }
        ]
      }
    ]
  }
}
```

The two scripts:

- `hooks/pre-bash.sh` — refuses `rm -rf /`, leaked-secret echoes, `curl |
  bash` from untrusted hosts, and other obvious footguns.
- `hooks/post-write.sh` — runs `pipewarden scan` on the freshly-written
  file and exits non-zero if any finding is severity ≥ high.

Both scripts respect `PIPEWARDEN_HOOK_DISABLED=1` so you can opt out
without restarting Claude Code.

## 3. MCP server — Cursor and any other MCP host

See `../cursor-mcp/README.md` for the same scanning surface exposed as an
MCP server, registerable in `.cursor/mcp.json` or any other MCP-aware
client.
