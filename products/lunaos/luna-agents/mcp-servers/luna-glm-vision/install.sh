#!/bin/bash

# Luna GLM Vision MCP Server Installation Script

set -e

echo "🚀 Installing Luna GLM Vision MCP Server..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create test reports directory
echo "📁 Creating test reports directory..."
mkdir -p ./test-reports

# Check for screenshot tools
echo "🔍 Checking for screenshot tools..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v screencapture &> /dev/null; then
        echo "✅ macOS screencapture tool found"

        # Check for cliclick (for click automation)
        if command -v cliclick &> /dev/null; then
            echo "✅ cliclick found for click automation"
        else
            echo "⚠️  cliclick not found. Install with: brew install cliclick"
            echo "   Required for click automation on macOS"
        fi
    else
        echo "❌ screencapture not found. This should be available on macOS"
        exit 1
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v import &> /dev/null; then
        echo "✅ ImageMagick import tool found"

        # Check for xdotool (for X11 automation)
        if command -v xdotool &> /dev/null; then
            echo "✅ xdotool found for GUI automation"
        else
            echo "⚠️  xdotool not found. Install with: sudo apt-get install xdotool"
            echo "   Required for GUI automation on Linux"
        fi
    else
        echo "⚠️  ImageMagick not found. Install with: sudo apt-get install imagemagick"
        echo "   Required for screenshots on Linux"
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "⚠️  Windows support is limited"
    echo "   Please install additional screenshot tools for full functionality"
fi

# Create example configuration
echo "⚙️  Creating example configuration..."
cat > .env.example << EOF
# GLM Vision Configuration
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.5v
GLM_TIMEOUT=30000
GLM_MAX_RETRIES=3
GLM_THINKING_MODE=true
GLM_SCREENSHOT_QUALITY=90
GLM_TEST_REPORTS_DIR=./test-reports
GLM_DEBUG=false
EOF

# Create startup script
echo "📜 Creating startup script..."
cat > start-server.sh << 'EOF'
#!/bin/bash

# Luna GLM Vision MCP Server Startup Script

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
elif [ -f .env.example ]; then
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure."
    echo "   cp .env.example .env"
    echo "   Then edit .env with your GLM API key"
    exit 1
fi

# Check if GLM API key is set
if [ -z "$GLM_API_KEY" ] || [ "$GLM_API_KEY" = "your_glm_api_key_here" ]; then
    echo "❌ GLM_API_KEY not configured. Please set it in your .env file."
    exit 1
fi

echo "🚀 Starting Luna GLM Vision MCP Server..."
echo "   API Key: ${GLM_API_KEY:0:8}..."
echo "   Model: $GLM_MODEL"
echo "   Base URL: $GLM_BASE_URL"

# Start the server
node index.js
EOF

chmod +x start-server.sh

# Run tests
echo "🧪 Running basic tests..."
chmod +x test.js
if [ -z "$GLM_API_KEY" ]; then
    echo "⚠️  GLM_API_KEY not set. Running tests in mock mode..."
    node test.js
else
    echo "✅ GLM_API_KEY found. Running full integration tests..."
    GLM_API_KEY="$GLM_API_KEY" node test.js
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure your GLM API key:"
echo "      cp .env.example .env"
echo "      # Edit .env and set GLM_API_KEY=your_actual_api_key"
echo ""
echo "   2. Start the server:"
echo "      ./start-server.sh"
echo ""
echo "   3. Test the commands:"
echo "      /luna-glm-setup"
echo "      /luna-glm-capture"
echo "      /luna-glm-test login-flow"
echo ""
echo "   4. For more information, see:"
echo "      - Agent specification: ../../agents/luna-glm-vision.md"
echo "      - Commands reference: ../../.luna/commands/luna-glm-vision.md"
echo ""
echo "✨ Happy testing!"