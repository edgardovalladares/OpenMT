import { useState, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { parseLrc, SAMPLE_LRC } from '../utils/lrcParser';
import { setActiveRoom, getActiveRoom } from '../audio/lyricsSync';

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
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);
  const [remoteRoom, setRemoteRoom] = useState<string | null>(() => getActiveRoom());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedLines = useMemo(() => parseLrc(text), [text]);

  if (!isOpen) return null;

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

  // Generar URL local para OBS Studio
  const generateLocalObsUrl = () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams({
      view: 'lyrics',
      theme: options.theme,
      mode: options.mode,
      fontSize: options.fontSize,
      uppercase: String(options.uppercase),
      showNext: String(options.showNext),
    });
    return `${origin}${pathname}?${searchParams.toString()}`;
  };

  // Generar URL remota con sala compartida
  const generateRemoteUrl = (roomCode: string) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
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

  const handleCopyLocalLink = async () => {
    setLyrics(text, offset);
    const url = generateLocalObsUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 2500);
    } catch {
      prompt('Copia este enlace local para OBS:', url);
    }
  };

  const handleGenerateRemoteRoom = async () => {
    setLyrics(text, offset);
    const code = remoteRoom || `openmt-${Math.random().toString(36).substring(2, 8)}`;
    setRemoteRoom(code);
    setActiveRoom(code);

    const url = generateRemoteUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRemote(true);
      setTimeout(() => setCopiedRemote(false), 2500);
    } catch {
      prompt('Copia este enlace compartido para OBS:', url);
    }
  };

  const handleOpenPopup = () => {
    setLyrics(text, offset);
    const url = generateLocalObsUrl();
    window.open(url, 'OpenMT_Lyrics', 'width=1000,height=600,menubar=no,toolbar=no,location=no');
  };

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
              Letras Sincronizadas (LRC / OBS Studio)
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* Pestañas */}
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
            <span>Configuración y Transmisión a OBS</span>
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
                        if (window.confirm('¿Deseas borrar la letra cargada?')) {
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
                    Contenido LRC (formato estándar <code>[mm:ss.xx] Letra</code>):
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
                {/* Calibración de timing / Latencia de audio */}
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
            /* PESTAÑA TRANSMISIÓN A OBS / PANTALLAS */
            <div className="lyrics-obs-grid">
              {/* Columna Izquierda: Enlaces y Guía */}
              <div className="lyrics-obs-left">
                <div className="lyrics-obs-tab__hero">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 13 }}>Salida Limpia para Pantallas</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
                      100 % limpia para proyectores, monitores secundarios o captura de video.
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
                      <span>Abrir Ventana Limpia</span>
                    </button>
                  </div>
                </div>

                {/* Enlaces para OBS */}
                <div className="lyrics-links-card">
                  <div className="lyrics-link-row">
                    <div className="lyrics-link-row__info">
                      <Tv size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <strong>1. Enlace Local para OBS (Este equipo):</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          Relay directo de ultra baja latencia. Recomendado para OBS en esta máquina.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--tiny ${copiedLocal ? 'btn--play' : 'btn--accent'}`}
                      onClick={handleCopyLocalLink}
                      style={{ minWidth: 140, flexShrink: 0 }}
                    >
                      {copiedLocal ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLocal ? '¡Copiado!' : 'Copiar para OBS'}</span>
                    </button>
                  </div>

                  <div className="lyrics-link-row" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="lyrics-link-row__info">
                      <Globe size={16} style={{ color: 'var(--meter-ok)', flexShrink: 0 }} />
                      <div>
                        <strong>2. Enlace en Línea (WebRTC / Remoto):</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {remoteRoom
                            ? `Sala activa: ${remoteRoom} (sincroniza en tiempo real vía WebRTC)`
                            : 'Genera un link con sala P2P para OBS o pantallas en otra computadora.'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--tiny ${copiedRemote ? 'btn--play' : ''}`}
                      onClick={handleGenerateRemoteRoom}
                      style={{ minWidth: 140, flexShrink: 0 }}
                    >
                      {copiedRemote ? <Check size={12} /> : <Globe size={12} />}
                      <span>{copiedRemote ? '¡Copiado!' : remoteRoom ? 'Copiar sala' : 'Generar enlace online'}</span>
                    </button>
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
                    <li>¡Listo! Al reproducir en OpenMT, la letra se sincronizará automáticamente sin refrescar la página.</li>
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
            <span>Relay de sincronización local y online activo</span>
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
