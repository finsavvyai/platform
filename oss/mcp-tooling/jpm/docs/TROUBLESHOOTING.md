# Troubleshooting & Known Issues

## All Issues Resolved (v12.0.16)

All major issues have been resolved in the latest version:

| Issue | Status | Solution |
|-------|--------|----------|
| Directory resolution errors | **FIXED** | Proper handling of relative paths (`.`) |
| Vulnerability check failures | **FIXED** | Enhanced error handling with fallbacks |
| npm idealTree errors | **FIXED** | Automatic retry logic with cleanup |
| Package installation failures | **FIXED** | Robust retry mechanism with recovery |
| All tools operational | **COMPLETE** | 16/16 tools fully functional |

## Common Solutions

### 1. npm idealTree Error
```bash
# If you see: "Tracker 'idealTree' already exists"
# Solution 1: Use the clean cache tool
"Clean the npm cache first"

# Solution 2: Manual cleanup (if needed)
npm cache clean --force

# Solution 3: Restart Claude Desktop to reset MCP connection
```

### 2. Directory Resolution Issues  
```bash
# Problem: "Invalid project directory: /"  
# SOLVED - all tools now work with relative paths
"Install lodash in the current directory"  # Works correctly now
```

### 3. Vulnerability Check Not Working
```bash
# SOLVED - now provides graceful fallback
"Check vulnerabilities for express@4.17.0"  # Works with helpful information
```

## Debug Tools

Use the debug tool to check server status:
```
"Run debug_version tool"
```

This will show:
- Current version running
- Server uptime and status  
- Working directory
- Environment details

## Testing Commands

Verify everything is working:
```bash
# Quick production test
npm run test:production

# Comprehensive feature test  
npm run test:comprehensive

# Test specific issues that were fixed
npm run test:issues
```

## Getting Help

If you encounter issues:

1. **Check Version**: Use `debug_version` tool to confirm you're running v12.0.16+
2. **Restart**: Restart Claude Desktop to pick up latest version
3. **Clear Cache**: Try `clean_cache` tool first
4. **Check Logs**: Look for `[npmplus-mcp]` messages in console
5. **Report**: Open issue at [GitHub Issues](https://github.com/shacharsol/js-package-manager-mcp/issues)

**Include in bug reports:**
- Version from `debug_version` output
- Exact error message
- Steps to reproduce
- Operating system

## Version Update Process

To ensure you're running the latest version:

**For Hosted Service Users:**
- Updates are automatic
- Restart Claude Desktop to refresh connection

**For Self-Hosted Users:**
```bash
# Update to latest version
npm update npmplus-mcp-server

# Or reinstall
npm uninstall -g npmplus-mcp-server
npm install -g npmplus-mcp-server@latest
```
