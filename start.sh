#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend/index.html"
BACKEND_PORT=3000

# ── colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}[reverse-mafia]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

# ── cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  log "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# ── 1. Install backend deps if needed ─────────────────────────────────────────
if [ ! -d "$BACKEND/node_modules" ]; then
  log "Installing backend dependencies..."
  (cd "$BACKEND" && npm install --silent)
  ok "Dependencies installed"
fi

# ── 2. Ollama ─────────────────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  if ! pgrep -x ollama &>/dev/null; then
    log "Starting Ollama..."
    ollama serve &>/tmp/ollama.log &
    PIDS+=($!)
    sleep 2
    ok "Ollama started"
  else
    ok "Ollama already running"
  fi

  # Pull default model if missing
  MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
  if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    log "Pulling model $MODEL (this takes a few minutes the first time)..."
    ollama pull "$MODEL"
    ok "Model ready"
  else
    ok "Model $MODEL already downloaded"
  fi
else
  warn "Ollama not found — using Anthropic API if ANTHROPIC_API_KEY is set"
  warn "Install Ollama from https://ollama.com if you want local AI"
fi

# ── 3. Start backend ──────────────────────────────────────────────────────────
log "Starting backend on port $BACKEND_PORT..."
(cd "$BACKEND" && node server.js) &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

# Wait until backend responds
TRIES=0
until curl -s "http://localhost:$BACKEND_PORT/health" &>/dev/null; do
  sleep 0.5
  TRIES=$((TRIES + 1))
  if [ $TRIES -gt 20 ]; then
    err "Backend did not start in time. Check logs."
    exit 1
  fi
done
ok "Backend running at http://localhost:$BACKEND_PORT"

# ── 4. Open frontend ──────────────────────────────────────────────────────────
log "Opening game in browser..."
if command -v open &>/dev/null; then          # macOS
  open "$FRONTEND"
elif command -v xdg-open &>/dev/null; then    # Linux
  xdg-open "$FRONTEND"
elif command -v start &>/dev/null; then       # Windows (Git Bash)
  start "$FRONTEND"
else
  warn "Could not open browser automatically. Open this file manually:"
  warn "$FRONTEND"
fi

ok "Game is running! Share frontend/index.html with other players."
echo ""
echo -e "  ${CYAN}Frontend:${NC} $FRONTEND"
echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo -e "  ${CYAN}Stop:${NC}     Ctrl+C"
echo ""

# ── 5. Keep running ───────────────────────────────────────────────────────────
wait $BACKEND_PID
