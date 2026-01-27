@echo off
echo ===================================
echo Leaderboard Manual Verification
echo ===================================
echo.

echo Checking if dev server is running on port 3000...
curl -s http://localhost:3000 > nul
if errorlevel 1 (
    echo [ERROR] Dev server not running on port 3000
    echo Please start the server with: pnpm dev
    exit /b 1
)

echo [OK] Server is running
echo.
echo Starting Playwright tests...
echo.

npx playwright test leaderboard-manual-verification --headed

echo.
echo ===================================
echo Test Complete!
echo ===================================
echo.
echo Screenshots saved to: .playwright-mcp\
echo.
echo To view HTML report:
echo   npx playwright show-report
echo.

pause
