#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$DIR/.backend.pid" ]; then
  kill $(cat "$DIR/.backend.pid") 2>/dev/null || true
  rm -f "$DIR/.backend.pid"
fi
if [ -f "$DIR/.frontend.pid" ]; then
  kill $(cat "$DIR/.frontend.pid") 2>/dev/null || true
  rm -f "$DIR/.frontend.pid"
fi

# Kill any remaining listeners on ports 8000 and 3000
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

echo "All services stopped."
