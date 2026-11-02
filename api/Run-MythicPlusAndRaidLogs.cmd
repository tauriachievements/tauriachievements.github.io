@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "MYTHIC_PLUS_DIR=spa/src/mythic-plus-data"
set "RAID_LOGS_DIR=spa/src/raid-log-data"

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
set "MYTHIC_PLUS_FAILED="
set "MYTHIC_PLUS_CHANGED="
set "RAID_LOGS_FAILED="
set "RAID_LOGS_CHANGED="

dotnet run --project "%~dp0MythicPlusExporter" -c Release
if errorlevel 1 (
    set "MYTHIC_PLUS_FAILED=1"
    goto :RaidLogs
)
git -C "%REPO_ROOT%" add -- %MYTHIC_PLUS_DIR%
git -C "%REPO_ROOT%" diff --cached --quiet -- %MYTHIC_PLUS_DIR%
if errorlevel 1 set "MYTHIC_PLUS_CHANGED=1"

:RaidLogs
dotnet run --project "%~dp0RaidLogExporter" -c Release
if errorlevel 1 (
    set "RAID_LOGS_FAILED=1"
    goto :Commit
)
git -C "%REPO_ROOT%" add -- %RAID_LOGS_DIR%
git -C "%REPO_ROOT%" diff --cached --quiet -- %RAID_LOGS_DIR%
if errorlevel 1 set "RAID_LOGS_CHANGED=1"

:Commit
set "PATHS="
set "MESSAGE="
if defined MYTHIC_PLUS_CHANGED (
    set "PATHS=%MYTHIC_PLUS_DIR%"
    set "MESSAGE=sync mythic plus data"
)
if defined RAID_LOGS_CHANGED (
    set "PATHS=%PATHS% %RAID_LOGS_DIR%"
    set "MESSAGE=sync raid logs data"
)
if defined MYTHIC_PLUS_CHANGED if defined RAID_LOGS_CHANGED set "MESSAGE=sync mythic plus and raid logs data"

echo.
if not defined MESSAGE (
    echo No Mythic+ or raid log changes to commit.
    goto :Finish
)

git -C "%REPO_ROOT%" commit --quiet --only -m "%MESSAGE%" -- %PATHS%
if errorlevel 1 (
    echo git commit failed.
    pause
    exit /b 1
)

git -C "%REPO_ROOT%" push --quiet origin main
if errorlevel 1 (
    echo Committed "%MESSAGE%", but the push failed. Run "git push origin main" to retry.
    pause
    exit /b 1
)

echo Committed and pushed "%MESSAGE%"; GitHub Pages is building.

:Finish
if defined MYTHIC_PLUS_FAILED echo MythicPlusExporter failed, so the Mythic+ data was left out. Its error is further up.
if defined RAID_LOGS_FAILED echo RaidLogExporter failed, so the raid log data was left out. Its error is further up.
pause
if defined MYTHIC_PLUS_FAILED exit /b 1
if defined RAID_LOGS_FAILED exit /b 1
exit /b 0
