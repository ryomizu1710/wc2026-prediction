@echo off
title W杯2026予想大会サーバー
cd /d "%~dp0"
echo ==========================================
echo   FIFA W杯 2026 優勝予想大会サーバー
echo ==========================================
echo.
echo ブラウザで http://localhost:3000 を開いてください
echo このウィンドウを閉じるとサーバーが停止します
echo.
node server.js
pause
