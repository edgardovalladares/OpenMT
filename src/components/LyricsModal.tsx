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
  HelpCircle,
  Lightbulb,
  X,
  List,
  Lock,
  Unlock,
  RotateCcw,
  QrCode,
  Smartphone,
  Wifi,
  ShieldCheck,
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
import type { ElectronLanInfo } from '../types/electron';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LyricsModal({ isOpen, onClose }: Props) {
  const lyrics = useDaw((s) => s.lyrics);
  const options = useDaw((s) => s.lyricsOptions);
  const { setLyrics, setLyricsOffset, setLyricsOptions, clearLyrics } = useDaw.getState();

  const [activeTab, setActiveTab] = useState<'edit' | 'obs'>('edit');
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
  const [copiedLan, setCopiedLan] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);

  // Sala persistente y bloqueo
  const [roomCode, setRoomCode] = useState<string>(() => getPersistentRoom());
  const [isLocked, setIsLockedState] = useState<boolean>(() => isRoomLocked());

  // Red local desde Electron (si está corriendo como app de escritorio)
  const [lanInfo, setLanInfo] = useState<ElectronLanInfo | null>(null);

  // Destino del Código QR
  const [qrTarget, setQrTarget] = useState<'mobile-prompter' | 'obs' | 'remote'>('mobile-prompter');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedLines = useMemo(() => parseLrc(text), [text]);

  // Obtener información LAN de Electron si está disponible
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getLanInfo) {
      window.electronAPI
        .getLanInfo()
        .then((info) => {
          if (info && info.localUrl) {
            setLanInfo(info);
          }
        })
        .catch(() => {});
    }
  }, []);

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

  // Constructor centralizado de URLs
  const buildLyricsUrl = (target: 'mobile-prompter' | 'obs' | 'remote') => {
    const isMobile = target === 'mobile-prompter';
    const origin = isMobile && lanInfo?.localUrl ? lanInfo.localUrl : window.location.origin;
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams({
      view: 'lyrics',
      room: roomCode,
      theme: isMobile ? 'dark' : options.theme,
      mode: isMobile ? 'prompter' : options.mode,
      fontSize: isMobile ? 'large' : options.fontSize,
      uppercase: String(options.uppercase),
      showNext: isMobile ? 'true' : String(options.showNext),
    });
    return `${origin}${pathname}?${searchParams.toString()}`;
  };

  const generateLocalObsUrl = () => buildLyricsUrl('obs');
  const generateLanPrompterUrl = () => buildLyricsUrl('mobile-prompter');
  const generateRemoteUrl = () => buildLyricsUrl('remote');

  // URL activa para el Código QR
  const currentQrUrl = useMemo(() => {
    return buildLyricsUrl(qrTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrTarget, roomCode, lanInfo?.localUrl, options.theme, options.mode, options.fontSize, options.uppercase, options.showNext]);

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

  const handleCopyLanLink = () => {
    copyToClipboard(generateLanPrompterUrl(), setCopiedLan);
  };

  const handleCopyRemoteRoom = () => {
    copyToClipboard(generateRemoteUrl(), setCopiedRemote);
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

        {/* Pestañas Principales */}
        <div className="lyrics-modal__tabs">
          <button
            type="button"
            className={`lyrics-modal__tab ${activeTab === 'edit' ? 'lyrics-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <Sliders size={13} />
            <span>Cargar y Calibrar Letra</span>
          </button>
          <button
            type="button"
            className={`lyrics-modal__tab ${activeTab === 'obs' ? 'lyrics-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('obs')}
          >
            <Tv size={13} />
            <span>Configuración, QR y Transmisión</span>
          </button>
        </div>

        <div className="modal__body">
          {activeTab === 'edit' ? (
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
          ) : (
            /* PESTAÑA TRANSMISIÓN A OBS / PANTALLAS / RED LOCAL */
            <div className="lyrics-obs-grid">
              {/* Columna Izquierda: Enlace Global, Enlaces y Código QR */}
              <div className="lyrics-obs-left">
                {/* Barra de Enlace Global y Bloqueo */}
                <div className="lyrics-room-bar">
                  <div className="lyrics-room-bar__info">
                    {isLocked ? (
                      <ShieldCheck size={18} style={{ color: 'var(--meter-ok)', flexShrink: 0 }} />
                    ) : (
                      <Unlock size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 12 }}>Enlace Global:</strong>
                        <span className="lyrics-room-bar__code">{roomCode}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                        {isLocked
                          ? 'Enlace fijo protegido. No cambiará entre canciones ni al reiniciar.'
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
                  </div>
                </div>

                {/* Banner de Salida Limpia */}
                <div className="lyrics-obs-tab__hero">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 12.5 }}>Salida Limpia para Escenario y Transmisión</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
                      El enlace es global para todo el setlist: al cambiar de canción, OBS y las pantallas se actualizarán solas.
                    </p>
                  </div>

                  <div className="lyrics-obs-tab__buttons">
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={handleOpenPopup}
                      title="Abrir en ventana emergente independiente para proyector o segunda pantalla"
                    >
                      <ExternalLink size={13} />
                      <span>Ventana Limpia</span>
                    </button>
                  </div>
                </div>

                {/* Tarjetas de Enlaces de Transmisión */}
                <div className="lyrics-links-card">
                  {/* 1. OBS Local */}
                  <div className="lyrics-link-row">
                    <div className="lyrics-link-row__info">
                      <Tv size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <strong>1. Enlace Local para OBS (Este equipo):</strong>
                        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                          Relay directo de ultra baja latencia. Ideal para capturar como Navegador en OBS Studio.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--tiny ${copiedLocal ? 'btn--play' : 'btn--accent'}`}
                      onClick={handleCopyLocalLink}
                      style={{ minWidth: 125, flexShrink: 0 }}
                    >
                      {copiedLocal ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLocal ? '¡Copiado!' : 'Copiar para OBS'}</span>
                    </button>
                  </div>

                  {/* 2. Red Local WiFi (Desktop / LAN) */}
                  <div className="lyrics-link-row" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="lyrics-link-row__info">
                      <Wifi size={16} style={{ color: 'var(--meter-ok)', flexShrink: 0 }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong>2. Red Local WiFi (Celulares y Tablets):</strong>
                          {lanInfo && (
                            <span style={{ fontSize: 10, background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: 3, color: 'var(--meter-ok)' }}>
                              LAN Activo ({lanInfo.port})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                          {lanInfo
                            ? `Disponible en ${lanInfo.localUrl}. Cualquier dispositivo en tu WiFi puede ver la letra sin internet.`
                            : 'Acceso en red local para teleprompter de vocalistas o músicos en escenario.'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--tiny ${copiedLan ? 'btn--play' : ''}`}
                      onClick={handleCopyLanLink}
                      style={{ minWidth: 125, flexShrink: 0 }}
                    >
                      {copiedLan ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLan ? '¡Copiado!' : 'Copiar WiFi'}</span>
                    </button>
                  </div>

                  {/* 3. Enlace Online WebRTC */}
                  <div className="lyrics-link-row" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="lyrics-link-row__info">
                      <Globe size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <div>
                        <strong>3. Enlace en Línea (WebRTC Remoto):</strong>
                        <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                          Sincroniza en tiempo real a través de internet con pantallas en otras ubicaciones.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--tiny ${copiedRemote ? 'btn--play' : ''}`}
                      onClick={handleCopyRemoteRoom}
                      style={{ minWidth: 125, flexShrink: 0 }}
                    >
                      {copiedRemote ? <Check size={12} /> : <Globe size={12} />}
                      <span>{copiedRemote ? '¡Copiado!' : 'Copiar Online'}</span>
                    </button>
                  </div>
                </div>

                {/* Tarjeta de Código QR */}
                <div className="lyrics-qr-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <QrCode size={15} style={{ color: 'var(--accent)' }} />
                      <strong style={{ fontSize: 12 }}>Escanear Código QR en Celular o Tablet</strong>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Sin escribir enlaces</span>
                  </div>

                  {/* Pestañas del QR */}
                  <div className="lyrics-qr-tabs">
                    <button
                      type="button"
                      className={`lyrics-qr-tab ${qrTarget === 'mobile-prompter' ? 'lyrics-qr-tab--active' : ''}`}
                      onClick={() => setQrTarget('mobile-prompter')}
                    >
                      <Smartphone size={12} />
                      <span>Prompter Celular (WiFi)</span>
                    </button>
                    <button
                      type="button"
                      className={`lyrics-qr-tab ${qrTarget === 'obs' ? 'lyrics-qr-tab--active' : ''}`}
                      onClick={() => setQrTarget('obs')}
                    >
                      <Tv size={12} />
                      <span>OBS / Pantalla</span>
                    </button>
                    <button
                      type="button"
                      className={`lyrics-qr-tab ${qrTarget === 'remote' ? 'lyrics-qr-tab--active' : ''}`}
                      onClick={() => setQrTarget('remote')}
                    >
                      <Globe size={12} />
                      <span>Online WebRTC</span>
                    </button>
                  </div>

                  <div className="lyrics-qr-body">
                    {/* Código QR renderizado */}
                    <div className="lyrics-qr-img-wrapper">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="Código QR Letras OpenMT" className="lyrics-qr-img" />
                      ) : (
                        <div style={{ width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11 }}>
                          Generando...
                        </div>
                      )}
                    </div>

                    {/* Detalles y Acciones del QR */}
                    <div className="lyrics-qr-details">
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                        {qrTarget === 'mobile-prompter' && (
                          <>
                            Abre la cámara de tu teléfono o tablet conectada a la misma red WiFi para ver el <strong>teleprompter en vivo</strong> optimizado para vocalistas.
                          </>
                        )}
                        {qrTarget === 'obs' && (
                          <>
                            Enlace configurado con tus opciones de salida limpia para captura o monitores de retorno.
                          </>
                        )}
                        {qrTarget === 'remote' && (
                          <>
                            Enlace público que se conecta a tu sesión en tiempo real a través de WebRTC.
                          </>
                        )}
                      </p>

                      <div className="lyrics-qr-url-box" title={currentQrUrl}>
                        {currentQrUrl}
                      </div>

                      <div className="lyrics-qr-actions">
                        <button
                          type="button"
                          className={`btn btn--tiny ${copiedQr ? 'btn--play' : 'btn--accent'}`}
                          onClick={handleCopyQrUrl}
                        >
                          {copiedQr ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedQr ? '¡Copiado!' : 'Copiar este enlace'}</span>
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

                {/* Guía para OBS */}
                <div className="lyrics-obs-guide">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HelpCircle size={13} style={{ color: 'var(--accent)' }} />
                    <strong>Instrucciones para OBS Studio:</strong>
                  </div>
                  <ol style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    <li>Copia el <strong>Enlace local para OBS</strong> mostrado arriba.</li>
                    <li>En OBS Studio, ve al panel <strong>Fuentes</strong>, presiona <strong>+</strong> y selecciona <strong>Navegador</strong>.</li>
                    <li>Pega la URL copiada en el campo <strong>URL</strong> (Ancho: <code>1920</code>, Alto: <code>1080</code>).</li>
                    <li>¡Listo! Al reproducir o cambiar de canción en OpenMT, la letra se actualizará de forma instantánea.</li>
                  </ol>
                </div>
              </div>

              {/* Columna Derecha: Configuración visual en vivo y Vista Previa */}
              <div className="lyrics-obs-right">
                <div className="lyrics-obs-settings">
                  <div className="form-group">
                    <label className="form-label">Modo de Visualización:</label>
                    <div className="row">
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.mode === 'lowerthird' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ mode: 'lowerthird' })}
                      >
                        Tercio Inferior (OBS)
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.mode === 'prompter' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ mode: 'prompter' })}
                      >
                        Teleprompter
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.mode === 'fullscreen' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ mode: 'fullscreen' })}
                      >
                        Pantalla Completa
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
                      >
                        Transparente (OBS)
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'dark' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'dark' })}
                      >
                        Oscuro
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'chroma-green' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'chroma-green' })}
                      >
                        Croma Verde
                      </button>
                      <button
                        type="button"
                        className={`btn btn--tiny ${options.theme === 'black' ? 'btn--accent' : ''}`}
                        onClick={() => setLyricsOptions({ theme: 'black' })}
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
                      <label className="form-label">Opciones de Formato:</label>
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
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vista previa simulada */}
                <div className="form-group">
                  <label className="form-label">Vista Previa Simulada:</label>
                  <div
                    className={`lyrics-preview-box lyrics-stage--${options.theme} lyrics-stage--${options.mode} lyrics-stage--font-${options.fontSize}`}
                  >
                    {parsedLines.length > 0 ? (
                      <div style={{ textAlign: 'center', width: '100%' }}>
                        <div style={{ fontWeight: 800 }}>
                          {options.uppercase
                            ? (parsedLines[0]?.text || 'EJEMPLO DE LÍNEA ACTUAL').toUpperCase()
                            : parsedLines[0]?.text || 'Ejemplo de línea actual sincronizada'}
                        </div>
                        {options.showNext && (
                          <div style={{ opacity: 0.65, fontSize: '0.85em', marginTop: 4 }}>
                            {options.uppercase
                              ? (parsedLines[1]?.text || 'PRÓXIMA LÍNEA EN COLA...').toUpperCase()
                              : parsedLines[1]?.text || 'Próxima línea en cola...'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ opacity: 0.6, fontSize: 11 }}>
                        Carga una letra en la pestaña anterior para ver la vista previa en vivo.
                      </span>
                    )}
                  </div>
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
