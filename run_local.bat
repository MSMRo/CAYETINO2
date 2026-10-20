@echo off
title Servidor Local CAYETINO 2 (UV + Web Serial)
color 0B
echo =====================================================================
echo           PROYECTO CAYETINO 2 - JAVASCRIPT & WEB SERIAL (UV)
echo =====================================================================
echo.
echo Iniciando servidor HTTP local con uv...
echo.

where uv >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Utilizando Astral UV para ejecutar el servidor...
    uv run run_server.py
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [Aviso] uv no detectado en PATH, usando Python directo...
    python run_server.py
    goto end
)

echo Abriendo directamente en tu navegador predeterminado...
start index.html

:end
pause
