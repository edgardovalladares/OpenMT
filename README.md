# WebDAW

Reproductor y mezclador multipista estilo Ableton Live que se ejecuta **100 % en el navegador** utilizando Web Audio API, Signalsmith Stretch (WASM / AudioWorklet) y Web Workers para análisis espectral (BPM y tonalidad).

## Características

- **Multipista (hasta 8 pistas)**: Soporte para MP3, WAV, FLAC, OGG, M4A/AAC y Opus.
- **Detección en Web Worker**: Detección de BPM (flujo espectral + autocorrelación) y tonalidad (cromagrama + perfiles Krumhansl-Schmuckler) en un hilo independiente sin bloquear la interfaz.
- **Time-Stretch y Pitch-Shift independientes**: Impulsado por [Signalsmith Stretch](https://signalsmith-audio.co.uk/code/stretch/), con opción **Key Lock** para mantener el tono o simular reproducción estilo vinilo.
- **Mezclador profesional**:
  - Curva de fader analógica de -60 dB a +6 dB con punto de unity (0 dB).
  - Medidores L/R estéreo dibujados en `<canvas>` mediante un único bucle centralizado de `requestAnimationFrame` a 60 fps con peak-hold y detección de clip.
  - Limitador en el canal Master para protección de señal.
  - Vistas flexibles: faders abajo (Session) o faders a la izquierda (Arrangement).
- **3 temas visuales**: Live Dark, Live Light y Live Neon.
- **Transporte y atajos**: Barra espaciadora para reproducir/pausar, clic en la regla u onda para seek, Home para reiniciar.
- **100 % del lado del cliente**: Ningún audio ni dato personal se envía a ningún servidor.

## Scripts disponibles

```bash
# Desarrollo local (http://localhost:5173)
npm run dev

# Ejecutar pruebas unitarias
npm test

# Construcción estricta para producción
npm run build

# Previsualizar build de producción
npm run preview
```

## Despliegue en Vercel

El proyecto incluye la configuración [`vercel.json`](file:///./vercel.json) con cabeceras de seguridad CSP optimizadas para WebAssembly y Web Workers (`worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval' blob:`).
