#!/bin/bash
# ──────────────────────────────────────────────────────────────
# OPENCLAW MISSION CONTROL — DEPLOYMENT SCRIPT
# For Mac mini M4 running Kali (or macOS with Kali tools)
#
# This script:
# 1. Checks system prerequisites (Node.js, npm, git)
# 2. Installs Node.js if not present (via brew or nvm)
# 3. Installs project dependencies
# 4. Builds the production bundle
# 5. Sets up a systemd-like service (or launchctl on macOS)
# 6. Configures the web server
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requirements:
#   - macOS 14+ on Apple Silicon (M4 Mac mini)
#   - OR Kali Linux on Apple Silicon
#   - Internet connection for first-time dependency install
#   - ~500MB disk space
# ──────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
LOG_FILE="${PROJECT_DIR}/deploy.log"

# ─── Logging ───
log() { echo -e "${GREEN}[✓]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1" >> "$LOG_FILE"; }
error() { echo -e "${RED}[✗]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}   🎃 ${GREEN}OPENCLAW MISSION CONTROL — DEPLOYMENT${NC}                    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}   Agent: Coco // Platform: Kali on Mac mini M4             ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ──────────────────────────────────────────────────────────────
# STEP 1: Detect OS
# ──────────────────────────────────────────────────────────────
info "Detecting operating system..."
OS="$(uname -s)"
ARCH="$(uname -m)"

if [[ "$OS" == "Darwin" ]]; then
    log "macOS detected (${ARCH})"
    IS_MAC=true
    IS_LINUX=false
elif [[ "$OS" == "Linux" ]]; then
    log "Linux detected (${ARCH})"
    IS_MAC=false
    IS_LINUX=true
    # Check if Kali
    if [[ -f /etc/os-release ]] && grep -qi "kali" /etc/os-release; then
        log "Kali Linux confirmed"
    else
        warn "Not Kali Linux — script may need adjustments"
    fi
else
    error "Unsupported OS: ${OS}"
    exit 1
fi

# ──────────────────────────────────────────────────────────────
# STEP 2: Check and install prerequisites
# ──────────────────────────────────────────────────────────────
info "Checking prerequisites..."

# Check for Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [[ "$NODE_MAJOR" -ge 20 ]]; then
        log "Node.js v${NODE_VERSION} — OK"
    else
        warn "Node.js v${NODE_VERSION} found but v20+ required"
        NEED_NODE=true
    fi
else
    warn "Node.js not found"
    NEED_NODE=true
fi

# Install Node.js if needed
if [[ "${NEED_NODE:-false}" == "true" ]]; then
    info "Installing Node.js..."
    if $IS_MAC; then
        if command -v brew &> /dev/null; then
            brew install node@22
            log "Node.js installed via Homebrew"
        else
            warn "Homebrew not found. Installing Homebrew first..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            brew install node@22
            log "Homebrew + Node.js installed"
        fi
    elif $IS_LINUX; then
        # Use NodeSource for Kali/Debian
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
        log "Node.js installed via NodeSource"
    fi
fi

# Check for npm
if command -v npm &> /dev/null; then
    log "npm v$(npm -v) — OK"
else
    error "npm not found. This should have been installed with Node.js."
    exit 1
fi

# Check for git
if command -v git &> /dev/null; then
    log "git v$(git --version | awk '{print $3}') — OK"
else
    info "Installing git..."
    if $IS_MAC; then
        xcode-select --install 2>/dev/null || brew install git
    elif $IS_LINUX; then
        sudo apt-get install -y git
    fi
    log "git installed"
fi

# ──────────────────────────────────────────────────────────────
# STEP 3: Install project dependencies
# ──────────────────────────────────────────────────────────────
info "Installing project dependencies..."
cd "$PROJECT_DIR"

if [[ -f "package.json" ]]; then
    npm install --production=false 2>&1 | tail -5
    log "Dependencies installed"
else
    error "package.json not found in ${PROJECT_DIR}"
    exit 1
fi

# ──────────────────────────────────────────────────────────────
# STEP 4: Build production bundle
# ──────────────────────────────────────────────────────────────
info "Building production bundle..."
npm run build 2>&1 | tail -10
log "Production build complete"

# Verify build output
if [[ -d "dist/public" ]]; then
    log "Build output verified: dist/public/ exists"
    BUILD_SIZE=$(du -sh dist/public | awk '{print $1}')
    log "Bundle size: ${BUILD_SIZE}"
else
    error "Build output not found at dist/public/"
    exit 1
fi

# ──────────────────────────────────────────────────────────────
# STEP 5: Set up service
# ──────────────────────────────────────────────────────────────
info "Setting up service..."

SERVE_PORT="${OPENCLAW_MC_PORT:-5000}"

if $IS_MAC; then
    # macOS: Create LaunchAgent plist
    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_FILE="${PLIST_DIR}/com.openclaw.mission-control.plist"
    mkdir -p "$PLIST_DIR"

    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.mission-control</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>${PROJECT_DIR}/dist/index.cjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>${SERVE_PORT}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/logs/stderr.log</string>
</dict>
</plist>
EOF

    mkdir -p "${PROJECT_DIR}/logs"
    log "LaunchAgent plist created: ${PLIST_FILE}"

    # Load the service
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load "$PLIST_FILE"
    log "Service loaded and started via launchctl"

elif $IS_LINUX; then
    # Linux: Create systemd service
    SERVICE_FILE="/etc/systemd/system/openclaw-mission-control.service"

    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=OpenClaw Mission Control Dashboard
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${PROJECT_DIR}
ExecStart=$(which node) dist/index.cjs
Environment=NODE_ENV=production
Environment=PORT=${SERVE_PORT}
Restart=always
RestartSec=10
StandardOutput=append:${PROJECT_DIR}/logs/stdout.log
StandardError=append:${PROJECT_DIR}/logs/stderr.log

[Install]
WantedBy=multi-user.target
EOF

    mkdir -p "${PROJECT_DIR}/logs"
    sudo systemctl daemon-reload
    sudo systemctl enable openclaw-mission-control
    sudo systemctl restart openclaw-mission-control
    log "Systemd service created and started"
fi

# ──────────────────────────────────────────────────────────────
# STEP 6: Verify deployment
# ──────────────────────────────────────────────────────────────
info "Verifying deployment..."
sleep 3

if curl -sf "http://127.0.0.1:${SERVE_PORT}" > /dev/null 2>&1; then
    log "Mission Control is live at http://127.0.0.1:${SERVE_PORT}"
else
    warn "Could not reach the server yet — it may still be starting"
    info "Check logs: tail -f ${PROJECT_DIR}/logs/stdout.log"
fi

# ──────────────────────────────────────────────────────────────
# DONE
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}   🎃 ${GREEN}DEPLOYMENT COMPLETE${NC}                                     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   Dashboard: ${CYAN}http://127.0.0.1:${SERVE_PORT}${NC}                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   Logs:      ${CYAN}${PROJECT_DIR}/logs/${NC}     ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}   To manage the service:                                     ${GREEN}║${NC}"
if $IS_MAC; then
echo -e "${GREEN}║${NC}     Stop:  launchctl unload ${PLIST_FILE}  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Start: launchctl load ${PLIST_FILE}    ${GREEN}║${NC}"
elif $IS_LINUX; then
echo -e "${GREEN}║${NC}     Stop:  sudo systemctl stop openclaw-mission-control      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Start: sudo systemctl start openclaw-mission-control     ${GREEN}║${NC}"
fi
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Full log: ${LOG_FILE}"
