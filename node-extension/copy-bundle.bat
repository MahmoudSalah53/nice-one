@echo off
REM Helper script to copy the bundles to the extension folder

set FRONTEND_DIR=..
set EXTENSION_DIR=.

echo Copying bundles to extension...

REM Check if frontend directory exists
if not exist "%FRONTEND_DIR%" (
    echo Error: Frontend directory not found at %FRONTEND_DIR%
    exit /b 1
)

REM Check if embed-popup bundle exists
if not exist "%FRONTEND_DIR%\public\embed-popup.js" (
    echo Error: embed-popup.js not found. Please build it first:
    echo   cd %FRONTEND_DIR% ^&^& pnpm build-embed-popup-script
    exit /b 1
)

REM Copy embed-popup bundle
copy "%FRONTEND_DIR%\public\embed-popup.js" "%EXTENSION_DIR%\" >nul
echo Copied embed-popup.js

REM Copy embed-popup source map if it exists
if exist "%FRONTEND_DIR%\public\embed-popup.js.map" (
    copy "%FRONTEND_DIR%\public\embed-popup.js.map" "%EXTENSION_DIR%\" >nul
    echo Copied embed-popup.js.map
)

REM Copy page-automation bundle (for iframe mode)
if exist "%FRONTEND_DIR%\public\page-automation.js" (
    copy "%FRONTEND_DIR%\public\page-automation.js" "%EXTENSION_DIR%\" >nul
    echo Copied page-automation.js
) else (
    echo Warning: page-automation.js not found
)

REM Copy page-automation source map if it exists
if exist "%FRONTEND_DIR%\public\page-automation.js.map" (
    copy "%FRONTEND_DIR%\public\page-automation.js.map" "%EXTENSION_DIR%\" >nul
    echo Copied page-automation.js.map
)

echo Done! Bundles copied successfully.



