#!/bin/bash
echo "Starting FinGuard AI..."
cd "$(dirname "$0")/.."
python api/run.py &
BACKEND_PID=$!
echo "Backend running at http://localhost:8000 (PID $BACKEND_PID)"
cd frontend && npm run dev &
FRONTEND_PID=$!
echo "Frontend running at http://localhost:5173 (PID $FRONTEND_PID)"
echo "Press Ctrl+C to stop both servers"
trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
