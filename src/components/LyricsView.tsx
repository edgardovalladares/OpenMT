import { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type {
  LyricsTheme,
  LyricsMode,
  LyricsFontSize,
  LyricsSyncMessage,
} from '../types/lyrics';
import { parseLrc, findActiveLyricIndex } from '../utils/lrcParser';
import {
  subscribeLyricsSync,
  getStoredLyricsState,
  requestFullSync,
  isLocalHost,
} from '../audio/lyricsSync';

export function LyricsView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const room = params.get('room') || undefined;

  // Estado sincronizado desde OpenMT con inicialización directa
  const [initialState] = useState(() => getStoredLyricsState());
  const [rawLrc, setRawLrc] = useState(() => initialState.rawLrc ?? '');
  const [offsetMs, setOffsetMs] = useState(() => initialState.offsetMs ?? 350);
  const [position, setPosition] = useState(() => initialState.position ?? 0);

  // Opciones de apariencia sincronizadas desde la app principal (o por defecto desde URL)
  const [theme, setTheme] = useState<LyricsTheme>(() => {
    return (
      (params.get('theme') as LyricsTheme) ||
      (initialState.options?.theme as LyricsTheme) ||
      'transparent'
    );
  });
  const [mode, setMode] = useState<LyricsMode>(() => {
    return (
      (params.get('mode') as LyricsMode) ||
      (initialState.options?.mode as LyricsMode) ||
      'lowerthird'
    );
  });
  const [fontSize, setFontSize] = useState<LyricsFontSize>(() => {
    return (
      (params.get('fontSize') as LyricsFontSize) ||
      (initialState.options?.fontSize as LyricsFontSize) ||
      'large'
    );
  });
  const [uppercase, setUppercase] = useState<boolean>(() => {
    if (params.has('uppercase')) return params.get('uppercase') === 'true';
    return initialState.options?.uppercase ?? false;
  });
  const [showNext, setShowNext] = useState<boolean>(() => {
    if (params.has('showNext')) return params.get('showNext') !== 'false';
    return initialState.options?.showNext ?? true;
  });

  const prompterContainerRef = useRef<HTMLDivElement>(null);

  // Asegurar fondo según el tema configurado para OBS Studio, proyectores y navegadores
  useEffect(() => {
    document.documentElement.classList.add('is-lyrics-view');
    document.body.classList.add('is-lyrics-view');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.classList.add('is-lyrics-view');

    const themeClasses = ['lyrics-theme-transparent', 'lyrics-theme-dark', 'lyrics-theme-black', 'lyrics-theme-chroma-green'];
    document.documentElement.classList.remove(...themeClasses);
    document.body.classList.remove(...themeClasses);
    if (rootEl) rootEl.classList.remove(...themeClasses);

    document.documentElement.classList.add(`lyrics-theme-${theme}`);
    document.body.classList.add(`lyrics-theme-${theme}`);
    if (rootEl) rootEl.classList.add(`lyrics-theme-${theme}`);

    const applyThemeBackground = () => {
      if (theme === 'transparent') {
        document.documentElement.style.setProperty('background', 'transparent', 'important');
        document.documentElement.style.setProperty('background-color', 'transparent', 'important');
        document.body.style.setProperty('background', 'transparent', 'important');
        document.body.style.setProperty('background-color', 'transparent', 'important');
        if (rootEl) {
          rootEl.style.setProperty('background', 'transparent', 'important');
          rootEl.style.setProperty('background-color', 'transparent', 'important');
        }
      } else if (theme === 'chroma-green') {
        document.documentElement.style.setProperty('background', '#00ff00', 'important');
        document.documentElement.style.setProperty('background-color', '#00ff00', 'important');
        document.body.style.setProperty('background', '#00ff00', 'important');
        document.body.style.setProperty('background-color', '#00ff00', 'important');
        if (rootEl) {
          rootEl.style.setProperty('background', '#00ff00', 'important');
          rootEl.style.setProperty('background-color', '#00ff00', 'important');
        }
      } else if (theme === 'black') {
        document.documentElement.style.setProperty('background', '#000000', 'important');
        document.documentElement.style.setProperty('background-color', '#000000', 'important');
        document.body.style.setProperty('background', '#000000', 'important');
        document.body.style.setProperty('background-color', '#000000', 'important');
        if (rootEl) {
          rootEl.style.setProperty('background', '#000000', 'important');
          rootEl.style.setProperty('background-color', '#000000', 'important');
        }
      } else if (theme === 'dark') {
        document.documentElement.style.setProperty('background', '#0b0d10', 'important');
        document.documentElement.style.setProperty('background-color', '#0b0d10', 'important');
        document.body.style.setProperty('background', '#0b0d10', 'important');
        document.body.style.setProperty('background-color', '#0b0d10', 'important');
        if (rootEl) {
          rootEl.style.setProperty('background', '#0b0d10', 'important');
          rootEl.style.setProperty('background-color', '#0b0d10', 'important');
        }
      }
    };

    applyThemeBackground();

    return () => {
      document.documentElement.classList.remove('is-lyrics-view', ...themeClasses);
      document.body.classList.remove('is-lyrics-view', ...themeClasses);
      document.documentElement.style.removeProperty('background');
      document.documentElement.style.removeProperty('background-color');
      document.body.style.removeProperty('background');
      document.body.style.removeProperty('background-color');
      if (rootEl) {
        rootEl.classList.remove('is-lyrics-view', ...themeClasses);
        rootEl.style.removeProperty('background');
        rootEl.style.removeProperty('background-color');
      }
    };
  }, [theme]);

  // Aplicar datos de sincronización recibidos por cualquier canal
  const applySyncData = (msg: Partial<LyricsSyncMessage>) => {
    if (!msg) return;
    if (msg.rawLrc !== undefined) setRawLrc(msg.rawLrc);
    if (msg.offsetMs !== undefined) setOffsetMs(msg.offsetMs);
    if (msg.position !== undefined) setPosition(msg.position);
    if (msg.options) {
      if (msg.options.theme) setTheme(msg.options.theme);
      if (msg.options.mode) setMode(msg.options.mode);
      if (msg.options.fontSize) setFontSize(msg.options.fontSize);
      if (msg.options.uppercase !== undefined) setUppercase(msg.options.uppercase);
      if (msg.options.showNext !== undefined) setShowNext(msg.options.showNext);
    }
  };

  // Solicitar sincronización y escuchar actualizaciones en tiempo real (Local SSE, BroadcastChannel, WebRTC y localStorage)
  useEffect(() => {
    // 1. Cargar estado inicial desde servidor local de Vite de inmediato si está disponible
    if (isLocalHost()) {
      fetch('/api/lyrics/sync')
        .then((r) => r.json())
        .then((data) => {
          if (data) applySyncData(data);
        })
        .catch(() => {});
    }

    // 2. Pedir sincronización completa a OpenMT
    requestFullSync();

    // 3. Suscripción a BroadcastChannel, EventSource (SSE local), y WebRTC DataChannel
    const unsubscribe = subscribeLyricsSync((msg: LyricsSyncMessage) => {
      applySyncData(msg);
    }, room);

    // 4. Polling continuo de localStorage (50ms) como respaldo infalible para ventanas y popups
    let lastTs = 0;
    let lastPos = -1;
    let lastRaw = '';
    const intervalId = setInterval(() => {
      try {
        const stored = getStoredLyricsState();
        if (stored) {
          const ts = stored.timestamp ?? 0;
          const pos = stored.position ?? -1;
          const raw = stored.rawLrc ?? '';
          if (ts !== lastTs || pos !== lastPos || raw !== lastRaw) {
            lastTs = ts;
            lastPos = pos;
            lastRaw = raw;
            applySyncData(stored);
          }
        }
      } catch {
        // ignore
      }
    }, 50);

    // 5. Polling HTTP de respaldo para red local WiFi / LAN
    let lanIntervalId: ReturnType<typeof setInterval> | null = null;
    if (isLocalHost()) {
      lanIntervalId = setInterval(() => {
        fetch('/api/lyrics/sync')
          .then((r) => r.json())
          .then((data) => {
            if (data && data.timestamp && data.timestamp !== lastTs) {
              applySyncData(data);
            }
          })
          .catch(() => {});
      }, 200);
    }

    // Permitir pantalla completa con doble clic o tecla 'F'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      if (lanIntervalId) clearInterval(lanIntervalId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [room]);

  // Parsear líneas de letra
  const lines = useMemo(() => parseLrc(rawLrc), [rawLrc]);

  // Índice de la línea activa
  const activeIdx = useMemo(
    () => findActiveLyricIndex(lines, position, offsetMs),
    [lines, position, offsetMs],
  );

  const activeLine = activeIdx >= 0 && activeIdx < lines.length ? lines[activeIdx] : null;
  const nextLine = activeIdx + 1 < lines.length ? lines[activeIdx + 1] : null;

  // Auto-scroll en modo prompter para mantener la línea activa en el centro
  useEffect(() => {
    if (mode === 'prompter' && prompterContainerRef.current && activeIdx >= 0) {
      const activeEl = document.getElementById(`lyric-line-${activeIdx}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIdx, mode]);

  const handleDoubleClick = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const transformText = (txt: string) => (uppercase ? txt.toUpperCase() : txt);

  return (
    <main
      className={`lyrics-stage lyrics-stage--clean lyrics-stage--${theme} lyrics-stage--${mode} lyrics-stage--font-${fontSize}`}
      onDoubleClick={handleDoubleClick}
      title="Doble clic para pantalla completa (F)"
    >
      {/* Salida limpia sin barras ni botones estorbosos */}
      {lines.length === 0 ? (
        theme !== 'transparent' ? (
          <div className="lyrics-empty">
            <div className="lyrics-empty__card" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <p style={{ margin: 0, opacity: 0.45, fontStyle: 'italic', fontSize: '1rem' }}>Esperando letra…</p>
            </div>
          </div>
        ) : null
      ) : mode === 'prompter' ? (
        /* MODO TELEPROMPTER */
        <div className="lyrics-prompter" ref={prompterContainerRef}>
          <div className="lyrics-prompter__spacer" />
          {lines.map((line, idx) => {
            const isCurrent = idx === activeIdx;
            const isPast = idx < activeIdx;
            return (
              <div
                key={line.id}
                id={`lyric-line-${idx}`}
                className={`lyrics-prompter__line ${isCurrent ? 'lyrics-prompter__line--current' : ''} ${isPast ? 'lyrics-prompter__line--past' : ''}`}
              >
                {line.text ? (
                  transformText(line.text)
                ) : (
                  <span className="lyrics-prompter__instrumental">
                    <Sparkles size={14} style={{ verticalAlign: -1, marginRight: 4 }} />
                    Instrumental
                  </span>
                )}
              </div>
            );
          })}
          <div className="lyrics-prompter__spacer" />
        </div>
      ) : mode === 'lowerthird' ? (
        /* MODO TERCIO INFERIOR (OPTIMIZADO PARA OBS STUDIO) */
        (activeLine?.text || (showNext && nextLine?.text)) ? (
          <div className="lyrics-lowerthird">
            <div className="lyrics-lowerthird__plate">
              {activeLine && activeLine.text ? (
                <div className="lyrics-lowerthird__current">
                  {transformText(activeLine.text)}
                </div>
              ) : activeLine && !activeLine.text ? (
                <div className="lyrics-lowerthird__current">
                  <span className="lyrics-lowerthird__instrumental">
                    <Sparkles size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
                    Instrumental
                  </span>
                </div>
              ) : null}

              {showNext && nextLine && nextLine.text && (
                <div className="lyrics-lowerthird__next">
                  {transformText(nextLine.text)}
                </div>
              )}
            </div>
          </div>
        ) : null
      ) : (
        /* MODO PANTALLA COMPLETA / AUDITORIO */
        (activeLine?.text || (showNext && nextLine?.text)) ? (
          <div className="lyrics-fullscreen">
            <div className="lyrics-fullscreen__content">
              {activeLine && activeLine.text ? (
                <div className="lyrics-fullscreen__current">
                  {transformText(activeLine.text)}
                </div>
              ) : activeLine && !activeLine.text ? (
                <div className="lyrics-fullscreen__current">
                  <span className="lyrics-fullscreen__instrumental">
                    <Sparkles size={20} style={{ verticalAlign: -2, marginRight: 8 }} />
                    Instrumental
                  </span>
                </div>
              ) : null}

              {showNext && nextLine && nextLine.text && (
                <div className="lyrics-fullscreen__next">
                  {transformText(nextLine.text)}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}
    </main>
  );
}
