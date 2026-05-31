#!/bin/bash
# Start the dev server in a dedicated tmux session called "dev".
# Safe for VS Code Remote SSH: uses SIGINT (Ctrl+C) for restart, never kill.
#
# Usage:
#   ./dev/start.sh        # Start fresh
#   ./dev/restart.sh      # Restart gracefully

PROJECT_DIR="/home/philo/Documents/code/AI_Research"
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost

if tmux has-session -t dev 2>/dev/null; then
  echo "dev session already exists. Use ./dev/restart.sh or ./dev/attach.sh"
  exit 1
fi

tmux new-session -d -s dev -c "$PROJECT_DIR" \
  "NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost npm run dev:all 2>&1 | tee /tmp/dev-all.log"

sleep 2
echo "dev session started. Attach: ./dev/attach.sh   Logs: tmux capture-pane -t dev -p | tail"
