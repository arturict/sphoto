#!/bin/bash
# =============================================================================
# SPhoto Local Development Setup Script
# =============================================================================
# This script sets up everything needed for local development
# Run: ./scripts/dev-setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "  ____  ____  _           _        "
echo " / ___||  _ \| |__   ___ | |_ ___  "
echo " \___ \| |_) | '_ \ / _ \| __/ _ \ "
echo "  ___) |  __/| | | | (_) | || (_) |"
echo " |____/|_|   |_| |_|\___/ \__\___/ "
echo ""
echo -e "${NC}Local Development Setup"
echo "========================"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# =============================================================================
# Check prerequisites
# =============================================================================
echo -e "${YELLOW}Checking prerequisites...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed.${NC}"
        echo "$2"
        exit 1
    else
        echo -e "  ${GREEN}✓${NC} $1 found"
    fi
}

check_command "bun" "Install Bun: curl -fsSL https://bun.sh/install | bash"
check_command "docker" "Install Docker: https://docs.docker.com/get-docker/"
check_command "docker-compose" "Docker Compose should come with Docker Desktop"

# Check if docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker is running"

echo ""

# =============================================================================
# Create .env.local
# =============================================================================
echo -e "${YELLOW}Setting up environment...${NC}"

if [ -f .env.local ]; then
    echo -e "  ${GREEN}✓${NC} .env.local already exists"
else
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        echo -e "  ${GREEN}✓${NC} Created .env.local from template"
    else
        echo -e "${RED}Error: .env.local.example not found${NC}"
        exit 1
    fi
fi

# =============================================================================
# Create local directories
# =============================================================================
echo -e "${YELLOW}Creating local directories...${NC}"

mkdir -p .local/instances/_shared_users
mkdir -p .local/free/uploads .local/free/db
mkdir -p .local/paid/uploads .local/paid/db

echo -e "  ${GREEN}✓${NC} Created .local/ directories"

# =============================================================================
# Clean corrupted node_modules (WSL fix)
# =============================================================================
echo -e "${YELLOW}Checking for corrupted node_modules...${NC}"

clean_if_corrupted() {
    local dir="$1"
    if [ -d "$dir/node_modules/.bin" ]; then
        # Check for Windows-style temp files (WSL corruption indicator)
        if ls "$dir/node_modules/.bin"/.*-* &> /dev/null 2>&1; then
            echo -e "  ${YELLOW}!${NC} Found corrupted node_modules in $dir, cleaning..."
            rm -rf "$dir/node_modules" "$dir/.next" "$dir/bun.lockb" 2>/dev/null || true
            echo -e "  ${GREEN}✓${NC} Cleaned $dir"
        fi
    fi
}

clean_if_corrupted "web"
clean_if_corrupted "automation"

echo -e "  ${GREEN}✓${NC} node_modules check complete"

# =============================================================================
# Install dependencies
# =============================================================================
echo -e "${YELLOW}Installing dependencies...${NC}"

echo "  Installing web dependencies..."
(cd web && bun install) || {
    echo -e "${RED}Failed to install web dependencies${NC}"
    exit 1
}
echo -e "  ${GREEN}✓${NC} Web dependencies installed"

echo "  Installing automation dependencies..."
(cd automation && bun install) || {
    echo -e "${RED}Failed to install automation dependencies${NC}"
    exit 1
}
echo -e "  ${GREEN}✓${NC} Automation dependencies installed"

# =============================================================================
# Done!
# =============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Next steps:"
echo ""
echo -e "  ${BLUE}1.${NC} Edit .env.local with your settings:"
echo -e "     ${YELLOW}\$EDITOR .env.local${NC}"
echo ""
echo -e "  ${BLUE}2.${NC} Start Immich containers:"
echo -e "     ${YELLOW}make dev${NC}"
echo ""
echo -e "  ${BLUE}3.${NC} Set up Immich instances:"
echo -e "     - Go to http://localhost:2283 (free) and create admin"
echo -e "     - Go to http://localhost:2284 (paid) and create admin"
echo -e "     - Get API keys from Account Settings → API Keys"
echo -e "     - Add keys to .env.local"
echo ""
echo -e "  ${BLUE}4.${NC} Start development servers (in separate terminals):"
echo -e "     ${YELLOW}make web${NC}          # http://localhost:3000"
echo -e "     ${YELLOW}make automation${NC}   # http://localhost:3001"
echo ""
echo -e "For more details, see: ${BLUE}docs/LOCAL-DEVELOPMENT.md${NC}"
echo ""
