@echo off
title Instalador C++ para OpenMT
echo ===================================================================
echo  Instalador de Herramientas de Compilacion C++ (Visual Studio 2022)
echo ===================================================================
echo.
echo Se solicitara permiso de administrador para instalar el compilador C++ (MSVC).
echo Por favor pulsa "Si" en la ventana de confirmacion de Windows (UAC).
echo.
powershell -Command "Start-Process 'C:\Users\PCE\AppData\Local\Temp\WinGet\Microsoft.VisualStudio.2022.BuildTools.17.14.42\vs_BuildTools.exe' -ArgumentList '--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended' -Verb RunAs"
pause
