@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "DATA_FILES=spa/src/rated-bg-roster.json api/AchievementLadder/Data/rated-bg-players.txt"

for /f "delims=" %%b in ('git -C "%REPO_ROOT%" rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if /i "%BRANCH%"=="main" goto :OnMain

echo Current branch is "%BRANCH%".
for /f %%s in ('git -C "%REPO_ROOT%" status --porcelain') do (
    echo It has uncommitted changes, so it can't switch to main. Commit or stash them first.
    pause
    exit /b 1
)
set "CHOICE="
set /p "CHOICE=Type 1 and press Enter to switch to main and continue, or just press Enter to stop: "
if not "%CHOICE%"=="1" exit /b 1
(
    git -C "%REPO_ROOT%" checkout --quiet main
    if errorlevel 1 (
        echo.
        echo git checkout main failed.
        pause
        exit /b 1
    )
    "%~f0" %*
)

:OnMain
git -C "%REPO_ROOT%" fetch --quiet origin main
if errorlevel 1 (
    echo.
    echo git fetch failed.
    pause
    exit /b 1
)

for /f %%n in ('git -C "%REPO_ROOT%" rev-list --count HEAD..origin/main') do set "BEHIND=%%n"
if "%BEHIND%"=="0" goto :Export

echo main is %BEHIND% commit(s) behind origin/main, so the push would be rejected.
set "CHOICE="
set /p "CHOICE=Type 1 and press Enter to pull and continue, or just press Enter to stop: "
if not "%CHOICE%"=="1" exit /b 1
(
    git -C "%REPO_ROOT%" pull --quiet --ff-only origin main
    if errorlevel 1 (
        echo.
        echo git pull failed.
        pause
        exit /b 1
    )
    "%~f0" %*
)

:Export
dotnet run --project "%~dp0RatedBgRosterExporter" -c Release -- %*
if errorlevel 1 (
    echo.
    echo RatedBgRosterExporter failed. Nothing was committed.
    pause
    exit /b 1
)

git -C "%REPO_ROOT%" add -- %DATA_FILES%
git -C "%REPO_ROOT%" diff --cached --quiet -- %DATA_FILES%
if not errorlevel 1 (
    echo.
    echo No rated BG roster changes to commit.
    pause
    exit /b 0
)

git -C "%REPO_ROOT%" commit --quiet --only -m "sync rated bg roster data" -- %DATA_FILES%
if errorlevel 1 (
    echo.
    echo git commit failed.
    pause
    exit /b 1
)

git -C "%REPO_ROOT%" push --quiet origin main
if errorlevel 1 (
    echo.
    echo Committed "sync rated bg roster data", but the push failed. Run "git push origin main" to retry.
    pause
    exit /b 1
)

echo.
echo Committed and pushed "sync rated bg roster data"; GitHub Pages is building.
pause
