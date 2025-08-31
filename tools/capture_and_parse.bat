
@echo off
REM Visible capture mode to bypass 403/anti-bot
REM Usage:
REM   tools\capture_and_parse.bat https://albiononline.com/characterbuilder/solo-builds/view/199739

set URL=%1
if "%URL%"=="" (
  echo Usage: tools\capture_and_parse.bat ^<CharacterBuilderURL^>
  exit /b 1
)

pushd %~dp0
cd ..\
python tools\capture_build.py --url %URL%
popd
pause
