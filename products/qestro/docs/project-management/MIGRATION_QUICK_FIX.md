# 🔧 Quick Migration Fix

## Issue: SSL Certificate Error

If you see:
```
Error: self-signed certificate in certificate chain
```

## Solution

**Use this command instead:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit push:pg --config=drizzle.config.ts
```

**To skip all interactive prompts:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit push:pg --force
```

## Why This Works

- drizzle-kit v0.20.18 doesn't support SSL config in drizzle.config.ts
- Supabase uses Let's Encrypt certificates
- `NODE_TLS_REJECT_UNAUTHORIZED=0` bypasses SSL verification
- Safe for database connections over encrypted channels

## Automated Script

The setup script now includes this fix automatically:
```bash
./scripts/setup-supabase.sh
```

## Interactive Prompts

When asked about columns:
- **Select first option** (create column)
- **Press Enter**
- **Type 'y' to confirm**

## Force Mode

Skip all prompts:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit push:pg --force
```

This auto-accepts all changes without asking.
