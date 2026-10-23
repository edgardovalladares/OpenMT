# OpenMT DAW Nativo (C++20 + JUCE 8 + Tracktion Engine)

Versión nativa de alto rendimiento del DAW **OpenMT**, reconstruida desde cero para eliminar los problemas de cuelgues (*crashes*), desbordamiento de memoria y limitaciones de rendimiento presentes en la versión Web / Electron.

---

## 🚀 Logros y Rendimiento

| Característica | Versión Anterior (Electron + Web Audio) | Versión Nueva (C++ Nativo + Tracktion Engine) |
| :--- | :--- | :--- |
| **Límite de Canciones** | Se crasheaba con más de 3 canciones | **Ilimitado (Probado para 30+ canciones con setlist)** |
| **Gestión de Memoria** | Decodificación Float32 completa en RAM (~3 GB) | **Direct-From-Disk (DFD): Streaming de 1.5s desde disco** |
| **Consumo de RAM** | 1.5 GB a 4 GB (OOM Crash) | **~60 a 90 MB de RAM estables** |
| **Tamaño de la App** | ~350 MB (Chromium + Node.js) | **18.6 MB (Un solo ejecutable portable)** |
| **Latencia de Audio** | 40 - 60 ms (MME/WASAPI compartido) | **3 - 5 ms (ASIO / WASAPI Exclusive)** |
| **Motor de Audio** | Web Audio API + Wasm (Signalsmith JS) | **Tracktion Engine multihilo optimizado con SIMD** |

---

## 🛠️ Ejecución y Uso

### Iniciar la aplicación
Haz doble clic en:
👉 [`iniciar_openmt_nativo.bat`](file:///c:/Users/PCE/Documents/Proyectos/daw-mt/iniciar_openmt_nativo.bat)

O directamente en el binario compilado:
👉 `native\build\OpenMT_artefacts\Release\OpenMT DAW.exe`

### Funciones Principales:
1. **Agregar Pistas (Stems):**
   * Haz clic en el botón **`+ Pista`** en la barra superior o simplemente **arrastra y suelta** tus archivos de audio (`.wav`, `.mp3`, `.flac`, etc.) sobre la ventana.
2. **Setlist de Canciones:**
   * Usa el botón **`+ Canción`** para añadir temas a tu repertorio.
   * Cambia de canción instantáneamente mediante el selector desplegable.
3. **Secciones de Canción:**
   * Haz clic en **`Auto Secciones`** para generar automáticamente la estructura (Intro, Verso, Coro, etc.) o haz clic en cualquier sección para saltar directamente a ella.
4. **Mezclador y Master:**
   * Tiras de canal individuales con fader de volumen vertical, paneo estéreo, vúmetros en tiempo real, botones de Mute (M), Solo (S) y eliminación.
   * Controles globales en la barra superior para **Tempo (0.5x a 2.0x)**, **Tono (-12 a +12 semitonos)** y **Volumen Master**.

---

## 📦 Compilación Futura
Si realizas modificaciones al código en `native/Source/`, solo necesitas ejecutar:
```powershell
.\native\compilar.bat
```
