#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=================================================="
echo " Starting PII Guard Servers..."
echo "=================================================="

for p in 8000 3000; do
  pid=$(lsof -ti :$p 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
  fi
done

echo "1. Starting Backend (FastAPI on http://127.0.0.1:8000)..."
export PYTHONPATH="$DIR/starter_v0"
python3 "$DIR/starter_v0/run_web.py" --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "2. Starting Frontend (Next.js on http://localhost:3000)..."
cd "$DIR/web"
./node_modules/.bin/next start -p 3000
