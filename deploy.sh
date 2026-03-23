#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#
#   ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
#  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
#  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
#  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
#  ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
#   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
#
#   MISSION CONTROL — DEPLOYMENT SCRIPT
#   Agent: Coco // Platform: Kali Linux on Mac mini M4 (32GB)
#   Tailscale-aware · Binds 0.0.0.0 · Port 8443
#
#   Usage:
#     ./deploy.sh              — Production deploy
#     ./deploy.sh --dev        — Dev mode (hot reload, no build)
#     ./deploy.sh --stop       — Stop the running service
#     ./deploy.sh --status     — Show service status
#
#   Env overrides:
#     OPENCLAW_MC_PORT=8443    — Override listen port (default: 8443)
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Paths & config ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy.log"
SERVICE_NAME="openclaw-mission-control"
SERVE_PORT="${OPENCLAW_MC_PORT:-8443}"
BIND_ADDR="0.0.0.0"

# ─── Logging helpers ─────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
log()   { echo -e "${GREEN}[✓]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: $1" >> "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1" >> "$LOG_FILE"; }
error() { echo -e "${RED}[✗]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"; }
info()  { echo -e "${CYAN}[→]${NC} $1"; }
step()  { echo -e "\n${MAGENTA}${BOLD}▸ $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] STEP: $1" >> "$LOG_FILE"; }
dim()   { echo -e "${DIM}  $1${NC}"; }

# ─── Banner ──────────────────────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${GREEN}${BOLD}OPENCLAW MISSION CONTROL${NC} ${DIM}// Coco${NC}                          ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  ${DIM}Kali Linux · Mac mini M4 · Tailscale-ready · Port ${SERVE_PORT}${NC}       ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ─── Flag parsing ─────────────────────────────────────────────────────────────
DEV_MODE=false
ACTION="deploy"

for arg in "$@"; do
  case "$arg" in
    --dev)    DEV_MODE=true; ACTION="deploy" ;;
    --stop)   ACTION="stop" ;;
    --status) ACTION="status" ;;
    --help|-h)
      print_banner
      echo "  Usage:  ./deploy.sh [--dev] [--stop] [--status]"
      echo ""
      echo "  Flags:"
      echo "    (none)    Production deploy (build + start service)"
      echo "    --dev     Dev mode: npm run dev, no build step, no service"
      echo "    --stop    Stop the running service"
      echo "    --status  Show service status"
      echo ""
      echo "  Env:"
      echo "    OPENCLAW_MC_PORT  Override default port (8443)"
      exit 0
      ;;
    *)
      warn "Unknown flag: $arg (ignored)"
      ;;
  esac
done

print_banner

# ══════════════════════════════════════════════════════════════════════════════
# DETECT OS
# ══════════════════════════════════════════════════════════════════════════════
step "Detecting operating system"
OS="$(uname -s)"
ARCH="$(uname -m)"

IS_MAC=false
IS_LINUX=false

if [[ "$OS" == "Darwin" ]]; then
  log "macOS detected (${ARCH})"
  IS_MAC=true
elif [[ "$OS" == "Linux" ]]; then
  log "Linux detected (${ARCH})"
  IS_LINUX=true
  if [[ -f /etc/os-release ]] && grep -qi "kali" /etc/os-release; then
    log "Kali Linux confirmed"
  else
    warn "Not Kali Linux — some steps may need adjustments"
  fi
else
  error "Unsupported OS: ${OS}"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# --stop ACTION
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$ACTION" == "stop" ]]; then
  step "Stopping OpenClaw Mission Control"
  if $IS_LINUX; then
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
      sudo systemctl stop "$SERVICE_NAME"
      log "Service stopped: $SERVICE_NAME"
    else
      warn "Service $SERVICE_NAME is not running"
    fi
  elif $IS_MAC; then
    PLIST_FILE="$HOME/Library/LaunchAgents/com.openclaw.mission-control.plist"
    if [[ -f "$PLIST_FILE" ]]; then
      launchctl unload "$PLIST_FILE" 2>/dev/null && log "LaunchAgent unloaded" || warn "Already stopped"
    else
      warn "LaunchAgent plist not found — nothing to stop"
    fi
  fi
  # Also kill any stray process on the port
  if lsof -ti:"$SERVE_PORT" > /dev/null 2>&1; then
    kill -9 "$(lsof -ti:"$SERVE_PORT")" 2>/dev/null && warn "Killed stray process on port $SERVE_PORT" || true
  fi
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# --status ACTION
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$ACTION" == "status" ]]; then
  step "OpenClaw Mission Control — Service Status"
  echo ""
  if $IS_LINUX; then
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
      echo -e "  Systemd:   ${GREEN}● active (running)${NC}"
      systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null | tail -6 | sed 's/^/  /'
    else
      echo -e "  Systemd:   ${RED}○ inactive${NC}"
    fi
  elif $IS_MAC; then
    PLIST_LABEL="com.openclaw.mission-control"
    if launchctl list | grep -q "$PLIST_LABEL" 2>/dev/null; then
      echo -e "  LaunchCtl: ${GREEN}● loaded${NC}"
    else
      echo -e "  LaunchCtl: ${RED}○ not loaded${NC}"
    fi
  fi

  # Port check
  if lsof -ti:"$SERVE_PORT" > /dev/null 2>&1; then
    PID=$(lsof -ti:"$SERVE_PORT")
    echo -e "  Port $SERVE_PORT:  ${GREEN}● listening (PID $PID)${NC}"
  else
    echo -e "  Port $SERVE_PORT:  ${RED}○ nothing listening${NC}"
  fi

  # Health check
  if curl -sf "http://127.0.0.1:${SERVE_PORT}/api/health/ping" > /dev/null 2>&1; then
    echo -e "  Health:    ${GREEN}● /api/health/ping OK${NC}"
  else
    echo -e "  Health:    ${YELLOW}! /api/health/ping unreachable${NC}"
  fi

  echo ""
  echo -e "  Logs: ${CYAN}${LOG_DIR}/${NC}"
  echo ""
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# PREREQUISITES
# ══════════════════════════════════════════════════════════════════════════════
step "Checking prerequisites"

NEED_NODE=false

# Node.js
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

if [[ "$NEED_NODE" == "true" ]]; then
  info "Installing Node.js 22.x..."
  if $IS_MAC; then
    if command -v brew &> /dev/null; then
      brew install node@22
    else
      warn "Homebrew not found — installing Homebrew first..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      brew install node@22
    fi
    log "Node.js installed via Homebrew"
  elif $IS_LINUX; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    log "Node.js installed via NodeSource"
  fi
fi

# npm
if command -v npm &> /dev/null; then
  log "npm v$(npm -v) — OK"
else
  error "npm not found. Install Node.js first."
  exit 1
fi

# git
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

# ══════════════════════════════════════════════════════════════════════════════
# TAILSCALE DETECTION
# ══════════════════════════════════════════════════════════════════════════════
step "Detecting Tailscale"

TAILSCALE_IP=""
TAILSCALE_FOUND=false

if command -v tailscale &> /dev/null; then
  TAILSCALE_FOUND=true
  log "Tailscale CLI found: $(which tailscale)"

  # Get Tailscale IPv4
  TS_IP_RAW=$(tailscale ip -4 2>/dev/null || true)
  if [[ -n "$TS_IP_RAW" ]]; then
    TAILSCALE_IP="$TS_IP_RAW"
    log "Tailscale IP: ${TAILSCALE_IP}"
  else
    warn "Tailscale not connected or no IPv4 address assigned"
    TAILSCALE_IP="(not connected)"
  fi

  # Try to get MagicDNS name
  TS_HOSTNAME=$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/\.$//' || true)
  if [[ -n "$TS_HOSTNAME" ]]; then
    log "MagicDNS hostname: ${TS_HOSTNAME}"
  fi
else
  warn "Tailscale CLI not found — Tailscale URL will not be available"
  warn "Install: https://tailscale.com/download/linux"
fi

# ══════════════════════════════════════════════════════════════════════════════
# LOCAL LAN IP
# ══════════════════════════════════════════════════════════════════════════════
LAN_IP=""
if $IS_MAC; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif $IS_LINUX; then
  LAN_IP=$(ip route get 1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1 || hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

if [[ -n "$LAN_IP" ]]; then
  log "LAN IP: ${LAN_IP}"
else
  warn "Could not detect LAN IP"
  LAN_IP="(unknown)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# UFW FIREWALL RULES (Linux only)
# ══════════════════════════════════════════════════════════════════════════════
if $IS_LINUX; then
  step "Configuring UFW firewall"

  if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || echo "inactive")

    if echo "$UFW_STATUS" | grep -qi "active"; then
      log "UFW is active — adding rules"

      # Allow the dashboard port
      if ! sudo ufw status numbered 2>/dev/null | grep -q "${SERVE_PORT}/tcp"; then
        sudo ufw allow "${SERVE_PORT}/tcp" comment "OpenClaw Mission Control" 2>/dev/null
        log "UFW rule added: allow ${SERVE_PORT}/tcp"
      else
        log "UFW rule already exists: ${SERVE_PORT}/tcp"
      fi

      # Allow entire Tailscale CGNAT range (100.64.0.0/10)
      if ! sudo ufw status numbered 2>/dev/null | grep -q "100.64.0.0/10"; then
        sudo ufw allow from 100.64.0.0/10 comment "Tailscale network" 2>/dev/null
        log "UFW rule added: allow from 100.64.0.0/10 (Tailscale)"
      else
        log "UFW rule already exists: Tailscale range"
      fi

      sudo ufw status verbose 2>/dev/null | grep -E "(${SERVE_PORT}|100\.64)" | sed 's/^/  /' || true
    else
      warn "UFW is not active — skipping firewall rules"
      dim "Enable UFW with: sudo ufw enable"
    fi
  else
    warn "UFW not installed — skipping firewall rules"
    dim "Install with: sudo apt-get install ufw"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# DEV MODE
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$DEV_MODE" == "true" ]]; then
  step "Starting in DEV mode (hot reload)"
  warn "Dev mode: no build, no service — running npm run dev directly"
  info "Press Ctrl+C to stop"
  echo ""
  cd "$PROJECT_DIR"
  export PORT="$SERVE_PORT"
  export HOST="$BIND_ADDR"
  export NODE_ENV="development"
  npm run dev
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# KILL STRAY PROCESS ON PORT
# ══════════════════════════════════════════════════════════════════════════════
step "Checking port ${SERVE_PORT} availability"

if lsof -ti:"$SERVE_PORT" > /dev/null 2>&1; then
  STRAY_PID=$(lsof -ti:"$SERVE_PORT")
  warn "Port ${SERVE_PORT} in use by PID ${STRAY_PID} — killing"
  kill -9 "$STRAY_PID" 2>/dev/null || true
  sleep 1
  log "Stray process killed"
else
  log "Port ${SERVE_PORT} is free"
fi

# ══════════════════════════════════════════════════════════════════════════════
# INSTALL DEPENDENCIES
# ══════════════════════════════════════════════════════════════════════════════
step "Installing project dependencies"
cd "$PROJECT_DIR"

if [[ -f "package.json" ]]; then
  npm install --production=false 2>&1 | tail -5
  log "Dependencies installed"
else
  error "package.json not found in ${PROJECT_DIR}"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# BUILD PRODUCTION BUNDLE
# ══════════════════════════════════════════════════════════════════════════════
step "Building production bundle"
npm run build 2>&1 | tail -10
log "Production build complete"

if [[ -d "dist/public" ]]; then
  BUILD_SIZE=$(du -sh dist/public | awk '{print $1}')
  log "Build output verified: dist/public/ (${BUILD_SIZE})"
else
  error "Build output not found at dist/public/"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# LOG ROTATION (Linux only)
# ══════════════════════════════════════════════════════════════════════════════
if $IS_LINUX; then
  step "Setting up log rotation"

  LOGROTATE_CONF="/etc/logrotate.d/${SERVICE_NAME}"

  sudo tee "$LOGROTATE_CONF" > /dev/null << LOGEOF
${LOG_DIR}/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $(whoami) $(id -gn)
    postrotate
        systemctl reload-or-restart ${SERVICE_NAME} 2>/dev/null || true
    endscript
}
LOGEOF

  log "Logrotate config written: ${LOGROTATE_CONF}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# SETUP SERVICE
# ══════════════════════════════════════════════════════════════════════════════
step "Setting up service"
mkdir -p "$LOG_DIR"

if $IS_MAC; then
  # ── macOS: LaunchAgent ────────────────────────────────────────────────────
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
        <key>HOST</key>
        <string>${BIND_ADDR}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
EOF

  launchctl unload "$PLIST_FILE" 2>/dev/null || true
  launchctl load "$PLIST_FILE"
  log "LaunchAgent loaded: ${PLIST_FILE}"

elif $IS_LINUX; then
  # ── Linux: systemd service ────────────────────────────────────────────────
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

  sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=OpenClaw Mission Control Dashboard
Documentation=https://github.com/openclaw/mission-control
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=$(whoami)
Group=$(id -gn)
WorkingDirectory=${PROJECT_DIR}
ExecStart=$(which node) ${PROJECT_DIR}/dist/index.cjs
Environment=NODE_ENV=production
Environment=PORT=${SERVE_PORT}
Environment=HOST=${BIND_ADDR}
Restart=always
RestartSec=10
TimeoutStopSec=30
StandardOutput=append:${LOG_DIR}/stdout.log
StandardError=append:${LOG_DIR}/stderr.log
# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=${PROJECT_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME"
  sudo systemctl restart "$SERVICE_NAME"
  log "Systemd service created, enabled, and started: ${SERVICE_NAME}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK POLLING
# ══════════════════════════════════════════════════════════════════════════════
step "Waiting for service to come online"

HEALTH_URL="http://${BIND_ADDR}:${SERVE_PORT}/api/health"
MAX_RETRIES=15
RETRY_DELAY=2
ONLINE=false

info "Polling ${HEALTH_URL} (up to $((MAX_RETRIES * RETRY_DELAY))s)..."

for i in $(seq 1 "$MAX_RETRIES"); do
  if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
    ONLINE=true
    break
  fi
  echo -ne "  ${DIM}retry ${i}/${MAX_RETRIES}...${NC}\r"
  sleep "$RETRY_DELAY"
done

echo ""
if [[ "$ONLINE" == "true" ]]; then
  log "Health check passed: ${HEALTH_URL}"
  # Pull version from the health endpoint
  HEALTH_RESP=$(curl -sf "${HEALTH_URL}" 2>/dev/null || echo "{}")
  SVC_VERSION=$(echo "$HEALTH_RESP" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  log "Service version: ${SVC_VERSION}"
else
  warn "Service did not respond within $((MAX_RETRIES * RETRY_DELAY))s"
  warn "Check logs: tail -f ${LOG_DIR}/stderr.log"
fi

# ══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

# Build service status string
if $IS_LINUX; then
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    SVC_STATUS="${GREEN}● active${NC}"
  else
    SVC_STATUS="${RED}○ inactive${NC}"
  fi
elif $IS_MAC; then
  SVC_STATUS="${GREEN}● loaded${NC}"
fi

# Build Tailscale URL line
if [[ "$TAILSCALE_FOUND" == "true" ]] && [[ -n "$TAILSCALE_IP" ]] && [[ "$TAILSCALE_IP" != "(not connected)" ]]; then
  TS_URL_LINE="http://${TAILSCALE_IP}:${SERVE_PORT}"
else
  TS_URL_LINE="(Tailscale not connected)"
fi

# Build LAN URL line
if [[ -n "$LAN_IP" ]] && [[ "$LAN_IP" != "(unknown)" ]]; then
  LAN_URL_LINE="http://${LAN_IP}:${SERVE_PORT}"
else
  LAN_URL_LINE="(LAN IP not detected)"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${GREEN}${BOLD}DEPLOYMENT COMPLETE${NC}                                        ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}${BOLD}URLs:${NC}                                                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    Local:      ${CYAN}http://localhost:${SERVE_PORT}${NC}                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    0.0.0.0:    ${CYAN}http://${BIND_ADDR}:${SERVE_PORT}${NC}                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    LAN:        ${CYAN}${LAN_URL_LINE}${NC}"
echo -e "${GREEN}║${NC}    Tailscale:  ${CYAN}${TS_URL_LINE}${NC}"
echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}${BOLD}Service:${NC}  ${SVC_STATUS}                                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}${BOLD}Health:${NC}   ${CYAN}http://${BIND_ADDR}:${SERVE_PORT}/api/health${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}${BOLD}Logs:${NC}                                                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    stdout:  ${DIM}${LOG_DIR}/stdout.log${NC}              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    stderr:  ${DIM}${LOG_DIR}/stderr.log${NC}              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    deploy:  ${DIM}${LOG_FILE}${NC}               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}${BOLD}Commands:${NC}                                                    ${GREEN}║${NC}"

if $IS_LINUX; then
echo -e "${GREEN}║${NC}    Status:  ${DIM}sudo systemctl status ${SERVICE_NAME}${NC}    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    Stop:    ${DIM}./deploy.sh --stop${NC}                         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    Restart: ${DIM}sudo systemctl restart ${SERVICE_NAME}${NC}  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    Logs:    ${DIM}tail -f ${LOG_DIR}/stdout.log${NC}     ${GREEN}║${NC}"
elif $IS_MAC; then
echo -e "${GREEN}║${NC}    Status:  ${DIM}./deploy.sh --status${NC}                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    Stop:    ${DIM}./deploy.sh --stop${NC}                         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    Logs:    ${DIM}tail -f ${LOG_DIR}/stdout.log${NC}              ${GREEN}║${NC}"
fi

echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${DIM}Full deploy log: ${LOG_FILE}${NC}"
echo ""
