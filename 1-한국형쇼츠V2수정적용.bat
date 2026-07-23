@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-korean-shorts-v2-fix.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo 수정 적용에 실패했으며 이번 변경은 자동 복구되었습니다.
  echo 프로젝트 폴더의 korean-shorts-v2-build-날짜.log 파일을 확인하세요.
  pause
  exit /b %RESULT%
)
echo 수정 적용과 빌드가 성공했습니다.
echo GitHub Desktop에서 Commit 후 Push하세요.
pause
