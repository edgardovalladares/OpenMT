import { useState, useRef, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  FileText,
  Upload,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Trash2,
  Tv,
  Sliders,
  Clock,
  CheckCircle2,
  Globe,
  Lightbulb,
  X,
  List,
  Lock,
  Unlock,
  RotateCcw,
  Smartphone,
  Wifi,
  ShieldCheck,
  Eye,
  Download,
} from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { parseLrc, SAMPLE_LRC } from '../utils/lrcParser';
import {
  setActiveRoom,
  getPersistentRoom,
  isRoomLocked,
  setRoomLocked,
  regeneratePersistentRoom,
} from '../audio/lyricsSync';
import { isTauri, tauriGetLanInfo } from '../audio/tauriBridge';
import type { ElectronLanInfo } from '../types/electron';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type LyricsTab = 'edit' | 'display' | 'broadcast';

export function LyricsModal({ isOpen, onClose }: Props) {
  const lyrics = useDaw((s) => s.lyrics);
  const options = useDaw((s) => s.lyricsOptions);
  const { setLyrics, setLyricsOffset, setLyricsOptions, clearLyrics } = useDaw.getState();

  const [activeTab, setActiveTab] = useState<LyricsTab>('edit');
  const [text, setText] = useState(lyrics.rawLrc);
  const [offset, setOffset] = useState(lyrics.offsetMs);
  const [prevLrc, setPrevLrc] = useState(lyrics.rawLrc);

  // Sincronizar estado cuando cambie la letra o canción activa en el DAW
  if (lyrics.rawLrc !== prevLrc) {
    setPrevLrc(lyrics.rawLrc);
    setText(lyrics.rawLrc);
    setOffset(lyrics.offsetMs);
  }

  // Estados de retroalimentación de copia
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);

  // Sala persistente y bloqueo
  const [roomCode, setRoomCode] = useState<string>(() => getPersistentRoom());
  const [isLocked, setIsLockedState] = useState<boolean>(() => isRoomLocked());

  // Red local desde Tauri o Electron (si está corriendo como app de escritorio en PC)
  const isDesktop = typeof window !== 'undefined' && (Boolean(window.electronAPI?.isElectron) || isTauri());
  const [lanInfo, setLanInfo] = useState<ElectronLanInfo | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [customIp, setCustomIp] = useState<string>('');

  // Destino del Código QR
  const [qrTarget, setQrTarget] = useState<'mobile-prompter' | 'obs' | 'remote'>('mobile-prompter');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedLines = useMemo(() => parseLrc(text), [text]);

  // Obtener información LAN de Tauri o Electron
  useEffect(() => {
    if (isTauri()) {
      tauriGetLanInfo()
        .then((info) => {
          if (info && (info.localUrl || info.ips?.length)) {
            setLanInfo(info);
            if (info.ips?.length && !selectedIp) {
              setSelectedIp(info.ips[0]);
            }
          }
        })
        .catch((err) => console.warn('Error obteniendo info LAN de Tauri:', err));
    } else if (typeof window !== 'undefined' && window.electronAPI?.getLanInfo) {
      window.electronAPI
        .getLanInfo()
        .then((info) => {
          if (info && (info.localUrl || info.ips?.length)) {
            setLanInfo(info);
            if (info.ips?.length && !selectedIp) {
              setSelectedIp(info.ips[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [selectedIp]);

  // Asegurar sala activa
  useEffect(() => {
    if (roomCode) {
      setActiveRoom(roomCode);
    }
  }, [roomCode]);

  // Alternar bloqueo de enlace
  const handleToggleLock = () => {
    const nextLocked = !isLocked;
    setIsLockedState(nextLocked);
    setRoomLocked(nextLocked);
  };

  // Regenerar sala
  const handleRegenerateRoom = () => {
    if (isLocked) {
      alert(
        'El enlace está protegido para evitar desconfigurar OBS. Desbloquéalo primero si deseas generar una nueva sala.'
      );
      return;
    }
    if (
      window.confirm(
        '¿Deseas regenerar el enlace global de letras? Si ya configuraste OBS o conectaste celulares, deberás actualizar el nuevo enlace o QR.'
      )
    ) {
      const newRoom = regeneratePersistentRoom();
      setRoomCode(newRoom);
      setActiveRoom(newRoom);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? '');
      setText(content);
      setLyrics(content, offset);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    setLyrics(text, offset);
    onClose();
  };

  const handleApplyOffset = (newOffset: number) => {
    setOffset(newOffset);
    setLyricsOffset(newOffset);
  };

  // Host activo para conexiones LAN (WiFi y Cable)
  const currentHost = useMemo(() => {
    const ip = customIp.trim() || selectedIp || lanInfo?.ips?.[0] || '127.0.0.1';
    const port = lanInfo?.port || 3000;
    return `http://${ip}:${port}`;
  }, [customIp, selectedIp, lanInfo]);

  // Generador centralizado de URLs adaptado a Desktop vs Web
  const generateLocalObsUrl = () => {
    const port = lanInfo?.port || 3000;
    const origin = isDesktop ? `http://localhost:${port}` : window.location.origin;
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams({
      view: 'lyrics',
      room: roomCode,
      theme: options.theme,
      mode: options.mode,
      fontSize: options.fontSize,
      uppercase: String(options.uppercase),
      showNext: String(options.showNext),
      textShadow: String(Boolean(options.textShadow)),
    });
    return `${origin}${pathname}?${searchParams.toString()}`;
  };

  const generateLanObsUrl = () => {
    const origin = isDesktop ? currentHost : window.location.origin;
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams({
      view: 'lyrics',
      room: roomCode,
      theme: options.theme,
      mode: options.mode,
      fontSize: options.fontSize,
      uppercase: String(options.uppercase),
      showNext: String(options.showNext),
      textShadow: String(Boolean(options.textShadow)),
    });
    return `${origin}${pathname}?${searchParams.toString()}`;
  };

  const generateLanPrompterUrl = () => {
    const origin = isDesktop ? currentHost : window.location.origin;
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams({
      view: 'lyrics',
      room: roomCode,
      theme: options.theme === 'transparent' ? 'dark' : options.theme,
      mode: 'prompter',
      fontSize: options.fontSize,
      uppercase: String(options.uppercase),
      showNext: String(options.showNext),
      textShadow: String(Boolean(options.textShadow)),
    });
    return `${origin}${pathname}?${searchParams.toString()}`;
  };

  const generateRemoteUrl = () => {
    const origin = isDesktop ? 'https://openmt.vercel.app' : window.location.origin;
    const pathname = isDesktop ? '/' : window.location.pathname;
    const searchParams = new URLSearchParams({
      view: 'lyrics',
      room: roomCode,
      theme: options.theme,
      mode: options.mode,
      fontSize: options.fontSize,
      uppercase: String(options.uppercase),
      showNext: String(options.showNext),
    });
    return `${origin}${pathname}?${searchParams.toString()}`;
  };

  const buildLyricsUrl = (target: 'mobile-prompter' | 'obs' | 'remote') => {
    if (target === 'mobile-prompter') return generateLanPrompterUrl();
    if (target === 'obs') return isDesktop ? generateLanObsUrl() : generateLocalObsUrl();
    return generateRemoteUrl();
  };

  // URL activa para el Código QR
  const currentQrUrl = useMemo(() => {
    return buildLyricsUrl(qrTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrTarget, roomCode, currentHost, lanInfo?.port, options.theme, options.mode, options.fontSize, options.uppercase, options.showNext]);

  // Generar Código QR automáticamente
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(currentQrUrl, {
      width: 150,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('Error generando QR:', err);
      });

    return () => {
      active = false;
    };
  }, [currentQrUrl]);

  // Acciones de copiado al portapapeles
  const copyToClipboard = async (url: string, setCopied: (v: boolean) => void) => {
    setLyrics(text, offset);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copia este enlace:', url);
    }
  };

  const handleCopyLocalLink = () => {
    copyToClipboard(generateLocalObsUrl(), setCopiedLocal);
  };

  const handleCopyQrUrl = () => {
    copyToClipboard(currentQrUrl, setCopiedQr);
  };

  const handleOpenPopup = () => {
    setLyrics(text, offset);
    const url = generateLocalObsUrl();
    window.open(url, 'OpenMT_Lyrics', 'width=1000,height=600,menubar=no,toolbar=no,location=no');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--wide lyrics-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lyrics-modal-title"
      >
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: 'var(--accent)' }} />
            <h2 id="lyrics-modal-title" className="modal__title">
              Letras Sincronizadas (LRC / OBS Studio / Red Local)
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* 3 Pestañas Principales y Limpias */}
        <div className="lyrics-modal__tabs">
          <button
            type="button"
            className={`lyrics-modal__tab ${activeTab === 'edit' ? 'lyrics-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <Sliders size={13} />
            <span>1. Cargar y Calibrar Letra</span>
          </button>
          <button
            type="button"
            className={`lyrics-modal__tab ${activeTab === 'display' ? 'lyrics-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('display')}
          >
            <Eye size={13} />
            <span>2. Diseño y Vista Previa</span>
          </button>
          <button
            type="button"
            className={`lyrics-modal__tab ${activeTab === 'broadcast' ? 'lyrics-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('broadcast')}
          >
            <Tv size={13} />
            <span>3. Transmisión, Enlaces y QR</span>
          </button>
        </div>

        <div className="modal__body">
          {/* SECCIÓN 1: Cargar y Calibrar Letra */}
          {activeTab === 'edit' && (
            <div className="lyrics-editor-grid">
              {/* Columna Izquierda: Editor de texto y acciones */}
              <div className="lyrics-editor-left">
                <div className="lyrics-editor-tab__top">
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept=".lrc,.txt"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    className="btn btn--accent"
                    onClick={() => fileInputRef.current?.click()}
                    title="Subir archivo .lrc o .txt desde tu equipo"
                  >
                    <Upload size={14} />
                    <span>Subir archivo .lrc</span>
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setText(SAMPLE_LRC);
                      setLyrics(SAMPLE_LRC, offset);
                    }}
                    title="Cargar plantilla de letra de ejemplo"
                  >
                    <Sparkles size={14} />
                    <span>Insertar plantilla de prueba</span>
                  </button>

                  {text && (
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        if (window.confirm('¿Deseas borrar la letra cargada de esta canción?')) {
                          setText('');
                          clearLyrics();
                        }
                      }}
                      title="Borrar toda la letra"
                      style={{ marginLeft: 'auto' }}
                    >
                      <Trash2 size={13} />
                      <span>Borrar</span>
                    </button>
                  )}
                </div>

                {/* Textarea */}
                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label" htmlFor="lrc-textarea">
                    Contenido LRC de la canción actual (formato estándar <code>[mm:ss.xx] Letra</code>):
                  </label>
                  <textarea
                    id="lrc-textarea"
                    className="text-input lyrics-modal__textarea"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setLyrics(e.target.value, offset);
                    }}
                    placeholder="[00:12.50] Escribe o pega aquí la letra con marcas de tiempo...&#10;[00:18.00] Cada línea se sincronizará automáticamente con el audio."
                    rows={10}
                    spellCheck={false}
                  />
                </div>

                {/* Estadísticas */}
                <div className="lyrics-modal__stats">
                  <span>
                    Líneas detectadas: <strong>{parsedLines.length}</strong>
                  </span>
                  {parsedLines.length > 0 && (
                    <span style={{ marginLeft: 12 }}>
                      Duración cubierta: <strong>{parsedLines[0]?.time.toFixed(1)}s</strong> a{' '}
                      <strong>{parsedLines[parsedLines.length - 1]?.time.toFixed(1)}s</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Calibración y Previsualización de versos */}
              <div className="lyrics-editor-right">
                {/* Calibración de timing */}
                <div className="lyrics-timing-card">
                  <div className="lyrics-timing-card__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={15} style={{ color: 'var(--accent)' }} />
                      <strong style={{ fontSize: 12 }}>Calibración de Sincronización (Timing)</strong>
                    </div>
                    <div className="lyrics-timing-card__badge">
                      Offset:{' '}
                      <strong>
                        {offset > 0 ? `+${offset} ms (retrasada)` : offset < 0 ? `${offset} ms (adelantada)` : '0 ms'}
                      </strong>
                    </div>
                  </div>

                  <p className="lyrics-timing-card__desc">
                    <Lightbulb size={13} style={{ color: 'var(--accent)', verticalAlign: -2, marginRight: 5, display: 'inline-block' }} />
                    Si la letra <strong>aparece antes</strong> de que el cantante pronuncie la frase, selecciona un retraso de <strong>+300ms a +500ms</strong> para compensar la articulación vocal.
                  </p>

                  <div className="lyrics-timing-card__presets">
                    <button
                      type="button"
                      className={`btn btn--tiny ${offset === 300 ? 'btn--accent' : ''}`}
                      onClick={() => handleApplyOffset(300)}
                      title="Compensación recomendada para latencia de audio"
                    >
                      +300 ms
                    </button>
                    <button
                      type="button"
                      className={`btn btn--tiny ${offset === 500 ? 'btn--accent' : ''}`}
                      onClick={() => handleApplyOffset(500)}
                      title="Recomendado para canto natural"
                    >
                      +500 ms (Voz)
                    </button>
                    <button
                      type="button"
                      className={`btn btn--tiny ${offset === 800 ? 'btn--accent' : ''}`}
                      onClick={() => handleApplyOffset(800)}
                      title="Retraso de 800 milisegundos"
                    >
                      +800 ms
                    </button>
                    <button
                      type="button"
                      className={`btn btn--tiny ${offset === 1000 ? 'btn--accent' : ''}`}
                      onClick={() => handleApplyOffset(1000)}
                      title="Retraso de 1 segundo completo"
                    >
                      +1.0 s
                    </button>
                    <button
                      type="button"
                      className={`btn btn--tiny ${offset === 0 ? 'btn--accent' : ''}`}
                      onClick={() => handleApplyOffset(0)}
                      title="Sin retraso ni adelanto (0 ms)"
                    >
                      0 ms
                    </button>
                    <button
                      type="button"
                      className={`btn btn--tiny ${offset === -300 ? 'btn--accent' : ''}`}
                      onClick={() => handleApplyOffset(-300)}
                      title="Adelantar 300 ms"
                    >
                      -300 ms
                    </button>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn--tiny"
                        onClick={() => handleApplyOffset(offset - 50)}
                        title="Adelantar 50ms"
                      >
                        -50ms
                      </button>
                      <button
                        type="button"
                        className="btn btn--tiny"
                        onClick={() => handleApplyOffset(offset + 50)}
                        title="Retrasar 50ms"
                      >
                        +50ms
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de versos detectados */}
                <div className="lyrics-parsed-card">
                  <div className="lyrics-parsed-card__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <List size={13} style={{ color: 'var(--accent)' }} />
                      <strong>Versos Detectados ({parsedLines.length}):</strong>
                    </div>
                  </div>
                  <div className="lyrics-parsed-card__list">
                    {parsedLines.length > 0 ? (
                      parsedLines.map((l, i) => (
                        <div key={l.id || i} className="lyrics-parsed-card__item">
                          <span className="lyrics-parsed-card__time">
                            [{Math.floor(l.time / 60).toString().padStart(2, '0')}:
                            {(l.time % 60).toFixed(2).padStart(5, '0')}]
                          </span>
                          <span className="lyrics-parsed-card__text">{l.text}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 4px' }}>
                        No hay versos cargados aún. Escribe en el editor o sube un archivo .lrc.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 2: Diseño y Vista Previa */}
          {activeTab === 'display' && (
            <div className="lyrics-display-grid">
              {/* Columna Izquierda: Opciones de Diseño */}
              <div className="lyrics-display-left">
                <div className="lyrics-obs-settings">
                  <div className="form-group">
                    <label className="form-label">Modo de Visualización (3 Vistas):</label>
                    <div className="row">
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.mode === 'prompter' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ mode: 'prompter' })}
                        title="Teleprompter estilo Apple Music con scroll continuo y verso activo destacado para músicos"
                      >
                        1. Músicos (Teleprompter)
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.mode === 'lowerthird' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ mode: 'lowerthird' })}
                        title="Tercio inferior con dos líneas limpias, optimizado para OBS Studio y captura de video"
                      >
                        2. Tercio Inferior (OBS)
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.mode === 'fullscreen' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ mode: 'fullscreen' })}
                        title="Pantalla completa grande centrada para proyectores o auditorios, con editor de CSS"
                      >
                        3. Pantalla Completa
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fondo de Pantalla:</label>
                    <div className="row">
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'transparent' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'transparent' })}
                        title="Fondo 100% transparente sin bordes para incrustar en OBS Studio como Fuente Navegador"
                      >
                        Transparente (OBS)
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'dark' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'dark' })}
                        title="Fondo oscuro profesional"
                      >
                        Oscuro
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'chroma-green' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'chroma-green' })}
                        title="Fondo croma verde puro (#00FF00) para keying por color"
                      >
                        Croma Verde
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'black' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'black' })}
                        title="Negro puro para proyectores y pantallas OLED"
                      >
                        Negro Puro
                      </button>
                    </div>
                  </div>

                  <div className="row" style={{ gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Tamaño de Texto:</label>
                      <div className="row">
                        <button
                          type="button"
                          className={`btn btn--tiny ${options.fontSize === 'normal' ? 'btn--accent' : ''}`}
                          onClick={() => setLyricsOptions({ fontSize: 'normal' })}
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          className={`btn btn--tiny ${options.fontSize === 'large' ? 'btn--accent' : ''}`}
                          onClick={() => setLyricsOptions({ fontSize: 'large' })}
                        >
                          Grande
                        </button>
                        <button
                          type="button"
                          className={`btn btn--tiny ${options.fontSize === 'xlarge' ? 'btn--accent' : ''}`}
                          onClick={() => setLyricsOptions({ fontSize: 'xlarge' })}
                        >
                          Extra Grande
                        </button>
                      </div>
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Opciones de Formato y Sombra:</label>
                      <div className="row">
                        <button
                          type="button"
                          className={`btn btn--tiny ${options.uppercase ? 'btn--accent' : ''}`}
                          onClick={() => setLyricsOptions({ uppercase: !options.uppercase })}
                        >
                          {options.uppercase && <Check size={11} style={{ marginRight: 4, display: 'inline-block', verticalAlign: -1 }} />}
                          {options.uppercase ? 'MAYÚSCULAS' : 'Mayúsculas'}
                        </button>
                        <button
                          type="button"
                          className={`btn btn--tiny ${options.showNext ? 'btn--accent' : ''}`}
                          onClick={() => setLyricsOptions({ showNext: !options.showNext })}
                        >
                          {options.showNext && <Check size={11} style={{ marginRight: 4, display: 'inline-block', verticalAlign: -1 }} />}
                          {options.showNext ? 'Línea Siguiente' : 'Ocultar Siguiente'}
                        </button>
                        <button
                          type="button"
                          className={`btn btn--tiny ${options.textShadow ? 'btn--accent' : ''}`}
                          onClick={() => setLyricsOptions({ textShadow: !options.textShadow })}
                          title="Alternar sombra/contorno para resaltar texto sobre video o fondos claros"
                        >
                          {options.textShadow && <Check size={11} style={{ marginRight: 4, display: 'inline-block', verticalAlign: -1 }} />}
                          {options.textShadow ? 'Sombra Activa' : 'Sin Sombra'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Editor de CSS Personalizado exclusivo para Pantalla Completa */}
                  {options.mode === 'fullscreen' && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                          Editor de CSS (Pantalla Completa):
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn--tiny"
                            onClick={() => {
                              const exampleCss = `/* Ejemplo de estilo cinematográfico para Pantalla Completa */
.lyrics-stage--fullscreen .lyrics-fullscreen__current {
  font-family: 'Figtree', sans-serif;
  color: #ffffff;
  font-size: clamp(38px, 6vw, 72px);
  letter-spacing: 0.02em;
}
.lyrics-stage--fullscreen .lyrics-fullscreen__next {
  color: #94a3b8;
  font-style: italic;
  font-size: 0.85em;
}`;
                              setLyricsOptions({ customCss: exampleCss });
                            }}
                            title="Insertar plantilla de ejemplo"
                          >
                            Insertar Ejemplo
                          </button>
                          <button
                            type="button"
                            className="btn btn--tiny btn--danger"
                            onClick={() => setLyricsOptions({ customCss: '' })}
                            title="Restablecer CSS al valor por defecto"
                          >
                            Restablecer
                          </button>
                        </div>
                      </div>

                      <textarea
                        className="text-input"
                        style={{
                          width: '100%',
                          minHeight: 70,
                          maxHeight: 160,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: 10.5,
                          lineHeight: 1.4,
                          padding: '6px 8px',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                        placeholder="/* Escribe tu CSS personalizado aquí */&#10;.lyrics-stage--fullscreen .lyrics-fullscreen__current { color: #fef08a; }"
                        value={options.customCss || ''}
                        onChange={(e) => setLyricsOptions({ customCss: e.target.value })}
                        spellCheck={false}
                      />

                      <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.35 }}>
                        💡 <strong>Guía de clases:</strong> Usa <code>.lyrics-fullscreen__current</code> para la línea activa, <code>.lyrics-fullscreen__next</code> para la siguiente o <code>.lyrics-stage--fullscreen</code> para el fondo.
                      </p>
                    </div>
                  )}

                  <div className="lyrics-display-info-card" style={{ marginTop: 10 }}>
                    <Lightbulb size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Cualquier ajuste de diseño que realices aquí se actualiza <strong>en tiempo real</strong> en todas las pantallas, ventanas emergentes y fuentes de OBS conectadas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Vista Previa Realista */}
              <div className="lyrics-display-right">
                <div className="lyrics-display-preview-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Eye size={14} style={{ color: 'var(--accent)' }} />
                    <strong style={{ fontSize: 12 }}>Vista Previa en Tiempo Real</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--text-dim)' }}>
                    <span className="badge">Modo: {options.mode}</span>
                    <span className="badge">Fondo: {options.theme}</span>
                  </div>
                </div>

                <div
                  className={`lyrics-preview-box lyrics-preview-box--large lyrics-stage--${options.theme} lyrics-stage--${options.mode} lyrics-stage--font-${options.fontSize} ${options.textShadow ? 'lyrics-stage--has-shadow' : ''}`}
                >
                  {options.mode === 'fullscreen' && options.customCss && (
                    <style dangerouslySetInnerHTML={{ __html: options.customCss }} />
                  )}

                  {options.mode === 'prompter' ? (
                    /* Vista estilo Apple Music para teleprompter */
                    <div style={{ width: '100%', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                      <div style={{ opacity: 0.25, fontSize: '0.9em' }}>
                        {options.uppercase
                          ? (parsedLines[0]?.text || 'VERSO ANTERIOR').toUpperCase()
                          : parsedLines[0]?.text || 'Verso anterior'}
                      </div>
                      <div style={{ fontWeight: 800, color: '#ffffff', transform: 'scale(1.05)', textShadow: options.textShadow ? '0 0 20px rgba(255,255,255,0.4)' : 'none' }}>
                        {options.uppercase
                          ? (parsedLines[1]?.text || 'VERSO ACTUAL EN REPRODUCCIÓN').toUpperCase()
                          : parsedLines[1]?.text || 'Verso actual en reproducción'}
                      </div>
                      <div style={{ opacity: 0.35, fontSize: '0.9em' }}>
                        {options.uppercase
                          ? (parsedLines[2]?.text || 'VERSO SIGUIENTE EN COLA').toUpperCase()
                          : parsedLines[2]?.text || 'Verso siguiente en cola'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', width: '100%', padding: '24px 16px' }}>
                      <div style={{ fontWeight: 800 }}>
                        {options.uppercase
                          ? (parsedLines[0]?.text || 'EJEMPLO DE LÍNEA ACTUAL SINCRONIZADA').toUpperCase()
                          : parsedLines[0]?.text || 'Ejemplo de línea actual sincronizada'}
                      </div>
                      {options.showNext && (
                        <div style={{ opacity: 0.68, fontSize: '0.85em', marginTop: 8 }}>
                          {options.uppercase
                            ? (parsedLines[1]?.text || 'PRÓXIMA LÍNEA EN COLA...').toUpperCase()
                            : parsedLines[1]?.text || 'Próxima línea en cola...'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 3: Transmisión, Enlaces y Código QR (Optimizado por Entorno Desktop / Web) */}
          {activeTab === 'broadcast' && (
            <div className="lyrics-broadcast-container">
              {/* Barra Superior */}
              {isDesktop ? (
                <div className="lyrics-room-bar">
                  <div className="lyrics-room-bar__info">
                    <Wifi size={18} style={{ color: 'var(--meter-ok)', flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 12 }}>Servidor LAN Local:</strong>
                        <span className="lyrics-room-bar__code">{currentHost}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                        Transmisión local de ultra baja latencia para celulares, tablets y OBS sin requerir conexión a internet.
                      </div>
                    </div>
                  </div>

                  <div className="lyrics-room-bar__actions">
                    <button
                      type="button"
                      className="btn btn--tiny btn--accent"
                      onClick={handleOpenPopup}
                      title="Abrir en ventana emergente independiente para proyector o segunda pantalla"
                    >
                      <ExternalLink size={12} />
                      <span>Abrir Ventana Limpia</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="lyrics-room-bar">
                  <div className="lyrics-room-bar__info">
                    {isLocked ? (
                      <ShieldCheck size={18} style={{ color: 'var(--meter-ok)', flexShrink: 0 }} />
                    ) : (
                      <Unlock size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 12 }}>Sala Global de Transmisión:</strong>
                        <span className="lyrics-room-bar__code">{roomCode}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                        {isLocked
                          ? 'Enlace protegido con candado. No cambiará entre canciones ni al reiniciar la app.'
                          : 'Enlace desbloqueado. Puedes regenerar una nueva sala si lo necesitas.'}
                      </div>
                    </div>
                  </div>

                  <div className="lyrics-room-bar__actions">
                    <button
                      type="button"
                      className={`btn btn--tiny ${isLocked ? 'btn--accent' : ''}`}
                      onClick={handleToggleLock}
                      title={isLocked ? 'Hacer clic para permitir regenerar el enlace' : 'Bloquear enlace para que nunca se modifique'}
                    >
                      {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      <span>{isLocked ? 'Bloqueado' : 'Desbloqueado'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn--tiny"
                      onClick={handleRegenerateRoom}
                      disabled={isLocked}
                      title={isLocked ? 'Desbloquea el enlace primero para regenerar' : 'Generar una nueva sala aleatoria'}
                    >
                      <RotateCcw size={12} />
                      <span>Regenerar</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn--tiny btn--accent"
                      onClick={handleOpenPopup}
                      title="Abrir en ventana emergente independiente para proyector o segunda pantalla"
                      style={{ marginLeft: 6 }}
                    >
                      <ExternalLink size={12} />
                      <span>Abrir Ventana Limpia</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tarjeta Principal Adaptada (Desktop LAN vs Web WebRTC) */}
              {isDesktop ? (
                /* MODO ESCRITORIO (.EXE): Red Local WiFi y Cable como Protagonista */
                <div className="lyrics-hero-card lyrics-hero-card--desktop">
                  <div className="lyrics-hero-card__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Wifi size={17} style={{ color: 'var(--meter-ok)' }} />
                      <strong style={{ fontSize: 13 }}>Red Local Wi-Fi y Cable (Servidor LAN Autónomo)</strong>
                    </div>
                    <span className="lyrics-badge lyrics-badge--ok">
                      En línea en puerto {lanInfo?.port || 3000} (Sin requerir Internet)
                    </span>
                  </div>

                  <div className="lyrics-hero-card__content">
                    {/* Código QR Prominente */}
                    <div className="lyrics-hero-qr-box">
                      <div className="lyrics-qr-img-wrapper">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="Código QR WiFi OpenMT" className="lyrics-qr-img" />
                        ) : (
                          <div style={{ width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11 }}>
                            Generando QR...
                          </div>
                        )}
                      </div>
                      <span className="lyrics-hero-qr-label">Escanear con Celular o Tablet</span>
                    </div>

                    {/* Detalles de Conexión WiFi */}
                    <div className="lyrics-hero-details">
                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text)', lineHeight: 1.45 }}>
                        Cualquier teléfono, tablet o computadora conectada a la <strong>misma red Wi-Fi o por cable Ethernet</strong> puede abrir el teleprompter en tiempo real durante ensayos o conciertos <strong>sin conexión a internet</strong>.
                      </p>

                      {/* Selector de Dirección IP de Red (Wi-Fi o Cable Ethernet) */}
                      <div className="lyrics-network-ip-section" style={{ margin: '8px 0', padding: '8px 10px', background: 'var(--bg-inset)', borderRadius: 4, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Wifi size={13} style={{ color: 'var(--meter-ok)' }} />
                            IP de Red Local (Wi-Fi o Cable Ethernet):
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                            Puerto: <strong>{lanInfo?.port || 3000}</strong>
                          </span>
                        </div>

                        {lanInfo?.ips && lanInfo.ips.length > 0 && (
                          <div className="row" style={{ gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                            {lanInfo.ips.map((ip) => {
                              const isSelected = (selectedIp === ip || (!selectedIp && ip === lanInfo.ips[0])) && !customIp;
                              return (
                                <button
                                  key={ip}
                                  type="button"
                                  className={`btn btn--tiny ${isSelected ? 'btn--accent' : ''}`}
                                  onClick={() => {
                                    setSelectedIp(ip);
                                    setCustomIp('');
                                  }}
                                  title={`Usar IP ${ip} para el QR y el enlace`}
                                >
                                  {ip}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            className="text-input"
                            style={{ height: 24, fontSize: 11, padding: '2px 8px', flex: 1, fontFamily: 'monospace' }}
                            placeholder={`IP manual (ej: ${selectedIp || lanInfo?.ips?.[0] || '192.168.1.50'})`}
                            value={customIp}
                            onChange={(e) => setCustomIp(e.target.value)}
                            title="Ingresa una IP estática o personalizada si usas cable directo sin DHCP"
                          />
                          {customIp && (
                            <button
                              type="button"
                              className="btn btn--tiny"
                              onClick={() => setCustomIp('')}
                              title="Restablecer a IP detectada automáticamente"
                            >
                              Auto
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="lyrics-target-selector">
                        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>Destino del enlace:</span>
                        <div className="row" style={{ gap: 4 }}>
                          <button
                            type="button"
                            className={`btn btn--tiny ${qrTarget === 'mobile-prompter' ? 'btn--accent' : ''}`}
                            onClick={() => setQrTarget('mobile-prompter')}
                          >
                            <Smartphone size={11} />
                            <span>Teleprompter Músicos (Celular)</span>
                          </button>
                          <button
                            type="button"
                            className={`btn btn--tiny ${qrTarget === 'obs' ? 'btn--accent' : ''}`}
                            onClick={() => setQrTarget('obs')}
                          >
                            <Tv size={11} />
                            <span>Salida Limpia (OBS / Pantalla)</span>
                          </button>
                        </div>
                      </div>

                      <div className="lyrics-qr-url-box" title={currentQrUrl}>
                        {currentQrUrl}
                      </div>

                      <div className="row" style={{ gap: 6, marginTop: 4 }}>
                        <button
                          type="button"
                          className={`btn btn--tiny ${copiedQr ? 'btn--play' : 'btn--accent'}`}
                          onClick={handleCopyQrUrl}
                          style={{ minWidth: 140 }}
                        >
                          {copiedQr ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedQr ? '¡Copiado!' : 'Copiar este Enlace'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => window.open(currentQrUrl, '_blank')}
                          title="Abrir este enlace en una pestaña nueva"
                        >
                          <ExternalLink size={12} />
                          <span>Abrir en Navegador</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* MODO WEB (Vercel / Navegador): WebRTC Online como Protagonista */
                <div className="lyrics-hero-card lyrics-hero-card--web">
                  <div className="lyrics-hero-card__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Globe size={17} style={{ color: '#38bdf8' }} />
                      <strong style={{ fontSize: 13 }}>Transmisión en Línea (WebRTC en Tiempo Real)</strong>
                    </div>
                    <span className="lyrics-badge lyrics-badge--web">
                      Sala P2P: {roomCode}
                    </span>
                  </div>

                  <div className="lyrics-hero-card__content">
                    {/* Código QR Prominente */}
                    <div className="lyrics-hero-qr-box">
                      <div className="lyrics-qr-img-wrapper">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="Código QR WebRTC OpenMT" className="lyrics-qr-img" />
                        ) : (
                          <div style={{ width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11 }}>
                            Generando QR...
                          </div>
                        )}
                      </div>
                      <span className="lyrics-hero-qr-label">Escanear para Ver en Vivo</span>
                    </div>

                    {/* Detalles de Conexión WebRTC */}
                    <div className="lyrics-hero-details">
                      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text)', lineHeight: 1.45 }}>
                        Sincronización punto a punto (WebRTC) de ultra baja latencia. Cualquier dispositivo con acceso a internet puede seguir la letra de tus secuencias en vivo.
                      </p>

                      <div className="lyrics-target-selector">
                        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>Destino del enlace:</span>
                        <div className="row" style={{ gap: 4 }}>
                          <button
                            type="button"
                            className={`btn btn--tiny ${qrTarget === 'mobile-prompter' ? 'btn--accent' : ''}`}
                            onClick={() => setQrTarget('mobile-prompter')}
                          >
                            <Smartphone size={11} />
                            <span>Teleprompter Celular</span>
                          </button>
                          <button
                            type="button"
                            className={`btn btn--tiny ${qrTarget === 'obs' ? 'btn--accent' : ''}`}
                            onClick={() => setQrTarget('obs')}
                          >
                            <Tv size={11} />
                            <span>Salida OBS / Pantalla</span>
                          </button>
                        </div>
                      </div>

                      <div className="lyrics-qr-url-box" title={currentQrUrl}>
                        {currentQrUrl}
                      </div>

                      <div className="row" style={{ gap: 6, marginTop: 4 }}>
                        <button
                          type="button"
                          className={`btn btn--tiny ${copiedQr ? 'btn--play' : 'btn--accent'}`}
                          onClick={handleCopyQrUrl}
                          style={{ minWidth: 140 }}
                        >
                          {copiedQr ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedQr ? '¡Copiado!' : 'Copiar este Enlace'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => window.open(currentQrUrl, '_blank')}
                          title="Abrir este enlace en una pestaña nueva"
                        >
                          <ExternalLink size={12} />
                          <span>Abrir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fila Inferior: 2 Columnas Balanceadas (OBS Local y Métodos Alternativos) */}
              <div className="lyrics-secondary-grid">
                {/* Columna 1: Salida OBS Studio */}
                <div className="lyrics-subcard">
                  <div className="lyrics-subcard__header">
                    <Tv size={15} style={{ color: 'var(--accent)' }} />
                    <strong style={{ fontSize: 12 }}>Salida para OBS Studio (Captura de Video)</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    Fuente Navegador con fondo transparente y actualización inmediata para transmisiones en directo.
                  </p>

                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      className={`btn btn--tiny ${copiedLocal ? 'btn--play' : 'btn--accent'}`}
                      onClick={handleCopyLocalLink}
                      style={{ flex: 1 }}
                    >
                      {copiedLocal ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLocal ? '¡Copiado!' : 'Copiar Enlace OBS'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--tiny"
                      onClick={handleOpenPopup}
                      title="Abrir ventana limpia para proyector o segunda pantalla"
                    >
                      <ExternalLink size={12} />
                      <span>Ventana Limpia</span>
                    </button>
                  </div>

                  {/* Guía en 4 pasos */}
                  <div className="lyrics-mini-guide">
                    <strong>Pasos para OBS Studio:</strong>
                    <ol>
                      <li>Copia el enlace para OBS mostrado arriba.</li>
                      <li>En OBS, agrega una fuente tipo <strong>Navegador</strong>.</li>
                      <li>Pega la URL (Ancho: <code>1920</code>, Alto: <code>1080</code>).</li>
                      <li>¡Listo! La letra se sincroniza sola al dar Play.</li>
                    </ol>
                  </div>
                </div>

                {/* Columna 2: Métodos de Soporte / Enlace Alternativo */}
                <div className="lyrics-subcard">
                  {isDesktop ? (
                    <>
                      <div className="lyrics-subcard__header">
                        <Eye size={15} style={{ color: 'var(--accent)' }} />
                        <strong style={{ fontSize: 12 }}>Proyector y Segunda Pantalla</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                        Abre una ventana limpia e independiente para arrastrarla a un proyector, televisor o monitor de escenario.
                      </p>

                      <div className="row" style={{ gap: 6, marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn--tiny btn--accent"
                          onClick={handleOpenPopup}
                          style={{ flex: 1 }}
                        >
                          <ExternalLink size={12} />
                          <span>Abrir Ventana Limpia</span>
                        </button>
                      </div>

                      <div className="lyrics-mini-guide" style={{ marginTop: 10 }}>
                        <strong>Consejos de Proyección:</strong>
                        <ol>
                          <li>Arrastra la ventana limpia a tu segunda pantalla.</li>
                          <li>Haz <strong>doble clic</strong> o presiona <strong>F</strong> para pantalla completa.</li>
                          <li>Tus cambios de letra y estilos se reflejan automáticamente.</li>
                        </ol>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lyrics-subcard__header">
                        <Download size={15} style={{ color: 'var(--meter-ok)' }} />
                        <strong style={{ fontSize: 12 }}>¿Tocas en vivo sin conexión a Internet?</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.45 }}>
                        La <strong>aplicación de escritorio de OpenMT (.exe)</strong> incluye su propio servidor local LAN integrado. Te permite conectar celulares y tablets por Wi-Fi de forma totalmente autónoma sin internet.
                      </p>

                      <div className="row" style={{ gap: 6, marginTop: 10 }}>
                        <a
                          href="https://github.com/edgardovalladares/OpenMT/releases"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--tiny btn--accent"
                          style={{ textDecoration: 'none' }}
                        >
                          <Download size={12} />
                          <span>Descargar OpenMT .exe para Windows</span>
                        </a>
                      </div>

                      <div className="lyrics-tip-box" style={{ marginTop: 10 }}>
                        <Lightbulb size={13} style={{ color: 'var(--meter-ok)', flexShrink: 0 }} />
                        <span>Ideal para iglesias, auditorios y salas de ensayo con Wi-Fi local.</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <div className="modal__footer-status">
            <CheckCircle2 size={12} style={{ color: 'var(--meter-ok)', verticalAlign: -1, marginRight: 4 }} />
            <span>Sincronización global activa ({isLocked ? 'Enlace bloqueado' : 'Enlace desbloqueado'})</span>
          </div>

          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn--accent" onClick={handleSave}>
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
