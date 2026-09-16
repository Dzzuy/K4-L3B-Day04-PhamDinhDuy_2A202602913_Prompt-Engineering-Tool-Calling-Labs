#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Dừng các tiến trình cũ trên cổng 8000 và 3000..."
for p in 8000 3000; do
  pid=$(lsof -ti :$p 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
  fi
done

# Xóa cache .next cũ để đảm bảo CSS và chunks đồng bộ 100%
rm -rf "$DIR/web/.next" 2>/dev/null || true

echo "1. Khởi động Backend (FastAPI API)..."
export PYTHONPATH="$DIR/starter_v0"
python3 "$DIR/starter_v0/run_web.py" --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "2. Khởi động Frontend (Next.js App Router trên http://localhost:3000)..."
cd "$DIR/web"
npm run dev
