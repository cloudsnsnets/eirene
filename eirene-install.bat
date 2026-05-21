@echo off
setlocal enabledelayedexpansion
title Eirene Installer

echo.
echo   EIRENE
echo   Private browsing. Ad-free. Your voice.
echo.

:: Check Docker Desktop
docker --version >nul 2>&1
if errorlevel 1 (
    echo   Docker Desktop not found.
    echo.
    echo   Please install Docker Desktop first:
    echo   https://www.docker.com/products/docker-desktop/
    echo.
    start "" "https://www.docker.com/products/docker-desktop/"
    pause
    exit /b 1
)

echo   Docker found. Launching setup in WSL...
echo.

:: Check WSL
wsl --status >nul 2>&1
if errorlevel 1 (
    echo   WSL2 not available. Docker Desktop should have installed it.
    echo   Try restarting your computer and running this again.
    pause
    exit /b 1
)

:: Run setup in WSL
wsl bash -c "curl -sSL https://eirene.run.place/setup | bash"

echo.
pause
