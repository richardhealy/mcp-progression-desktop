@echo off
echo Starting MCP Progress Tracker Desktop Application...

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

:: Check if npm dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

:: Start the application
echo Launching application...
npm start 