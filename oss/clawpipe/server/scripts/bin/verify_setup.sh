#!/bin/bash
# Verify FinSavvyAI setup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 Verifying FinSavvyAI Setup..."
echo ""

ERRORS=0
PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

# Check Python
echo "📦 Checking Python..."
if [ -x "$PYTHON_BIN" ] || command -v "$PYTHON_BIN" &> /dev/null; then
    PYTHON_VERSION=$("$PYTHON_BIN" --version)
    echo "   ✅ $PYTHON_VERSION"
    echo "   ✅ Interpreter: $PYTHON_BIN"
else
    echo "   ❌ Python interpreter not found: $PYTHON_BIN"
    ERRORS=$((ERRORS + 1))
fi

# Check dependencies
echo ""
echo "📦 Checking Python dependencies..."
REQUIRED_DEPS=("aiohttp" "psutil" "requests")
for dep in "${REQUIRED_DEPS[@]}"; do
    if "$PYTHON_BIN" -c "import $dep" 2>/dev/null; then
        echo "   ✅ $dep"
    else
        echo "   ❌ $dep not installed"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check Go (optional)
echo ""
echo "📦 Checking Go (optional for desktop app)..."
if command -v go &> /dev/null; then
    GO_VERSION=$(go version)
    echo "   ✅ $GO_VERSION"
else
    echo "   ⚠️  Go not found (optional for desktop app)"
fi

# Check scripts
echo ""
echo "📜 Checking scripts..."
SCRIPTS=("start_cluster.sh" "start_master.sh" "start_worker.sh" "test_basic.py" "verify_setup.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo "   ✅ $script"
    elif [ -f "scripts/bin/$script" ] && [ -x "scripts/bin/$script" ]; then
        echo "   ✅ scripts/bin/$script"
    elif [ -f "$script" ]; then
        echo "   ⚠️  $script exists but not executable"
        chmod +x "$script"
        echo "      (made executable)"
    else
        echo "   ❌ $script not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check core files
echo ""
echo "📁 Checking core files..."
CORE_FILES=("src/core/master_server.py" "src/core/start_master.py" "src/workers/worker_node.py" "src/cli/finsavvyai_cli.py" "main.py")
for file in "${CORE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file not found"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "============================================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ Setup verification complete! Everything looks good."
    echo ""
    echo "Next steps:"
    echo "  1. Start cluster: ./start_cluster.sh"
    echo "  2. Test: $PYTHON_BIN test_basic.py"
    echo "  3. Use CLI: $PYTHON_BIN main.py help"
    exit 0
else
    echo "❌ Found $ERRORS issue(s). Please fix them before proceeding."
    echo ""
    echo "To install missing dependencies:"
    echo "  $PYTHON_BIN -m pip install -r requirements.txt"
    exit 1
fi
