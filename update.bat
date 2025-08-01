@echo off
REM Navigate to the directory where this script is located
cd /d "%~dp0"

REM Check if this is a git repository by looking for .git folder
if not exist ".git" (
    echo No git repository found here.
    echo Cloning repository...
    git clone https://github.com/ck4445/RealOpenAI .
    if errorlevel 1 (
        echo Cloning failed. Exiting.
        pause
        exit /b 1
    )
) else (
    REM Discard any local changes
    git reset --hard

    REM Clean untracked files and folders
    git clean -fd

    REM Pull latest changes from origin main
    git pull origin main
    if errorlevel 1 (
        echo Pull failed. Exiting.
        pause
        exit /b 1
    )
)

echo Update complete.
pause
