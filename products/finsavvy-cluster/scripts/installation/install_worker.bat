@echo off
echo "🚀 FinSavvyAI Worker Installer for Windows"
echo "====================================="

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo "❌ Python is not installed. Please install Python 3.8+ first."
    pause
    exit /b 1
)

echo "🐍 Found Python"
python --version

REM Check if virtual environment exists
if not exist "finsavvyai-worker-env" (
    echo "📦 Creating virtual environment..."
    python -m venv finsavvyai-worker-env
)

REM Activate virtual environment
echo "🔧 Activating virtual environment..."
call finsavvyai-worker-env\Scripts\activate.bat

REM Install dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install aiohttp psutil

REM Get master host
set /p MASTER_HOST="🌐 Enter master host address (default: 10.0.0.10): "
if "%MASTER_HOST%"=="" set MASTER_HOST=10.0.0.10

REM Get worker name
set /p WORKER_NAME="🏷️  Enter worker name (default: %COMPUTERNAME%): "
if "%WORKER_NAME%"=="" set WORKER_NAME=%COMPUTERNAME%

REM Get available models
echo "🤖 Available models:"
echo "  1. gpt-3.5-turbo-sim"
echo "  2. phi-2"
echo "  3. glm-4v-9b"
echo "  4. custom"

set /p MODEL_CHOICE="Select model (1-4): "

if "%MODEL_CHOICE%"=="1" set MODELS=gpt-3.5-turbo-sim
if "%MODEL_CHOICE%"=="2" set MODELS=phi-2
if "%MODEL_CHOICE%"=="3" set MODELS=glm-4v-9b
if "%MODEL_CHOICE%"=="4" (
    set /p MODELS="Enter custom model name: "
)
if "%MODEL_CHOICE%"=="" set MODELS=gpt-3.5-turbo-sim

REM Create startup script
echo REM FinSavvyAI Worker Startup Script > start_worker.bat
echo 🚀 Starting FinSavvyAI Worker... >> start_worker.bat
echo    Name: %WORKER_NAME% >> start_worker.bat
echo    Master: %MASTER_HOST% >> start_worker.bat
echo    Model: %MODELS% >> start_worker.bat
echo. >> start_worker.bat
echo REM Activate virtual environment >> start_worker.bat
echo call finsavvyai-worker-env\Scripts\activate.bat >> start_worker.bat
echo. >> start_worker.bat
echo REM Start worker >> start_worker.bat
echo python worker_node.py --master %MASTER_HOST% --name "%WORKER_NAME%" --models %MODELS% >> start_worker.bat

echo.
echo ✅ Installation complete!
echo =======================
echo.
echo 🚀 Start worker:
echo    start_worker.bat
echo.
echo 🌐 Check status:
echo    http://localhost:8001/health
echo.
echo 📱 Worker dashboard:
echo    http://localhost:8001/
echo.
echo 🔧 To stop worker: Ctrl+C
echo.
echo 💡 Make sure the cluster master is running on %MASTER_HOST%:8000
echo.
pause
