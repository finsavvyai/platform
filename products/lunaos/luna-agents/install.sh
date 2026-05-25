#!/bin/bash

# Luna Agents - One-Command Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/yourusername/luna-agents/main/install.sh | bash
# Or: git clone && cd luna-agents && ./install.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Animation frames
FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

print_header() {
    clear
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║                                                  ║"
    echo "║           🌙  LUNA AGENTS INSTALLER  🌙          ║"
    echo "║                                                  ║"
    echo "║     AI-Powered Development Lifecycle Plugin     ║"
    echo "║                                                  ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

spinner() {
    local pid=$1
    local message=$2
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        printf "\r${YELLOW}${FRAMES[$i]}${NC} $message"
        i=$(( (i+1) % ${#FRAMES[@]} ))
        sleep 0.1
    done
    printf "\r"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    local all_good=true
    
    # Check Node.js
    if check_command node; then
        local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge 18 ]; then
            print_success "Node.js $(node -v) ✓"
        else
            print_error "Node.js 18+ required (found: $(node -v))"
            all_good=false
        fi
    else
        print_error "Node.js not found - Install from https://nodejs.org"
        all_good=false
    fi
    
    # Check npm
    if check_command npm; then
        print_success "npm $(npm -v) ✓"
    else
        print_error "npm not found"
        all_good=false
    fi
    
    # Check git
    if check_command git; then
        print_success "Git $(git --version | cut -d' ' -f3) ✓"
    else
        print_error "Git not found - Install from https://git-scm.com"
        all_good=false
    fi
    
    if [ "$all_good" = false ]; then
        echo ""
        print_error "Please install missing prerequisites and try again"
        exit 1
    fi
    
    echo ""
}

install_luna() {
    print_header
    
    echo -e "${CYAN}Welcome to Luna Agents!${NC}"
    echo ""
    echo "This installer will:"
    echo "  1. Install dependencies"
    echo "  2. Configure the MCP server"
    echo "  3. Link the plugin to Claude"
    echo "  4. Set up your environment"
    echo ""
    
    read -p "Continue? (Y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
        echo "Installation cancelled"
        exit 0
    fi
    
    echo ""
    check_prerequisites
    
    # Determine project root
    if [ -f "package.json" ]; then
        PROJECT_ROOT="$(pwd)"
    else
        print_error "Not in Luna Agents directory. Please cd to the project root."
        exit 1
    fi
    
    # Install dependencies
    print_step "Installing dependencies..."
    (npm install --silent) &
    spinner $! "Installing dependencies..."
    wait $!
    print_success "Dependencies installed"
    
    # Install MCP server dependencies
    print_step "Setting up MCP server..."
    cd "$PROJECT_ROOT/mcp-servers/luna-nexa-rag"
    (npm install --silent) &
    spinner $! "Installing MCP server..."
    wait $!
    print_success "MCP server ready"
    
    # Install plugin dependencies
    print_step "Setting up plugin..."
    cd "$PROJECT_ROOT/.claude-plugin"
    (npm install --silent) &
    spinner $! "Installing plugin..."
    wait $!
    print_success "Plugin ready"
    
    cd "$PROJECT_ROOT"
    
    # Configure MCP server
    echo ""
    print_step "Configuring MCP server..."
    echo ""
    echo -e "${YELLOW}Quick Setup:${NC}"
    echo "Press Enter to use defaults, or enter custom values"
    echo ""
    
    cd "$PROJECT_ROOT/mcp-servers/luna-nexa-rag"
    npm run setup
    
    # Link plugin
    echo ""
    print_step "Linking plugin to Claude..."
    cd "$PROJECT_ROOT"
    npm run link:plugin
    
    # Create quick reference
    cat > "$PROJECT_ROOT/QUICK_REFERENCE.md" << 'EOF'
# 🌙 Luna Agents Quick Reference

## Commands
- `/luna-requirements` - Analyze project requirements
- `/luna-design` - Create technical design
- `/luna-plan` - Generate implementation plan
- `/luna-execute` - Execute tasks
- `/luna-review` - Code review
- `/luna-test` - Create tests
- `/luna-deploy` - Deploy to production
- `/luna-docs` - Generate documentation
- `/luna-monitor` - Setup monitoring
- `/luna-review-launch` - Post-launch review

## Workflow
1. Start in your project directory
2. Run `/luna-requirements [project-name]`
3. Follow commands in order
4. Check `.luna/[project-name]/` for generated files

## Semantic Search
- `index_codebase` - Index your code
- `search_context` - Search by meaning
- `get_similar_implementations` - Find similar code

## Configuration
- MCP: `~/.luna-nexa-rag/config.json`
- Plugin: `~/.config/Claude/plugins/luna-agents`

## Reconfigure
```bash
cd mcp-servers/luna-nexa-rag
npm run setup
```

## Help
- Docs: ./README.md
- Issues: github.com/yourusername/luna-agents/issues
EOF
    
    print_success "Quick reference created: QUICK_REFERENCE.md"
    
    # Final message
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║        ✓  INSTALLATION SUCCESSFUL!  ✓            ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${CYAN}📝 Next Steps:${NC}"
    echo ""
    echo "  1. 🔄 Restart Claude Desktop"
    echo "  2. 📂 Open your project in Claude Code"
    echo "  3. ⌨️  Type '/' to see Luna commands"
    echo "  4. 🚀 Run '/luna-requirements' to start"
    echo ""
    
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo ""
    echo "  Quick Reference: ./QUICK_REFERENCE.md"
    echo "  Full Guide: ./INSTALL.md"
    echo "  Examples: ./examples/"
    echo ""
    
    echo -e "${CYAN}🔧 Configuration:${NC}"
    echo ""
    echo "  MCP Server: ~/.luna-nexa-rag/config.json"
    echo "  Plugin: ~/.config/Claude/plugins/luna-agents"
    echo ""
    
    echo -e "${CYAN}💡 Pro Tips:${NC}"
    echo ""
    echo "  • Use the same project name across all commands"
    echo "  • Run commands in order for best results"
    echo "  • Check .luna/ folder for generated files"
    echo "  • Index your codebase first for semantic search"
    echo ""
    
    echo -e "${GREEN}Happy coding with Luna! 🌙${NC}"
    echo ""
}

# Handle errors
trap 'echo ""; print_error "Installation failed"; exit 1' ERR

# Run installation
install_luna
