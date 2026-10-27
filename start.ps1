# TestPilot AI PowerShell Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "        TestPilot AI: RAG Test Gen & Code Fix           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
$env:PYTHONPATH = $WorkspaceRoot

Write-Host "`n[1/2] Starting Backend API Server (http://127.0.0.1:8000)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "`$env:PYTHONPATH='$WorkspaceRoot'; py -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Frontend UI Server (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkspaceRoot\frontend'; npm run dev"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " TestPilot AI is live!" -ForegroundColor Green
Write-Host "  * Web Interface: http://localhost:5173" -ForegroundColor White
Write-Host "  * Backend API:   http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  * Swagger Docs:  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
