@echo off
setlocal

set "OUTPUT_DIR=%~dp0..\spa\src\guild-analysis"
dotnet run --project "%~dp0GuildAnalysisExporter" -- Evermoon Endless --output-directory "%OUTPUT_DIR%"

if errorlevel 1 (
    echo.
    echo GuildAnalysisExporter failed.
    pause
    exit /b 1
)

echo.
echo Export completed in: %OUTPUT_DIR%
pause
