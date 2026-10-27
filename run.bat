@echo off
title TestPilot AI - Launcher
echo ========================================================
echo         TestPilot AI: RAG Test Gen & Code Fix
echo ========================================================
echo.
echo Starting Backend API Server (FastAPI on http://127.0.0.1:8000)...
start "TestPilot Backend" cmd /k "set PYTHONPATH=%CD% && py -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo Starting Frontend Dev Server (Vite on http://localhost:5173)...
start "TestPilot Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo  TestPilot AI is now running!
echo  Frontend UI:  http://localhost:5173
echo  Backend Docs: http://127.0.0.1:8000/docs
echo ========================================================
pause
