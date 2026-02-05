@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  EXPEDITION - Development Server
echo ============================================
echo.

set PORT=8080
set DEBUG_URL=http://localhost:%PORT%?debug=true

:: Check for Python 3
where python >nul 2>nul
if %errorlevel%==0 (
    python --version 2>&1 | findstr /C:"Python 3" >nul
    if !errorlevel!==0 (
        echo [OK] Found Python 3
        echo [INFO] Starting server on port %PORT%...
        echo [INFO] Debug URL: %DEBUG_URL%
        echo.
        echo [LOG] Server output:
        echo --------------------------------------------

        :: Open browser after short delay
        start "" cmd /c "timeout /t 2 /nobreak >nul && start %DEBUG_URL%"

        :: Start Python HTTP server with logging
        python -m http.server %PORT% 2>&1
        goto :end
    )
)

:: Check for Python (might be Python 3 on some systems)
where py >nul 2>nul
if %errorlevel%==0 (
    echo [OK] Found Python launcher
    echo [INFO] Starting server on port %PORT%...
    echo [INFO] Debug URL: %DEBUG_URL%
    echo.
    echo [LOG] Server output:
    echo --------------------------------------------

    :: Open browser after short delay
    start "" cmd /c "timeout /t 2 /nobreak >nul && start %DEBUG_URL%"

    :: Start Python HTTP server with logging
    py -3 -m http.server %PORT% 2>&1
    goto :end
)

:: Check for Node.js
where node >nul 2>nul
if %errorlevel%==0 (
    where npx >nul 2>nul
    if !errorlevel!==0 (
        echo [OK] Found Node.js
        echo [INFO] Starting server on port %PORT%...
        echo [INFO] Debug URL: %DEBUG_URL%
        echo.
        echo [LOG] Server output:
        echo --------------------------------------------

        :: Open browser after short delay
        start "" cmd /c "timeout /t 2 /nobreak >nul && start %DEBUG_URL%"

        :: Use npx to run a simple server (http-server or serve)
        npx --yes http-server -p %PORT% -c-1 --log-ip 2>&1
        goto :end
    )
)

:: No server found
echo [ERROR] No suitable server found!
echo.
echo Please install one of the following:
echo   - Python 3: https://www.python.org/downloads/
echo   - Node.js:  https://nodejs.org/
echo.
pause
goto :end

:end
echo.
echo [INFO] Server stopped.
pause
