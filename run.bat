@echo off
setlocal

REM Start the Broadloom React web app (Vite dev server)
REM Location: react-app/

cd /d "%~dp0react-app"

if not exist "node_modules" (
  echo Installing dependencies...
  npm install --no-fund --no-audit
)

echo Starting dev server on http://localhost:5173
start "" http://localhost:5173/
npm run dev -- --host

endlocal

