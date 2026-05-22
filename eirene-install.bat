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

:: Check for Ubuntu WSL distro, install if missing
wsl -d Ubuntu --exec echo ok 2>nul | findstr /c:"ok" >nul
if not %errorlevel% == 0 (
    echo   Ubuntu not found. Installing...
    echo.
    wsl --install -d Ubuntu --no-launch
    echo.
    echo   Ubuntu installed.
    echo   Please restart your computer and run this installer again.
    echo.
    pause
    exit /b 0
)

:: Run setup in Ubuntu
wsl -d Ubuntu bash -c "curl -sSL https://eirene.run.place/setup | bash"

echo.
pause
