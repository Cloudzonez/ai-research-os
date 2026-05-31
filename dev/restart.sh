#!/bin/bash
# Gracefully restart the dev server using Ctrl+C in the tmux session.
# Unlike kill/PID-based approaches, this won't trigger VS Code reconnect.
#
# Usage: ./dev/restart.sh

PROJECT_DIR="/home/philo/Documents/code/AI_Research"

if ! tmux has-session -t dev 2>/dev/null; then
  echo "dev session not running. Starting..."
  exec "$PROJECT_DIR/dev/start.sh"
fi

# Send Ctrl+C to stop the running process gracefully
tmux send-keys -t dev C-c
sleep 1

# Start fresh
tmux send-keys -t dev "NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost npm run dev:all 2>&1 | tee /tmp/dev-all.log" Enter

echo "dev restarted. Attach: ./dev/attach.sh"
