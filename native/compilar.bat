@echo off
title Compilador de OpenMT DAW
echo ===================================================================
echo  Compilando OpenMT DAW Nativo (C++20 + JUCE + Tracktion Engine)
echo ===================================================================
echo.

set CMAKE="%LOCALAPPDATA%\Microsoft\WinGet\Packages\Kitware.CMake_Microsoft.Winget.Source_8wekyb3d8bbwe\cmake-4.4.4-windows-x86_64\bin\cmake.exe"

echo [1/2] Configurando proyecto con CMake y preparando modulos de audio...
%CMAKE% -B build -S .

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo la configuracion de CMake. Verifica que Visual Studio C++ este instalado.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Compilando ejecutable en modo Release...
%CMAKE% --build build --config Release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================================
    echo  COMPILACION EXITOSA!
    echo  El ejecutable optimizado se encuentra en:
    echo  native\build\OpenMT_artefacts\Release\OpenMT.exe
    echo ===================================================================
)

pause
