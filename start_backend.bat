@echo off
echo Starting MilkWeb Backend...
cd /d "%~dp0backend"
call .venv\Scripts\activate.bat
python server.py
pause

