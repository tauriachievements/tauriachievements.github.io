@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "GIT_REPO=%%~fI"
set "GUILD_ANALYSIS_PROJECT=%~dp0GuildAnalysisExporter"
set "OUTPUT_DIR=%GIT_REPO%\spa\src\guild-analysis"

if not exist "%GUILD_ANALYSIS_PROJECT%\GuildAnalysisExporter.csproj" (
    echo GuildAnalysisExporter project not found:
    echo %GUILD_ANALYSIS_PROJECT%
    pause
    exit /b 1
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
if errorlevel 1 (
    echo Could not create the output directory:
    echo %OUTPUT_DIR%
    pause
    exit /b 1
)

set /a GUILD_COUNT=0

call :ScanGuild "Evermoon" "Competence Optional"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "Miracle"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Tauri" "Outlaws"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "Endless"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "Impaired"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "deeznuts"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "NFA"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "Vistustan"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "Skill Issue"
if errorlevel 1 goto :ScanFailed

call :ScanGuild "Evermoon" "Highly Regarded"
if errorlevel 1 goto :ScanFailed

if %GUILD_COUNT% equ 0 (
    echo No guilds are configured in this script.
    pause
    exit /b 1
)

echo.
echo All %GUILD_COUNT% guild scans completed.
echo JSON files exported to: %OUTPUT_DIR%

echo.
echo Committing guild statistics...
git -C "%GIT_REPO%" add -- "spa/src/guild-analysis"
if errorlevel 1 (
    echo Failed to stage the guild statistics.
    pause
    exit /b 1
)

git -C "%GIT_REPO%" diff --cached --quiet -- "spa/src/guild-analysis"
if not errorlevel 1 (
    echo No guild statistics changed. Nothing to commit or push.
    pause
    exit /b 0
)

git -C "%GIT_REPO%" commit -m "sync guilds statistics" -- "spa/src/guild-analysis"
if errorlevel 1 (
    echo Failed to commit the guild statistics.
    pause
    exit /b 1
)

git -C "%GIT_REPO%" push
if errorlevel 1 (
    echo The commit was created, but the push failed.
    pause
    exit /b 1
)

echo Guild statistics committed and pushed successfully.
pause
exit /b 0

:ScanFailed
echo.
echo A guild scan failed.
pause
exit /b 1

:ScanGuild
set "REALM=%~1"
set "GUILD=%~2"

if not defined REALM exit /b 0
if not defined GUILD (
    echo.
    echo Invalid entry for realm "%REALM%".
    echo Expected format: Realm-Guild Name
    exit /b 1
)

set /a GUILD_COUNT+=1
echo.
echo ============================================================
echo Scanning %REALM% - %GUILD%
echo ============================================================

dotnet run --project "%GUILD_ANALYSIS_PROJECT%" -- "%REALM%" "%GUILD%" --output-directory "%OUTPUT_DIR%"
if errorlevel 1 (
    echo.
    echo GuildAnalysisExporter failed for %REALM% - %GUILD%.
    exit /b 1
)

echo Completed: %REALM% - %GUILD%
exit /b 0
