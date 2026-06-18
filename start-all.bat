@echo off
title DIRECTO - Iniciando servicios...

echo ========================================
echo   DIRECTO - Iniciando todos los servicios
echo ========================================
echo.

echo [1/3] Iniciando API (NestJS) en puerto 3000...
start "DIRECTO - API" cmd /k "cd /d D:\Trabajo\Proyecto2\apps\api && npm run start:dev"

echo [2/3] Iniciando Admin (Vite) en puerto 5173...
start "DIRECTO - Admin" cmd /k "cd /d D:\Trabajo\Proyecto2\apps\admin && npm run dev"

echo [3/3] Iniciando Mobile (Expo) ...
start "DIRECTO - Mobile" cmd /k "cd /d D:\Trabajo\Proyecto2\apps\mobile && npm start"

echo.
echo ========================================
echo   Todos los servicios iniciados!
echo.
echo   API:    http://localhost:3000/api
echo   Admin:  http://localhost:5173
echo   Mobile: Expo DevTools (ver consola)
echo ========================================
echo.
echo Puedes cerrar esta ventana.
pause
