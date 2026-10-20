@echo off
setlocal
title Flasheador ESP32 - Cayetino Firmware
color 0B

echo ========================================================================
echo         PROYECTO CAYETINO - FLASHEADOR AUTOMATICO ESP32
echo ========================================================================
echo.
echo Iniciando proceso de deteccion y flasheo desde la carpeta firmware...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0firmware\flash_esp32.ps1" %*

endlocal
