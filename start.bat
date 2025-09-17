@echo off
echo Starting CRM System...

REM Check if node_modules exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    npm install
    cd ..
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
)

echo.
echo Starting application...
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.

REM Start both backend and frontend
start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application started!
echo Press any key to exit...
pause >nul
